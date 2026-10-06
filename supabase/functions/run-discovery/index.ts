import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface IcpConfig {
  id: string;
  name: string;
  owner_business: string;
  target_verticals: string[];
  exclusions: string[];
  company_size_stage: string;
  kdm_titles: string[];
  geography: string;
  signal_rotation: Record<string, string>;
  hiring_role_keywords?: string[];
  scoring_bands?: {
    strong?: number[];
    qualified?: number[];
    borderline?: number[];
    reject_below?: number;
  };
}

interface SerperResult {
  title: string;
  link: string;
  snippet: string;
  displayed_link?: string;
}

interface SerperResponse {
  organic?: SerperResult[];
}

// ── Curated site list ──────────────────────────────────────────
// Job-board domains are scoped to posting URL patterns, not whole domain.
// News/press/review sites stay at domain level.

const JOB_BOARD_PATTERNS = [
  "indeed.com/viewjob",
  "ziprecruiter.com/c/",
  "linkedin.com/jobs/view",
  "glassdoor.com/job-listing",
];

const NEWS_PRESS_SITES = [
  "prnewswire.com",
  "businesswire.com",
  "globenewswire.com",
  "crunchbase.com",
  "techcrunch.com",
  "modernhealthcare.com",
  "fiercehealthcare.com",
  "beckersasc.com",
  "beckershospitalreview.com",
  "healthcaredive.com",
  "medpagetoday.com",
];

const REVIEW_SITES = [
  "trustpilot.com",
  "g2.com",
  "bbb.org",
  "yelp.com",
];

function siteRestriction(): string {
  const parts: string[] = [];
  for (const p of JOB_BOARD_PATTERNS) parts.push(`site:${p}`);
  for (const s of [...NEWS_PRESS_SITES, ...REVIEW_SITES]) parts.push(`site:${s}`);
  return parts.join(" OR ");
}

function jobBoardSiteRestriction(): string {
  return JOB_BOARD_PATTERNS.map((p) => `site:${p}`).join(" OR ");
}

function reviewSiteRestriction(): string {
  return REVIEW_SITES.map((s) => `site:${s}`).join(" OR ");
}

function newsSiteRestriction(): string {
  return NEWS_PRESS_SITES.map((s) => `site:${s}`).join(" OR ");
}

// ── Helpers ──────────────────────────────────────────────────

function getDayKey(): string {
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return days[new Date().getDay()];
}

function parseVerticalLabel(label: string): string[] {
  const terms: string[] = [];
  const slashParts = label.split("/").map((s) => s.trim()).filter(Boolean);

  for (const part of slashParts) {
    const parenMatch = part.match(/^([^(]+)/);
    const coreTerm = parenMatch ? parenMatch[1].trim() : part.trim();
    if (coreTerm) terms.push(coreTerm);

    const parenContent = part.match(/\(([^)]+)\)/);
    if (parenContent) {
      const inner = parenContent[1];
      const dollarMatch = inner.match(/\$[\d.]+\w*/);
      if (dollarMatch) terms.push(dollarMatch[0]);
      const arrMatch = inner.match(/ARR/i);
      if (arrMatch) terms.push("ARR");
      const revenueMatch = inner.match(/revenue/i);
      if (revenueMatch) terms.push("revenue");
    }
  }
  return terms;
}

function buildGeographyClause(): string {
  return '"United States" OR "Canada" OR "United Kingdom" OR "Australia" OR "New Zealand"';
}

// Negative terms for hiring-signal queries
const HIRING_NEGATIVES = '-"jobs in" -salary -salaries -"how to" -"best" -"top 10"';

// ── Signal type definitions ────────────────────────────────────

const SIGNAL_TYPES = {
  "hiring": '"hiring" OR "job opening" OR "now hiring"',
  "funding": '"funding" OR "raised" OR "seed round" OR "Series A"',
  "reviews": '"reviews" OR "customer complaint" OR "trustpilot" OR "g2"',
  "expansion": '"expanding" OR "new location" OR "opening office" OR "growing"',
  "front-desk hiring": '"front desk" OR "receptionist" OR "patient coordinator"',
  "billing-pain reviews": '"billing" OR "insurance denial" OR "claim denial" OR "billing issues"',
  "biller/scribe hiring": '"medical biller" OR "medical scribe" OR "billing specialist"',
  "multi-location": '"multiple locations" OR "new location" OR "expanding" OR "second office"',
  "CHC/FQHC/specialty": '"FQHC" OR "community health center" OR "specialty clinic"',
} as const;

