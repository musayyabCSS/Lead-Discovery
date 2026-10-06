import { type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { navigate, useRouter, type Route } from '@/lib/router';
import {
  LayoutDashboard,
  Target,
  ClipboardCheck,
  Settings,
  LogOut,
  Radar,
} from 'lucide-react';

const navItems: { label: string; icon: typeof LayoutDashboard; route: Route }[] = [
  { label: 'Dashboard', icon: LayoutDashboard, route: { name: 'dashboard' } },
  { label: 'ICP Configs', icon: Target, route: { name: 'icp-configs' } },
  { label: 'Review Queue', icon: ClipboardCheck, route: { name: 'review-queue' } },
  { label: 'Settings', icon: Settings, route: { name: 'settings' } },
];

function isActive(current: Route, target: Route): boolean {
  return current.name === target.name;
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const route = useRouter();

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-slate-900 border-r border-slate-800 flex flex-col fixed inset-y-0 left-0 z-10">
        <div className="px-5 py-5 flex items-center gap-2.5 border-b border-slate-800">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600">
            <Radar className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-white text-lg">Lead Discovery</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active = isActive(route, item.route);
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.route)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-600/15 text-blue-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-[18px] h-[18px]" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-slate-800">
          <div className="px-3 py-2 mb-2">
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition-colors"
          >
            <LogOut className="w-[18px] h-[18px]" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 ml-60">
        <main className="p-8 max-w-7xl">{children}</main>
      </div>
    </div>
  );
}
