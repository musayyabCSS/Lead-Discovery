import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Run, IcpConfig } from '@/types';
import { Play, Loader2, CheckCircle2, XCircle, Search } from 'lucide-react';

const statusConfig = {
  running: { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-950/50', border: 'border-blue-900', label: 'Running', spin: true },
  complete: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-950/50', border: 'border-emerald-900', label: 'Complete', spin: false },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-950/50', border: 'border-red-900', label: 'Failed', spin: false },
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export function DashboardPage() {
  const [icpConfigs, setIcpConfigs] = useState<IcpConfig[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningConfig, setRunningConfig] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [{ data: configs }, { data: runsData }] = await Promise.all([
      supabase.from('icp_configs').select('*').order('created_at'),
      supabase.from('runs').select('*, icp_config:icp_configs(*)').order('started_at', { ascending: false }).limit(50),
    ]);
    setIcpConfigs(configs || []);
    setRuns(runsData || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleRun = async (configId: string) => {
    setRunningConfig(configId);
    try {
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-discovery`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.session?.access_token}`,
          },
          body: JSON.stringify({ icp_config_id: configId, triggered_by: 'manual' }),
        }
      );
      if (!response.ok) throw new Error('Failed to start run');
      loadData();
    } catch (err) {
      console.error('Run failed:', err);
    } finally {
      setRunningConfig(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    );
  }

  const activeRun = runs.find((r) => r.status === 'running');

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
      <p className="text-slate-400 text-sm mb-8">Discovery runs across ICP configurations</p>

      {/* Live search progress banner */}
      {activeRun && (
        <div className="bg-blue-950/40 border border-blue-900 rounded-xl p-4 mb-8 flex items-center gap-4">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-blue-900/50">
            <Search className="w-5 h-5 text-blue-400 animate-pulse" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-200">
              Searching for {activeRun.icp_config?.name}...
            </p>
            <p className="text-xs text-blue-400/70 mt-0.5">
              Found {activeRun.signals_found} signal{activeRun.signals_found !== 1 ? 's' : ''}, {activeRun.candidates_found} candidate{activeRun.candidates_found !== 1 ? 's' : ''} so far
            </p>
          </div>
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
        </div>
      )}

      {/* ICP Config cards with Run Now */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        {icpConfigs.map((config) => {
          const isThisConfigRunning = activeRun?.icp_config_id === config.id;
          return (
            <div key={config.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-white text-lg">{config.name}</h3>
                  <p className="text-sm text-slate-400">{config.owner_business}</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${config.is_active ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900' : 'bg-slate-800 text-slate-500'}`}>
                  {config.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {config.target_verticals.slice(0, 4).map((v) => (
                  <span key={v} className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                    {v}
                  </span>
                ))}
                {config.target_verticals.length > 4 && (
                  <span className="text-xs text-slate-500">+{config.target_verticals.length - 4} more</span>
                )}
              </div>
              {isThisConfigRunning && (
                <div className="mb-3 text-xs text-blue-400 flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Run in progress — {activeRun!.signals_found} signals, {activeRun!.candidates_found} candidates
                </div>
              )}
              <button
                onClick={() => handleRun(config.id)}
                disabled={runningConfig === config.id || isThisConfigRunning}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {runningConfig === config.id ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Starting...</>
                ) : isThisConfigRunning ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Running...</>
                ) : (
                  <><Play className="w-4 h-4" /> Run now</>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Runs table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="font-semibold text-white">Recent Runs</h2>
        </div>
        {runs.length === 0 ? (
          <div className="px-5 py-16 text-center text-slate-500 text-sm">
            No runs yet. Click "Run now" on an ICP config to start.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="text-left font-medium px-5 py-3">ICP Config</th>
                  <th className="text-left font-medium px-5 py-3">Trigger</th>
                  <th className="text-left font-medium px-5 py-3">Status</th>
                  <th className="text-left font-medium px-5 py-3">Started</th>
                  <th className="text-left font-medium px-5 py-3">Finished</th>
                  <th className="text-right font-medium px-5 py-3">Signals</th>
                  <th className="text-right font-medium px-5 py-3">Candidates</th>
                  <th className="text-right font-medium px-5 py-3">Qualified</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const sc = statusConfig[run.status];
                  const StatusIcon = sc.icon;
                  return (
                    <tr key={run.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5 text-sm text-white font-medium">
                        {run.icp_config?.name || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-400 capitalize">{run.triggered_by}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${sc.bg} ${sc.color} ${sc.border} border`}>
                          <StatusIcon className={`w-3 h-3 ${sc.spin ? 'animate-spin' : ''}`} />
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-400">{formatDate(run.started_at)}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-400">{formatDate(run.finished_at)}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-300 text-right tabular-nums">{run.signals_found ?? 0}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-300 text-right tabular-nums">{run.candidates_found ?? 0}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-300 text-right tabular-nums">{run.leads_qualified}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