function isHiringType(signalType: string): boolean {
  return signalType.includes("hiring");
}

function isReviewType(signalType: string): boolean {
  return signalType.includes("review");
}

// ── Query construction: one signal type per query, cycle within max-8 ──

function buildQueries(config: IcpConfig, signalType: string): string[] {
  const queries: string[] = [];
  const geoClause = buildGeographyClause();
  const sitesClause = siteRestriction();

  // Parse verticals into clean terms
  const parsedVerticals: string[] = [];
  for (const v of config.target_verticals) {
    parsedVerticals.push(...parseVerticalLabel(v));
  }

  // Group verticals into pairs for narrow queries
  const pairs: string[][] = [];
  for (let i = 0; i < parsedVerticals.length; i += 2) {
    pairs.push(parsedVerticals.slice(i, i + 2));
  }

  const hiring = isHiringType(signalType);
  const review = isReviewType(signalType);

  // For hiring signals, use role keywords from config instead of generic "hiring"
  let termsStr: string;
  let isHiringQuery = false;

  if (hiring && config.hiring_role_keywords && config.hiring_role_keywords.length > 0) {
    const roleTerms = config.hiring_role_keywords.map((k) => `"${k}"`).join(" OR ");
    termsStr = roleTerms;
    isHiringQuery = true;
  } else {
    termsStr = SIGNAL_TYPES[signalType as keyof typeof SIGNAL_TYPES] || SIGNAL_TYPES["hiring"];
  }

  const negatives = isHiringQuery ? HIRING_NEGATIVES : "";

  // Build one query per vertical pair, all using the SAME signal type
  for (const pair of pairs) {
    const vQuery = pair.map((t) => `"${t}"`).join(" OR ");
    queries.push(`${termsStr} (${vQuery}) (${geoClause}) (${sitesClause})${negatives ? " " + negatives : ""}`);
    if (queries.length >= 8) break;
  }

  // Job-board-specific query for hiring signals
  if (isHiringQuery && queries.length < 8) {
    const jobSites = jobBoardSiteRestriction();
    const firstPair = pairs[0] || parsedVerticals.slice(0, 2);
    const vQuery = firstPair.map((t) => `"${t}"`).join(" OR ");
    queries.push(`${jobSites} ${termsStr} (${vQuery}) (${geoClause}) ${negatives}`);
  }

  // Review-site-specific query for review signals
  if (review && queries.length < 8) {
    const revSites = reviewSiteRestriction();
    const firstPair = pairs[0] || parsedVerticals.slice(0, 2);
    const vQuery = firstPair.map((t) => `"${t}"`).join(" OR ");
    queries.push(`${revSites} (${vQuery}) (${geoClause})`);
  }

  // News/press query for funding/expansion/multi-location signals
  if ((signalType === "funding" || signalType === "expansion" || signalType === "multi-location") && queries.length < 8) {
    const newsSites = newsSiteRestriction();
    const firstPair = pairs[0] || parsedVerticals.slice(0, 2);
    const vQuery = firstPair.map((t) => `"${t}"`).join(" OR ");
    const newsTerms = SIGNAL_TYPES[signalType as keyof typeof SIGNAL_TYPES] || termsStr;
    queries.push(`${newsSites} ${newsTerms} (${vQuery}) (${geoClause})`);
  }

  // If we still have budget, add a second signal type (funding or expansion)
  // to get more coverage without mixing in the same query
  if (queries.length < 8) {
    const secondaryType = hiring ? "funding" : "expansion";
    const secondaryTerms = SIGNAL_TYPES[secondaryType as keyof typeof SIGNAL_TYPES];
    const firstPair = pairs[0] || parsedVerticals.slice(0, 2);
    const vQuery = firstPair.map((t) => `"${t}"`).join(" OR ");
    if (hiring) {
      // For funding, use news sites
      const newsSites = newsSiteRestriction();
      queries.push(`${newsSites} ${secondaryTerms} (${vQuery}) (${geoClause})`);
    } else {
      queries.push(`${secondaryTerms} (${vQuery}) (${geoClause}) (${sitesClause})`);
    }
  }

  // Third signal type if still under budget
  if (queries.length < 8) {
    const tertiaryType = hiring ? "expansion" : "funding";
    const tertiaryTerms = SIGNAL_TYPES[tertiaryType as keyof typeof SIGNAL_TYPES];
    const firstPair = pairs.length > 1 ? pairs[1] : pairs[0] || parsedVerticals.slice(0, 2);
    const vQuery = firstPair.map((t) => `"${t}"`).join(" OR ");
    queries.push(`${tertiaryTerms} (${vQuery}) (${geoClause}) (${sitesClause})`);
  }

  return queries.slice(0, 8);
}

