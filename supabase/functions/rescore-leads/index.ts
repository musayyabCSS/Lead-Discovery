import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface LeadRow {
  id: string;
  company_name: string;
  run_id: string;
  icp_config_id: string;
  source_signal_id: string | null;
}

interface SignalRow {
  id: string;
  signal_type: string;
  source_url: string;
  raw_snippet: string;
}

interface IcpConfigRow {
  id: string;
  name: string;
  target_verticals: string[];
  exclusions: string[];
  company_size_stage: string;
  kdm_titles: string[];
  geography: string;
  scoring_bands?: {
    strong?: number[];
    qualified?: number[];
    borderline?: number[];
    reject_below?: number;
  };
}

interface ScoreCandidate {
  leadId: string;
  companyName: string;
  signalType: string;
  title: string;
  snippet: string;
  sourceUrl: string;
}

interface ScoreResult {
  score: number;
  is_real_target: boolean;
  reasoning: string;
  reject_reason?: string;
}

function buildScoringSystemPrompt(config: IcpConfigRow): string {
  const bands = config.scoring_bands || {};
  const bandStr = (key: keyof typeof bands) => {
    const v = bands[key];
    if (v === undefined) return "";
    if (Array.isArray(v)) return v.join("-");
    return String(v);
  };
  return [
    `You are a lead qualification assistant for an outbound sales team.`,
    `Your job is to score discovered leads against the ICP (Ideal Customer Profile) and return a JSON verdict.`,
    ``,
    `ICP CONFIG:`,
    `- Name: ${config.name}`,
    `- Target verticals: ${(config.target_verticals || []).join(", ")}`,
    `- Exclusions: ${(config.exclusions || []).join(", ")}`,
    `- Company size/stage: ${config.company_size_stage}`,
    `- Key decision-maker titles: ${(config.kdm_titles || []).join(", ")}`,
    `- Geography: ${config.geography}`,
    `- Scoring bands: strong=${bandStr("strong")}, qualified=${bandStr("qualified")}, borderline=${bandStr("borderline")}, reject_below=${bandStr("reject_below")}`,
    ``,
    `SCORING RULES:`,
    `A good lead is a real, specific organization that matches the ICP verticals and size, showing a genuine pain signal.`,
    `For Med Bills: a practice or clinic hiring front desk, billing, scheduling or scribe staff, or expanding.`,
    `For CSS: an eCommerce, SaaS, logistics or hardware company hiring customer support roles or scaling support.`,
    ``,
    `Score 0 and is_real_target=false for:`,
    `- Staffing or recruiting agencies, job boards and aggregators`,
    `- Pharma, biotech or CRO companies`,
    `- AI-training or gig-work marketplaces`,
    `- Large national chains or health systems above the config's size limit`,
    `- Anything matching the config's exclusions`,
    ``,
    `Return a JSON object with this exact shape:`,
    `{"results": [{"index": 0, "score": 0, "is_real_target": true, "reasoning": "max 2 short sentences", "reject_reason": "one word or null"}]}`,
    `Score is an integer from 0 to 10. reject_reason is a single word when is_real_target is false, otherwise null.`,
    `Use the scoring_bands to interpret the score: strong, qualified, borderline, reject_below.`,
  ].join("\n");
}

function buildScoringUserPrompt(candidates: ScoreCandidate[]): string {
  const items = candidates.map((c, i) =>
    `[${i}] Company: ${c.companyName}\nSignal: ${c.signalType}\nTitle: ${c.title}\nSnippet: ${c.snippet}\nURL: ${c.sourceUrl}`
  );
  return `Score each candidate below. Return JSON: {"results": [{"index": 0, "score": 0, "is_real_target": true, "reasoning": "...", "reject_reason": null}]}\n\n${items.join("\n\n")}`;
}

