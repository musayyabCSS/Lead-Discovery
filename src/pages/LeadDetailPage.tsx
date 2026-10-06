import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Lead, Signal } from '@/types';
import { navigate } from '@/lib/router';
import { Loader2, ArrowLeft, Check, X, ExternalLink, Mail, ShieldCheck, ShieldAlert, Link2, FileText } from 'lucide-react';

export function LeadDetailPage({ leadId }: { leadId: string }) {
  const { user } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('leads')
        .select('*, icp_config:icp_configs(*)')
        .eq('id', leadId)
        .maybeSingle();

      if (data) {
        setLead(data as Lead);
        if (data.source_signal_id) {
          const { data: sig } = await supabase
            .from('signals')
            .select('*')
            .eq('id', data.source_signal_id)
            .maybeSingle();
          setSignal(sig as Signal);
        }
      }
      setLoading(false);
    })();
  }, [leadId]);

  const handleReview = async (status: 'approved' | 'rejected') => {
    if (!lead) return;
    await supabase
      .from('leads')
      .update({
        qualification_status: status,
        reviewed_by: user?.email || 'unknown',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', lead.id);
    setLead({ ...lead, qualification_status: status, reviewed_by: user?.email || 'unknown', reviewed_at: new Date().toISOString() });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="py-20 text-center">
        <p className="text-slate-400 mb-4">Lead not found.</p>
        <button onClick={() => navigate({ name: 'review-queue' })} className="text-blue-400 hover:text-blue-300 text-sm">
          Back to Review Queue
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => navigate({ name: 'review-queue' })}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Review Queue
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead info */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-white mb-1">{lead.company_name}</h1>
              <p className="text-sm text-slate-400">{lead.icp_config?.name || '—'}</p>
            </div>
            <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${
              lead.qualification_status === 'approved'
                ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900'
                : lead.qualification_status === 'rejected'
                ? 'bg-red-950/50 text-red-400 border border-red-900'
                : 'bg-amber-950/50 text-amber-400 border border-amber-900'
            }`}>
              {lead.qualification_status.replace('_', ' ')}
            </span>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wide">Contact</label>
                <p className="text-sm text-slate-200 mt-1">{lead.contact_name}</p>
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wide">Title</label>
                <p className="text-sm text-slate-200 mt-1">{lead.contact_title}</p>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wide">Email</label>
              <div className="flex items-center gap-2 mt-1">
                <Mail className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-200">{lead.email}</span>
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wide">Confidence Score</label>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold border ${
                    lead.confidence_score >= 9
                      ? 'text-emerald-400 bg-emerald-950/50 border-emerald-900'
                      : lead.confidence_score >= 7
                      ? 'text-blue-400 bg-blue-950/50 border-blue-900'
                      : 'text-amber-400 bg-amber-950/50 border-amber-900'
                  }`}>
                    {lead.confidence_score}
                  </span>
                  <span className="text-xs text-slate-500">out of 10</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wide">Exported</label>
                <p className="text-sm text-slate-200 mt-1">{lead.exported_to_sheet ? 'Yes' : 'No'}</p>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wide">Score Reasoning</label>
              <p className="text-sm text-slate-300 mt-1 leading-relaxed">{lead.score_reasoning || '—'}</p>
            </div>

            {lead.reviewed_by && (
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wide">Reviewed By</label>
                <p className="text-sm text-slate-200 mt-1">
                  {lead.reviewed_by} — {lead.reviewed_at ? new Date(lead.reviewed_at).toLocaleString() : ''}
                </p>
              </div>
            )}
          </div>

          {lead.qualification_status === 'pending_review' && (
            <div className="flex gap-3 mt-6 pt-6 border-t border-slate-800">
              <button
                onClick={() => handleReview('approved')}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
              >
                <Check className="w-4 h-4" /> Approve
              </button>
              <button
                onClick={() => handleReview('rejected')}
                className="flex items-center gap-2 bg-slate-700 hover:bg-red-900 text-slate-200 hover:text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" /> Reject
              </button>
            </div>
          )}
        </div>

        {/* Source signal */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Link2 className="w-4 h-4 text-slate-400" /> Source Signal
          </h2>

          {signal ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wide">Signal Type</label>
                <p className="text-sm text-slate-200 mt-1">{signal.signal_type}</p>
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wide">Discovered Company</label>
                <p className="text-sm text-slate-200 mt-1">{signal.discovered_company_name}</p>
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wide">Source URL</label>
                <a
                  href={signal.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 mt-1 break-all"
                >
                  <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                  {signal.source_url}
                </a>
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Raw Snippet
                </label>
                <div className="mt-1 bg-slate-950 border border-slate-800 rounded-lg p-4 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-mono">
                  {signal.raw_snippet || '—'}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wide">Discovered</label>
                <p className="text-sm text-slate-200 mt-1">
                  {new Date(signal.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-8 text-center">No source signal linked to this lead.</p>
          )}
        </div>
      </div>
    </div>
  );
}