// ── Exclusion matching ─────────────────────────────────────────

function isNameExclusion(exclusion: string): boolean {
  const lower = exclusion.toLowerCase();
  const stageSizePatterns = [
    /series\s*[a-z]/,
    /\d+\+?\s*employee/,
    /seed\s*round/,
    /pre-?seed/,
    /bootstrapped/,
    /\$[\d.]+\s*[mb]/,
    /arr\s*[<>]/,
    /revenue\s*band/,
    /existing\s+head\s+of/,
    /head\s+of\s+support/,
    /non-five-eyes/,
    /no\s+us\s+operations/,
  ];
  return !stageSizePatterns.some((p) => p.test(lower));
}

function matchesExclusion(
  companyName: string,
  snippet: string,
  exclusions: string[]
): boolean {
  const companyLower = companyName.toLowerCase();
  const snippetLower = snippet.toLowerCase();
  for (const ex of exclusions) {
    const exLower = ex.toLowerCase();
    if (isNameExclusion(ex)) {
      if (companyLower.includes(exLower)) return true;
    } else {
      if (snippetLower.includes(exLower)) return true;
    }
  }
  return false;
}

// ── Deterministic filter: title and URL rejection ──────────────

const AGGREGATOR_TITLE_PATTERNS: RegExp[] = [
  /^\d+\+?\s+jobs/i,
  /^now hiring:/i,
  /jobs in/i,
  /salary|salaries/i,
  /how much/i,
  /average/i,
  /career advice/i,
  /top \d+/i,
  /best /i,
  /guide/i,
  /what is/i,
];

const AGGREGATOR_URL_PATTERNS: RegExp[] = [
  /\/salaries/i,
  /\/salary/i,
  /\/career-advice/i,
  /\/jobs-in-/i,
  /\/q-/i,
  /\/jobs\?q=/i,
  /\/browse/i,
  /\/categories/i,
];

// LinkedIn people/posts/pulse — not companies
const LINKEDIN_NON_COMPANY_URL_PATTERNS: RegExp[] = [
  /linkedin\.com\/in\//i,
  /linkedin\.com\/posts\//i,
  /linkedin\.com\/pulse\//i,
];

// Med Bills hiring rejection patterns
const MED_BILLS_HIRING_REJECT_PATTERNS: RegExp[] = [
  /locum/i,
  /locums/i,
  /per diem physician/i,
  /ai training/i,
];

function isAggregatorTitle(title: string): boolean {
  return AGGREGATOR_TITLE_PATTERNS.some((p) => p.test(title));
}

function isAggregatorUrl(url: string): boolean {
  return AGGREGATOR_URL_PATTERNS.some((p) => p.test(url));
}

function isNonCompanyUrl(url: string): boolean {
  return LINKEDIN_NON_COMPANY_URL_PATTERNS.some((p) => p.test(url));
}

// ── Company name extraction ────────────────────────────────────

const TRAILING_BRAND_SUFFIXES = [
  " - indeed.com",
  " | indeed.com",
  " - ziprecruiter",
  " | ziprecruiter",
  " | linkedin",
  " - linkedin",
  " - glassdoor",
  " | glassdoor",
  " - trustpilot",
  " | trustpilot",
  " - g2",
  " | g2",
  " - bbb.org",
  " | bbb.org",
  " - yelp",
  " | yelp",
  " - prnewswire",
  " | prnewswire",
  " - businesswire",
  " | businesswire",
  " - globenewswire",
  " | globenewswire",
  " - crunchbase",
  " | crunchbase",
];