async function scoreBatch(
  candidates: ScoreCandidate[],
  systemPrompt: string,
  apiKey: string
): Promise<Record<number, ScoreResult>> {
  const userPrompt = buildScoringUserPrompt(candidates);

  const body: Record<string, unknown> = {
    model: "gpt-5.4-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorBody.slice(0, 500)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned empty content");

  const parsed = JSON.parse(content);
  const resultsArr = parsed.results || parsed.candidates || [];
  const out: Record<number, ScoreResult> = {};
  for (const item of resultsArr) {
    const idx = typeof item.index === "number" ? item.index : parseInt(item.index, 10);
    if (isNaN(idx)) continue;
    out[idx] = {
      score: Math.max(0, Math.min(10, Math.round(Number(item.score) || 0))),
      is_real_target: !!item.is_real_target,
      reasoning: (item.reasoning || "").slice(0, 300),
      reject_reason: item.reject_reason || undefined,
    };
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch unscored leads (score = 0, no reasoning text, pending_review)
    const { data: unscoredLeads, error: leadsError } = await supabase
      .from("leads")
      .select("id, company_name, run_id, icp_config_id, source_signal_id")
      .eq("confidence_score", 0)
      .eq("score_reasoning", "")
      .eq("qualification_status", "pending_review")
      .order("created_at", { ascending: true })
      .limit(200);

    if (leadsError || !unscoredLeads) {
      return new Response(
        JSON.stringify({ error: leadsError?.message || "Failed to fetch leads" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (unscoredLeads.length === 0) {
      return new Response(
        JSON.stringify({ message: "No unscored leads found", scored: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group by icp_config_id so we use the right ICP context
    const leadsByConfig: Record<string, LeadRow[]> = {};
    for (const lead of unscoredLeads as LeadRow[]) {
      if (!leadsByConfig[lead.icp_config_id]) leadsByConfig[lead.icp_config_id] = [];
      leadsByConfig[lead.icp_config_id].push(lead);
    }

    let totalScored = 0;
    let totalRejected = 0;
    let totalQualified = 0;
    let totalCalls = 0;

    for (const [configId, leads] of Object.entries(leadsByConfig)) {
      // Fetch the ICP config
      const { data: config } = await supabase
        .from("icp_configs")
        .select("id, name, target_verticals, exclusions, company_size_stage, kdm_titles, geography, scoring_bands")
        .eq("id", configId)
        .single() as { data: IcpConfigRow | null };

      if (!config) {
        console.log(`[warn] ICP config ${configId} not found, skipping ${leads.length} leads`);
        continue;
      }

      const systemPrompt = buildScoringSystemPrompt(config);
      const bands = config.scoring_bands || {};
      const rejectBelow = bands.reject_below ?? 6;

      // Fetch signals for these leads
      const signalIds = leads.map((l) => l.source_signal_id).filter(Boolean) as string[];
      const { data: signals } = await supabase
        .from("signals")
        .select("id, signal_type, source_url, raw_snippet")
        .in("id", signalIds) as { data: SignalRow[] | null };

      const signalMap: Record<string, SignalRow> = {};
      if (signals) {
        for (const sig of signals) {
          signalMap[sig.id] = sig;
        }
      }

      // Build candidates
      const candidates: ScoreCandidate[] = [];
      for (const lead of leads) {
        const sig = lead.source_signal_id ? signalMap[lead.source_signal_id] : null;
        const snippet = sig?.raw_snippet || "";
        const title = snippet.split("\n")[0] || "";
        candidates.push({
          leadId: lead.id,
          companyName: lead.company_name,
          signalType: sig?.signal_type || "unknown",
          title,
          snippet,
          sourceUrl: sig?.source_url || "",
        });
      }

      // Score in batches of 8
      const batchSize = 8;
      for (let bi = 0; bi < candidates.length; bi += batchSize) {
        const batch = candidates.slice(bi, bi + batchSize);
        try {
          totalCalls++;
          const results = await scoreBatch(batch, systemPrompt, openaiKey);

          for (let ci = 0; ci < batch.length; ci++) {
            const candidate = batch[ci];
            const result = results[ci];
            if (!result) {
              console.log(`[warn] No score for lead ${candidate.leadId}: ${candidate.companyName}`);
              continue;
            }

            totalScored++;
            const score = result.score;
            let status = "pending_review";
            let reasoning = result.reasoning;

            if (!result.is_real_target || score < rejectBelow) {
              status = "rejected";
              reasoning = `Auto-rejected: ${reasoning}${result.reject_reason ? ` (${result.reject_reason})` : ""}`;
              totalRejected++;
            } else if (bands.qualified && score >= Math.min(...bands.qualified)) {
              totalQualified++;
            }

            await supabase.from("leads").update({
              confidence_score: score,
              score_reasoning: reasoning,
              qualification_status: status,
            }).eq("id", candidate.leadId);
          }
        } catch (err) {
          console.log(`[error] Scoring batch failed: ${err.message}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        scored: totalScored,
        qualified: totalQualified,
        rejected: totalRejected,
        calls: totalCalls,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
