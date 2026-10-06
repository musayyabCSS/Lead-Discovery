import { AuthProvider, useAuth } from '@/context/AuthContext';
import { useRouter } from '@/lib/router';
import { AppLayout } from '@/components/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { IcpConfigsPage } from '@/pages/IcpConfigsPage';
import { ReviewQueuePage } from '@/pages/ReviewQueuePage';
import { LeadDetailPage } from '@/pages/LeadDetailPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { Loader2 } from 'lucide-react';

function AppRoutes() {
  const route = useRouter();

  switch (route.name) {
    case 'dashboard': return <DashboardPage />;
    case 'icp-configs': return <IcpConfigsPage />;
    case 'review-queue': return <ReviewQueuePage />;
    case 'lead-detail': return <LeadDetailPage leadId={route.leadId} />;
    case 'settings': return <SettingsPage />;
    default: return <DashboardPage />;
  }
}

function AppContent() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return (
    <AppLayout>
      <AppRoutes />
    </AppLayout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
