import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { IcpConfig } from '@/types';
import { Loader2, Save, Plus, X } from 'lucide-react';

const days = ['mon', 'tue', 'wed', 'thu', 'fri'];
const dayLabels: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday',
};

function ArrayInput({
  label, values, onChange, placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState('');

  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInput('');
  };

  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={add}
          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {values.map((v, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded">
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((_, idx) => idx !== i))}
                className="text-slate-500 hover:text-red-400"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function IcpConfigsPage() {
  const [configs, setConfigs] = useState<IcpConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  // Edit form state
  const [form, setForm] = useState<IcpConfig | null>(null);

  const loadConfigs = useCallback(async () => {
    const { data } = await supabase.from('icp_configs').select('*').order('created_at');
    setConfigs(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const startEdit = (config: IcpConfig) => {
    setEditingId(config.id);
    setForm({ ...config });
    setSavedMsg(false);
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    const { id, created_at, ...updateData } = form;
    await supabase.from('icp_configs').update(updateData).eq('id', id);
    setSaving(false);
    setSavedMsg(true);
    loadConfigs();
    setTimeout(() => setSavedMsg(false), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    );
  }

  if (editingId && form) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Edit ICP Config</h1>
            <p className="text-slate-400 text-sm">{form.name}</p>
          </div>
          <div className="flex items-center gap-3">
            {savedMsg && <span className="text-sm text-emerald-400">Saved successfully</span>}
            <button
              onClick={() => { setEditingId(null); setForm(null); }}
              className="px-4 py-2 text-slate-300 hover:text-white text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save changes
            </button>
          </div>
        </div>

        <div className="space-y-6 max-w-3xl">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Config Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Owner Business</label>
                <select
                  value={form.owner_business}
                  onChange={(e) => setForm({ ...form, owner_business: e.target.value as 'CSS' | 'Med Bills' })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="CSS">CSS</option>
                  <option value="Med Bills">Med Bills</option>
                </select>
              </div>
            </div>

            <ArrayInput
              label="Target Verticals"
              values={form.target_verticals}
              onChange={(v) => setForm({ ...form, target_verticals: v })}
              placeholder="e.g. eCommerce/DTC"
            />
            <ArrayInput
              label="Exclusions"
              values={form.exclusions}
              onChange={(v) => setForm({ ...form, exclusions: v })}
              placeholder="e.g. Series B+"
            />
            <ArrayInput
              label="KDM Titles"
              values={form.kdm_titles}
              onChange={(v) => setForm({ ...form, kdm_titles: v })}
              placeholder="e.g. Founder, CEO"
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Company Size / Stage</label>
                <input
                  type="text"
                  value={form.company_size_stage}
                  onChange={(e) => setForm({ ...form, company_size_stage: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Geography</label>
                <input
                  type="text"
                  value={form.geography}
                  onChange={(e) => setForm({ ...form, geography: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email Requirement</label>
              <textarea
                value={form.email_requirement}
                onChange={(e) => setForm({ ...form, email_requirement: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          {/* Signal Rotation */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="font-semibold text-white mb-4">Signal Rotation</h3>
            <div className="space-y-3">
              {days.map((day) => (
                <div key={day} className="flex items-center gap-4">
                  <span className="text-sm text-slate-400 w-24">{dayLabels[day]}</span>
                  <input
                    type="text"
                    value={form.signal_rotation[day] || ''}
                    onChange={(e) => setForm({
                      ...form,
                      signal_rotation: { ...form.signal_rotation, [day]: e.target.value },
                    })}
                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. funding, hiring, reviews"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Scoring Bands */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="font-semibold text-white mb-4">Scoring Bands</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Strong (min-max)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={form.scoring_bands.strong?.[0] ?? ''}
                      onChange={(e) => setForm({
                        ...form,
                        scoring_bands: { ...form.scoring_bands, strong: [parseInt(e.target.value) || 0, form.scoring_bands.strong?.[1] ?? 10] },
                      })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      value={form.scoring_bands.strong?.[1] ?? ''}
                      onChange={(e) => setForm({
                        ...form,
                        scoring_bands: { ...form.scoring_bands, strong: [form.scoring_bands.strong?.[0] ?? 9, parseInt(e.target.value) || 10] },
                      })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Qualified (min-max)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={form.scoring_bands.qualified?.[0] ?? ''}
                      onChange={(e) => setForm({
                        ...form,
                        scoring_bands: { ...form.scoring_bands, qualified: [parseInt(e.target.value) || 0, form.scoring_bands.qualified?.[1] ?? 8] },
                      })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      value={form.scoring_bands.qualified?.[1] ?? ''}
                      onChange={(e) => setForm({
                        ...form,
                        scoring_bands: { ...form.scoring_bands, qualified: [form.scoring_bands.qualified?.[0] ?? 7, parseInt(e.target.value) || 8] },
                      })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Reject Below</label>
                  <input
                    type="number"
                    value={form.scoring_bands.reject_below ?? ''}
                    onChange={(e) => setForm({
                      ...form,
                      scoring_bands: { ...form.scoring_bands, reject_below: parseInt(e.target.value) || 0 },
                    })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              {form.scoring_bands.borderline !== undefined && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Borderline (min-max)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={form.scoring_bands.borderline?.[0] ?? ''}
                      onChange={(e) => setForm({
                        ...form,
                        scoring_bands: { ...form.scoring_bands, borderline: [parseInt(e.target.value) || 0, form.scoring_bands.borderline?.[1] ?? 6] },
                      })}
                      className="w-24 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      value={form.scoring_bands.borderline?.[1] ?? ''}
                      onChange={(e) => setForm({
                        ...form,
                        scoring_bands: { ...form.scoring_bands, borderline: [form.scoring_bands.borderline?.[0] ?? 6, parseInt(e.target.value) || 6] },
                      })}
                      className="w-24 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500"
              />
              Active
            </label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">ICP Configurations</h1>
      <p className="text-slate-400 text-sm mb-8">Define and edit ideal customer profile settings</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {configs.map((config) => (
          <div key={config.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-white text-lg mb-1">{config.name}</h3>
                <p className="text-sm text-slate-400">{config.owner_business}</p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${config.is_active ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900' : 'bg-slate-800 text-slate-500'}`}>
                {config.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-slate-500">Size/Stage: </span>
                <span className="text-slate-300">{config.company_size_stage}</span>
              </div>
              <div>
                <span className="text-slate-500">Geography: </span>
                <span className="text-slate-300">{config.geography}</span>
              </div>
              <div>
                <span className="text-slate-500">Verticals: </span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {config.target_verticals.map((v) => (
                    <span key={v} className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">{v}</span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-slate-500">KDM Titles: </span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {config.kdm_titles.map((v) => (
                    <span key={v} className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">{v}</span>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => startEdit(config)}
              className="mt-5 w-full bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium py-2 rounded-lg transition-colors"
            >
              Edit configuration
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
