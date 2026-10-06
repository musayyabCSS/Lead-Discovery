import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Lead } from '@/types';
import { navigate } from '@/lib/router';
import { Loader2, Check, X, ChevronRight, Mail, ShieldCheck, ShieldAlert } from 'lucide-react';

function ScoreBadge({ score }: { score: number }) {
  let color = 'text-slate-400 bg-slate-800 border-slate-700';
  if (score >= 9) color = 'text-emerald-400 bg-emerald-950/50 border-emerald-900';
  else if (score >= 7) color = 'text-blue-400 bg-blue-950/50 border-blue-900';
  else if (score >= 6) color = 'text-amber-400 bg-amber-950/50 border-amber-900';
  else color = 'text-red-400 bg-red-950/50 border-red-900';

  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold border ${color}`}>
      {score}
    </span>
  );
}

export function ReviewQueuePage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending_review' | 'approved' | 'rejected' | 'all'>('pending_review');

  const loadLeads = useCallback(async () => {
    let query = supabase
      .from('leads')
      .select('*, icp_config:icp_configs(*)')
      .not('company_name', 'is', null)
      .neq('company_name', '')
      .limit(100);

    if (filter !== 'all') {
      query = query.eq('qualification_status', filter);
    }

    if (filter === 'pending_review') {
      query = query.order('confidence_score', { ascending: false })
        .order('created_at', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data } = await query;
    setLeads(data || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    loadLeads();
  }, [loadLeads]);

  const handleReview = async (lead: Lead, status: 'approved' | 'rejected') => {
    await supabase
      .from('leads')
      .update({
        qualification_status: status,
        reviewed_by: user?.email || 'unknown',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', lead.id);
    loadLeads();
  };

  const filterTabs: { key: typeof filter; label: string }[] = [
    { key: 'pending_review', label: 'Pending Review' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">Review Queue</h1>
      <p className="text-slate-400 text-sm mb-6">Review and qualify discovered leads</p>

      <div className="flex gap-1 mb-6 bg-slate-900 border border-slate-800 rounded-lg p-1 inline-flex">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filter === tab.key
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
        </div>
      ) : leads.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl py-16 text-center">
          <p className="text-slate-500 text-sm">No leads in this category.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => (
            <div
              key={lead.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start gap-4">
                <ScoreBadge score={lead.confidence_score} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3
                      className="font-semibold text-white hover:text-blue-400 cursor-pointer"
                      onClick={() => navigate({ name: 'lead-detail', leadId: lead.id })}
                    >
                      {lead.company_name}
                    </h3>
                    {lead.icp_config && (
                      <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                        {lead.icp_config.name}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400">
                    {lead.contact_name} — {lead.contact_title}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-sm text-slate-400">{lead.email}</span>
                    {lead.email_verified ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                        <ShieldCheck className="w-3.5 h-3.5" /> Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                        <ShieldAlert className="w-3.5 h-3.5" /> {lead.email_verification_status}
                      </span>
                    )}
                  </div>
                  {lead.score_reasoning && (
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2">{lead.score_reasoning}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {lead.qualification_status === 'pending_review' ? (
                    <>
                      <button
                        onClick={() => handleReview(lead, 'approved')}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
                      >
                        <Check className="w-4 h-4" /> Approve
                      </button>
                      <button
                        onClick={() => handleReview(lead, 'rejected')}
                        className="flex items-center gap-1.5 bg-slate-700 hover:bg-red-900 text-slate-200 hover:text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" /> Reject
                      </button>
                    </>
                  ) : (
                    <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${
                      lead.qualification_status === 'approved'
                        ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900'
                        : lead.qualification_status === 'rejected'
                        ? 'bg-red-950/50 text-red-400 border border-red-900'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {lead.qualification_status.replace('_', ' ')}
                    </span>
                  )}
                  <button
                    onClick={() => navigate({ name: 'lead-detail', leadId: lead.id })}
                    className="p-2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
