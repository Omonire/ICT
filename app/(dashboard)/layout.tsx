import { AuthProvider } from '@/components/auth/auth-context';
import { ThemeProvider } from '@/components/theme-provider';
import { AppShell } from '@/components/dashboard/app-shell';
import { ErrorBoundary } from '@/components/ui/error-boundary';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppShell>
          <ErrorBoundary>{children}</ErrorBoundary>
        </AppShell>
      </AuthProvider>
    </ThemeProvider>
  );
}
