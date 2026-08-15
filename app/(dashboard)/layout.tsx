import { AuthProvider } from '@/components/auth/auth-context';
import { AppShell } from '@/components/dashboard/app-shell';
import { ErrorBoundary } from '@/components/ui/error-boundary';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppShell>
        <ErrorBoundary>{children}</ErrorBoundary>
      </AppShell>
    </AuthProvider>
  );
}
