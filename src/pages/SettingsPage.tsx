import { Key, Search, Brain, MailCheck, FileKey } from 'lucide-react';

const providers = [
  {
    icon: Search,
    name: 'Search Provider',
    description: 'API key for the web search provider used to discover public signals.',
    placeholder: 'Search API key',
  },
  {
    icon: Brain,
    name: 'LLM Provider',
    description: 'API key for the language model used to score and qualify leads.',
    placeholder: 'LLM API key',
  },
  {
    icon: MailCheck,
    name: 'Email Verification Provider',
    description: 'API key for the email verification service used to validate contact emails.',
    placeholder: 'Email verification API key',
  },
  {
    icon: FileKey,
    name: 'Google Service Account',
    description: 'Service account JSON for Google Sheets export and other Google API integrations.',
    placeholder: 'Service account JSON',
  },
];

export function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
      <p className="text-slate-400 text-sm mb-8">API keys and integration credentials</p>

      <div className="bg-amber-950/30 border border-amber-900 rounded-xl p-4 mb-8 flex items-start gap-3">
        <Key className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-amber-200 font-medium">Credentials are stored as Supabase secrets</p>
          <p className="text-xs text-amber-400/80 mt-1">
            API keys are managed securely server-side and are never exposed in the database or client-side code.
            This page is a placeholder — configure keys through your Supabase project's edge function secrets.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {providers.map((provider) => {
          const Icon = provider.icon;
          return (
            <div key={provider.name} className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-slate-800">
                  <Icon className="w-5 h-5 text-slate-300" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{provider.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{provider.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5">
                <div className="flex-1">
                  <span className="text-sm text-slate-600 font-mono">{'•'.repeat(20)}</span>
                </div>
                <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">Not set</span>
              </div>
              <button
                disabled
                className="mt-4 w-full bg-slate-800 text-slate-500 text-sm font-medium py-2 rounded-lg cursor-not-allowed"
              >
                Configure via Supabase secrets
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