const KNOWN_AGGREGATORS = new Set([
  "indeed", "ziprecruiter", "linkedin", "glassdoor",
  "trustpilot", "g2", "bbb", "yelp", "google",
  "prnewswire", "businesswire", "globenewswire",
  "crunchbase", "techcrunch", "modernhealthcare",
  "fiercehealthcare", "beckersasc", "beckershospitalreview",
  "healthcaredive", "medpagetoday",
]);

// Stoplist of generic words that must never be a company name
const COMPANY_STOPWORDS = new Set([
  "remote", "good", "with", "must", "they", "patient", "patients",
  "this", "that", "final", "posted", "requirements", "provide",
  "identify", "get", "single", "depth", "familiarity", "contracts",
  "united states", "canada", "hiring", "jobs", "job", "career",
  "careers", "employment", "opportunity", "opportunities",
  "application", "apply", "search", "results", "home", "about",
  "contact", "help", "support", "login", "sign", "sign up",
]);

// Job-title words that indicate the extracted text is a role, not a company
const JOB_TITLE_WORDS: RegExp[] = [
  /\bmanager\b/i,
  /\bdirector\b/i,
  /\bspecialist\b/i,
  /\bengineer\b/i,
  /\bphysician\b/i,
  /\bexpert\b/i,
  /\bevaluator\b/i,
  /\bcoordinator\b/i,
  /\bnurse\b/i,
  /\banalyst\b/i,
  /\bassociate\b/i,
  /\bassistant\b/i,
  /\brepresentative\b/i,
  /\bscientist\b/i,
  /\bliaison\b/i,
];

function stripTrailingBrand(text: string): string {
  let result = text;
  for (const suffix of TRAILING_BRAND_SUFFIXES) {
    if (result.toLowerCase().endsWith(suffix)) {
      result = result.slice(0, -suffix.length).trim();
      break;
    }
  }
  return result;
}

function titleCase(s: string): string {
  return s.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function slugToName(slug: string): string {
  const cleaned = slug
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 2 || cleaned.length > 80) return "";
  return titleCase(cleaned);
}

function isCredibleCompanyName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 80) return false;

  // Reject single generic words
  if (COMPANY_STOPWORDS.has(trimmed.toLowerCase())) return false;

  // Reject if it contains a job-title word
  if (JOB_TITLE_WORDS.some((p) => p.test(trimmed))) return false;

  // Reject single-word names that are too short (likely junk)
  const words = trimmed.split(/\s+/);
  if (words.length === 1 && trimmed.length < 3) return false;

  return true;
}

function extractCompany(result: SerperResult): string | null {
  const title = stripTrailingBrand(result.title || "");
  const url = result.link || "";

  // (a) Title patterns
  // "Role - Company - Location"
  const dashParts = title.split(" - ");
  if (dashParts.length >= 3) {
    const candidate = dashParts[dashParts.length - 2].trim();
    if (isCredibleCompanyName(candidate)) return candidate;
  }
  // "Role at Company"
  const atMatch = title.match(/\bat\s+(.+?)(?:\s*[-|]|\s*$)/i);
  if (atMatch) {
    const candidate = atMatch[1].trim();
    if (isCredibleCompanyName(candidate)) return candidate;
  }
  // "Company is hiring ..."
  const hiringMatch = title.match(/^(.+?)\s+is\s+hiring/i);
  if (hiringMatch) {
    const candidate = hiringMatch[1].trim();
    if (isCredibleCompanyName(candidate)) return candidate;
  }
  // "Company hiring Role" (e.g. "ABC Clinic hiring Front Desk Coordinator")
  const hiringRoleMatch = title.match(/^(.+?)\s+hiring\b/i);
  if (hiringRoleMatch) {
    const candidate = hiringRoleMatch[1].trim();
    if (isCredibleCompanyName(candidate)) return candidate;
  }
  // "Company announces ..."
  const announcesMatch = title.match(/^(.+?)\s+(?:announces|launches|opens|expands|raises)/i);
  if (announcesMatch) {
    const candidate = announcesMatch[1].trim();
    if (isCredibleCompanyName(candidate)) return candidate;
  }

  // (b) URL slug patterns
  // indeed.com/cmp/Company-Name
  const indeedCmpMatch = url.match(/indeed\.com\/cmp\/([^/?#]+)/i);
  if (indeedCmpMatch) {
    const name = slugToName(indeedCmpMatch[1]);
    if (name && isCredibleCompanyName(name)) return name;
  }
  // ziprecruiter.com/c/Company-Name/Job/...
  const zipCMatch = url.match(/ziprecruiter\.com\/c\/([^/?#]+)/i);
  if (zipCMatch) {
    const name = slugToName(zipCMatch[1]);
    if (name && isCredibleCompanyName(name)) return name;
  }
  // linkedin.com/company/slug
  const liCompanyMatch = url.match(/linkedin\.com\/company\/([^/?#]+)/i);
  if (liCompanyMatch) {
    const name = slugToName(liCompanyMatch[1]);
    if (name && isCredibleCompanyName(name)) return name;
  }
  // linkedin.com/jobs/view/<role-slug>-at-<company-slug>-<numeric id>
  // Take text after the LAST "-at-", drop trailing numeric id
  const liJobMatch = url.match(/linkedin\.com\/jobs\/view\/([^?#]+)/i);
  if (liJobMatch) {
    const slug = liJobMatch[1];
    // Find the last "-at-" segment
    const atSegments = slug.split(/-at-/i);
    if (atSegments.length >= 2) {
      // Everything after the last "-at-"
      let companySlug = atSegments[atSegments.length - 1];
      // Strip trailing numeric id (e.g. "-4012345")
      companySlug = companySlug.replace(/-\d+$/, "");
      const name = slugToName(companySlug);
      if (name && isCredibleCompanyName(name)) return name;
    }
  }
  // glassdoor.com/job-listing/ — try slug
  const glassdoorMatch = url.match(/glassdoor\.com\/job-listing\/([^/?#]+)/i);
  if (glassdoorMatch) {
    const name = slugToName(glassdoorMatch[1]);
    if (name && isCredibleCompanyName(name)) return name;
  }

  // Fallback to domain name if it's not a known aggregator
  const domain = result.displayed_link || extractDomain(url);
  if (domain) {
    const parts = domain.replace(/^www\./, "").split(".");
    if (parts.length >= 2) {
      const name = parts[0];
      if (name && name.length > 2 && !KNOWN_AGGREGATORS.has(name.toLowerCase())) {
        const candidate = titleCase(name);
        if (isCredibleCompanyName(candidate)) return candidate;
      }
    }
  }

  // No snippet fallback — if nothing credible from title or URL, reject
  return null;
}

function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// ── Hiring role keyword filter ─────────────────────────────────

function containsHiringRoleKeyword(
  text: string,
  roleKeywords: string[]
): boolean {
  const lower = text.toLowerCase();
  return roleKeywords.some((kw) => lower.includes(kw.toLowerCase()));
}

function isMedBillsHiringReject(text: string): boolean {
  return MED_BILLS_HIRING_REJECT_PATTERNS.some((p) => p.test(text));
}

// ── Dedup: normalize company names and canonicalize URLs ───────

const COMPANY_SUFFIXES = /\s+(inc|llc|pc|pllc|ltd|corp|co|llp|lp|pa|group|holdings|partners|clinic|center|centre|associates|practice|services|health|care|medical|group)\b\.?$/i;

function normalizeCompanyName(name: string): string {
  let s = name.toLowerCase().trim();
  s = s.replace(/[.,;:'"!?&*()]/g, "");
  s = s.replace(COMPANY_SUFFIXES, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function canonicalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url.split("?")[0].split("#")[0];
  }
}

// ── Serper.dev API call ────────────────────────────────────────

async function searchSerper(
  query: string,
  apiKey: string
): Promise<SerperResult[]> {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num: 10, gl: "us", tbs: "qdr:m" }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Serper API error (${response.status}): ${errorBody.slice(0, 500)}`);
  }

  const data: SerperResponse = await response.json();
  return data.organic || [];
}

// ── Logger ─────────────────────────────────────────────────────

async function log(
  supabase: ReturnType<typeof createClient>,
  runId: string,
  level: string,
  message: string
) {
  console.log(`[${level}] ${message}`);
  await supabase.from("run_logs").insert({
    run_id: runId,
    log_level: level,
    message: message.slice(0, 5000),
  });
}

// ── LLM scoring via OpenAI ─────────────────────────────────────

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

function buildScoringSystemPrompt(config: IcpConfig): string {
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

// ── Main handler ──────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { icp_config_id, triggered_by } = await req.json();

    const { data: config, error: configError } = await supabase
      .from("icp_configs")
      .select("*")
      .eq("id", icp_config_id)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: "ICP config not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: run, error: runError } = await supabase
      .from("runs")
      .insert({
        icp_config_id,
        triggered_by: triggered_by || "manual",
        status: "running",
        started_at: new Date().toISOString(),
        signals_found: 0,
        candidates_found: 0,
      })
      .select()
      .single();

    if (runError) {
      return new Response(
        JSON.stringify({ error: runError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const runId = run.id;
    const apiKey = Deno.env.get("SERPER_API_KEY");

    await log(supabase, runId, "info", `SERPER_API_KEY present: ${!!apiKey}, length: ${apiKey?.length || 0}`);

    if (!apiKey) {
      await log(supabase, runId, "error", "SERPER_API_KEY is missing — cannot search");
      await supabase.from("runs").update({
        status: "failed",
        finished_at: new Date().toISOString(),
      }).eq("id", runId);
      return new Response(
        JSON.stringify({ error: "SERPER_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dayKey = getDayKey();
    const signalType = config.signal_rotation?.[dayKey] || "mixed";
    await log(supabase, runId, "info", `Day key: ${dayKey}, Signal type: ${signalType}`);
    await log(supabase, runId, "info", `Config: ${config.name}, owner: ${config.owner_business}`);
    await log(supabase, runId, "info", `Verticals (raw): ${JSON.stringify(config.target_verticals)}`);
    const parsedVerticals = config.target_verticals.map(parseVerticalLabel);
    await log(supabase, runId, "info", `Verticals (parsed): ${JSON.stringify(parsedVerticals)}`);
    await log(supabase, runId, "info", `Exclusions: ${JSON.stringify(config.exclusions)}`);
    await log(supabase, runId, "info", `Geography: ${config.geography} → using Five Eyes clause`);
    if (config.hiring_role_keywords) {
      await log(supabase, runId, "info", `Hiring role keywords: ${JSON.stringify(config.hiring_role_keywords)}`);
    }

    const queries = buildQueries(config as IcpConfig, signalType);
    await log(supabase, runId, "info", `Built ${queries.length} queries:`);
    for (let i = 0; i < queries.length; i++) {
      await log(supabase, runId, "info", `  Query ${i + 1}: ${queries[i]}`);
    }

    // Dedup tracking
    const seenCanonicalUrls = new Set<string>();
    const seenCompanySignalPairs = new Set<string>();
    let totalIn = 0;
    let rejAggregatorTitle = 0;
    let rejAggregatorUrl = 0;
    let rejNoCompany = 0;
    let rejBadCompany = 0;
    let rejNoRoleKeyword = 0;
    let rejDuplicate = 0;
    let rejExclusion = 0;
    let keptSignals = 0;
    let keptCandidates = 0;
    const scoreCandidates: ScoreCandidate[] = [];

    const hiringRoleKeywords: string[] = config.hiring_role_keywords || [];
    const isHiringRun = isHiringType(signalType);
    const isMedBills = config.owner_business === "Med Bills";

    // Fetch existing leads for this ICP config from last 90 days for dedup
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: existingLeads } = await supabase
      .from("leads")
      .select("company_name")
      .eq("icp_config_id", icp_config_id)
      .gte("created_at", ninetyDaysAgo);

    const existingCompanyNames = new Set<string>();
    if (existingLeads) {
      for (const lead of existingLeads) {
        if (lead.company_name) {
          existingCompanyNames.add(normalizeCompanyName(lead.company_name));
        }
      }
    }

    for (let qi = 0; qi < queries.length; qi++) {
      const query = queries[qi];
      await log(supabase, runId, "info", `Processing query ${qi + 1}/${queries.length} via Serper.dev`);

      let results: SerperResult[] = [];
      try {
        results = await searchSerper(query, apiKey);
        await log(supabase, runId, "info", `Query ${qi + 1} returned ${results.length} organic results from Serper`);

        if (results.length > 0) {
          for (const r of results.slice(0, 3)) {
            await log(supabase, runId, "info", `  Result: title="${r.title?.slice(0, 100)}", link=${r.link?.slice(0, 80)}, displayed_link=${r.displayed_link || "n/a"}`);
          }
        }
      } catch (err) {
        await log(supabase, runId, "error", `Serper search FAILED for query ${qi + 1}: ${err.message}`);
        continue;
      }

      for (const result of results) {
        totalIn++;
        const title = result.title || "";
        const url = result.link || "";

        // Filter: aggregator title
        if (isAggregatorTitle(title)) {
          rejAggregatorTitle++;
          continue;
        }

        // Filter: aggregator URL
        if (isAggregatorUrl(url)) {
          rejAggregatorUrl++;
          continue;
        }

        // Filter: LinkedIn non-company URLs (people, posts, pulse)
        if (isNonCompanyUrl(url)) {
          rejBadCompany++;
          continue;
        }

        // Dedup: canonical URL
        const canonicalUrl = canonicalizeUrl(url);
        if (seenCanonicalUrls.has(canonicalUrl)) {
          rejDuplicate++;
          continue;
        }

        // Company name extraction
        const companyName = extractCompany(result);
        if (!companyName) {
          rejNoCompany++;
          continue;
        }

        // Sanity check on extracted company (catches stoplist/junk that slipped through)
        if (!isCredibleCompanyName(companyName)) {
          rejBadCompany++;
          continue;
        }

        // Dedup: normalized company + signal type within this run
        const normalizedCompany = normalizeCompanyName(companyName);
        const companySignalKey = `${normalizedCompany}::${signalType}`;
        if (seenCompanySignalPairs.has(companySignalKey)) {
          rejDuplicate++;
          continue;
        }

        // Dedup: company already in leads for this ICP config in last 90 days
        if (existingCompanyNames.has(normalizedCompany)) {
          rejDuplicate++;
          continue;
        }

        const snippetText = `${title}\n${result.snippet || ""}`;

        // Hiring role keyword filter: for hiring signals, require at least one role keyword in title or snippet
        if (isHiringRun && hiringRoleKeywords.length > 0) {
          if (!containsHiringRoleKeyword(snippetText, hiringRoleKeywords)) {
            rejNoRoleKeyword++;
            continue;
          }
          // Med Bills specific hiring rejections
          if (isMedBills && isMedBillsHiringReject(snippetText)) {
            rejNoRoleKeyword++;
            continue;
          }
        }

        // Exclusion check
        if (matchesExclusion(companyName, snippetText, config.exclusions)) {
          rejExclusion++;
          continue;
        }

        // Passed all filters — record it
        seenCanonicalUrls.add(canonicalUrl);
        seenCompanySignalPairs.add(companySignalKey);
        existingCompanyNames.add(normalizedCompany);

        const { data: signalRow } = await supabase
          .from("signals")
          .insert({
            run_id: runId,
            signal_type: signalType,
            source_url: url,
            raw_snippet: snippetText,
            discovered_company_name: companyName,
            is_candidate: true,
          })
          .select()
          .single();

        keptSignals++;

        if (signalRow) {
          const { data: leadRow } = await supabase.from("leads").insert({
            run_id: runId,
            icp_config_id,
            company_name: companyName,
            contact_name: "",
            contact_title: "",
            email: "",
            email_verified: false,
            email_verification_status: "unverified",
            source_signal_id: signalRow.id,
            confidence_score: 0,
            score_reasoning: "",
            qualification_status: "pending_review",
          }).select().single();

          keptCandidates++;

          if (leadRow) {
            scoreCandidates.push({
              leadId: leadRow.id,
              companyName,
              signalType,
              title,
              snippet: result.snippet || "",
              sourceUrl: url,
            });
          }
        }

        if (keptSignals % 5 === 0) {
          await supabase.from("runs").update({
            signals_found: keptSignals,
            candidates_found: keptCandidates,
            leads_found: keptCandidates,
          }).eq("id", runId);
        }
      }
    }

    // Filter summary log
    await log(supabase, runId, "info",
      `Filter: ${totalIn} in, ${rejAggregatorTitle} aggregator-title, ${rejAggregatorUrl} aggregator-url, ${rejNoCompany} no-company, ${rejBadCompany} bad-company, ${rejNoRoleKeyword} no-role-keyword, ${rejDuplicate} duplicate, ${rejExclusion} exclusion, ${keptSignals} kept`
    );

    await log(supabase, runId, "info", `Pipeline complete. Total signals: ${keptSignals}, candidates: ${keptCandidates}`);

    // ── LLM scoring phase ──────────────────────────────────────
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const bands = (config as IcpConfig).scoring_bands || {};
    const qualifiedBand = bands.qualified ? Math.min(...bands.qualified) : 7;
    const rejectBelow = bands.reject_below ?? 6;

    let scoredCount = 0;
    let strongCount = 0;
    let qualifiedCount = 0;
    let borderlineCount = 0;
    let rejectedCount = 0;
    let scoringCalls = 0;

    const candidatesToScore = scoreCandidates.slice(0, 40);

    if (openaiKey && candidatesToScore.length > 0) {
      await log(supabase, runId, "info", `Starting LLM scoring for ${candidatesToScore.length} candidates (cap 40)`);
      const systemPrompt = buildScoringSystemPrompt(config as IcpConfig);
      const batchSize = 8;

      for (let bi = 0; bi < candidatesToScore.length; bi += batchSize) {
        const batch = candidatesToScore.slice(bi, bi + batchSize);
        try {
          scoringCalls++;
          const results = await scoreBatch(batch, systemPrompt, openaiKey);

          for (let ci = 0; ci < batch.length; ci++) {
            const candidate = batch[ci];
            const result = results[ci];
            if (!result) {
              await log(supabase, runId, "warn", `No score returned for candidate ${ci} in batch ${scoringCalls}: ${candidate.companyName}`);
              continue;
            }

            scoredCount++;
            const score = result.score;
            let status = "pending_review";
            let reasoning = result.reasoning;

            if (!result.is_real_target || score < rejectBelow) {
              status = "rejected";
              reasoning = `Auto-rejected: ${reasoning}${result.reject_reason ? ` (${result.reject_reason})` : ""}`;
              rejectedCount++;
            } else if (bands.strong && score >= Math.min(...bands.strong)) {
              strongCount++;
            } else if (bands.qualified && score >= Math.min(...bands.qualified)) {
              qualifiedCount++;
            } else if (bands.borderline && score >= Math.min(...bands.borderline)) {
              borderlineCount++;
            }

            await supabase.from("leads").update({
              confidence_score: score,
              score_reasoning: reasoning,
              qualification_status: status,
            }).eq("id", candidate.leadId);
          }
        } catch (err) {
          await log(supabase, runId, "error", `OpenAI scoring batch ${scoringCalls} failed: ${err.message}`);
        }
      }

      await log(supabase, runId, "info",
        `Scoring: ${scoredCount} scored, ${strongCount} strong, ${qualifiedCount} qualified, ${borderlineCount} borderline, ${rejectedCount} rejected, calls=${scoringCalls}`
      );
    } else if (!openaiKey) {
      await log(supabase, runId, "warn", "OPENAI_API_KEY not configured — skipping LLM scoring");
    }

    await supabase.from("runs").update({
      status: "complete",
      finished_at: new Date().toISOString(),
      signals_found: keptSignals,
      candidates_found: keptCandidates,
      leads_found: keptCandidates,
      leads_qualified: strongCount + qualifiedCount,
    }).eq("id", runId);

    return new Response(
      JSON.stringify({ run_id: runId, status: "complete", signals_found: keptSignals, candidates_found: keptCandidates }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
