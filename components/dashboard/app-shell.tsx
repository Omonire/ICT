'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  FileSpreadsheet,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MapPin,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth/auth-context';
import { useTheme } from '@/components/theme-provider';
import { useToast } from '@/components/ui/toast';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import GlobalSearch from './global-search';
import { UserMenu } from './user-menu';

const NAV = [
  {
    section: 'Overview',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    section: 'Examination',
    items: [
      { href: '/candidates', label: 'Candidates', icon: Users },
      { href: '/halls', label: 'Halls', icon: MapPin },
      { href: '/hall-layout', label: 'Hall layout', icon: MapPin },
      { href: '/sessions', label: 'Sessions', icon: CalendarDays },
      { href: '/schedule', label: 'Schedule', icon: CalendarClock },
      { href: '/scheduling-config', label: 'Scheduling config', icon: SlidersHorizontal },
      { href: '/custom-scheduling', label: 'Custom scheduling', icon: ListChecks },
      { href: '/overflow', label: 'Day rescheduling', icon: AlertTriangle },
      { href: '/attendance', label: 'Attendance sheets', icon: FileSpreadsheet },
    ],
  },
  {
    section: 'Intelligence',
    items: [
      { href: '/analytics', label: 'Analytics', icon: Activity },
      { href: '/activity', label: 'Activity log', icon: Shield },
    ],
  },
];

function Sidebar({
  user,
  mobileOpen,
  onClose,
}: {
  user: { email: string; name: string | null; role: string };
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const { success } = useToast();
  const { theme } = useTheme();
  const isPurple = theme === 'purple';
  const isDark = theme === 'dark';

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const sidebarBg = isPurple ? 'bg-purple-600' : isDark ? 'bg-slate-900' : 'bg-slate-900';
  const sectionText = isPurple ? 'text-purple-200' : 'text-slate-500';
  const linkActive = isPurple ? 'bg-white/20 text-white' : 'bg-purple-600/15 text-purple-300';
  const linkInactive = isPurple ? 'text-purple-200 hover:bg-white/10 hover:text-white' : isDark ? 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200' : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200';
  const iconInactive = isPurple ? 'text-purple-300' : 'text-slate-500';
  const borderColor = isPurple ? 'border-purple-500' : 'border-slate-800';
  const userBg = isPurple ? 'bg-white/20 text-purple-100' : 'bg-purple-600/20 text-purple-300';
  const userName = isPurple ? 'text-white' : 'text-slate-200';
  const userRole = isPurple ? 'text-purple-200' : 'text-slate-500';
  const signOutClass = isPurple ? 'text-purple-200 hover:bg-white/10 hover:text-white' : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200';

  const navContent = (
    <>
      <div className={cn('flex h-16 items-center gap-2.5 border-b-[0.5px] px-5', borderColor)}>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-purple-600">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <p className={cn('text-[15px] font-semibold leading-tight', userName)}>ExamFlow</p>
          <p className={cn('text-[10px] uppercase tracking-wider', userRole)}>Operations console</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV.map((group) => (
          <div key={group.section} className="mb-5">
            <p className={cn('mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em]', sectionText)}>
              {group.section}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                        active ? linkActive : linkInactive
                      )}
                    >
                      <item.icon className={cn('h-4 w-4', active ? (isPurple ? 'text-white' : 'text-purple-400') : iconInactive)} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {user.role === 'superadmin' && (
          <div className="mb-5">
            <p className={cn('mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em]', sectionText)}>
              System
            </p>
            <ul className="space-y-0.5">
              <li>
                <Link
                  href="/superadmin"
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                    pathname === '/superadmin' ? linkActive : linkInactive
                  )}
                >
                  <ShieldCheck className={cn('h-4 w-4', pathname === '/superadmin' ? (isPurple ? 'text-white' : 'text-purple-400') : iconInactive)} />
                  Superadmin
                </Link>
              </li>
            </ul>
          </div>
        )}
      </nav>

      <div className={cn('border-t-[0.5px] px-3 py-3', borderColor)}>
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold', userBg)}>
            {user.name ? user.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() : 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className={cn('truncate text-[13px] font-medium', userName)}>{user.name ?? user.email}</p>
            <p className={cn('truncate text-[11px] capitalize', userRole)}>{user.role}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className={cn('mt-1 w-full justify-start', signOutClass)}
          onClick={() => {
            void logout().then(() => {
              success('Signed out', 'Your session has ended.');
              router.replace('/login');
            });
          }}
        >
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={cn('fixed inset-y-0 left-0 z-40 hidden lg:flex w-60 flex-col text-slate-300 print:hidden', sidebarBg)}>
        {navContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={onClose} />
          <aside className={cn('absolute inset-y-0 left-0 flex w-60 flex-col text-slate-300', sidebarBg)}>
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isDark = theme === 'dark';
  const isPurple = theme === 'purple';

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    } else if (!loading && user) {
      setReady(true);
    }
  }, [loading, user, router]);

  if (loading || !ready) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="flex flex-col items-center gap-3">
          <Spinner className="h-6 w-6 text-purple-500" />
          <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Checking session…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const headerBg = isDark ? 'bg-slate-900/80' : isPurple ? 'bg-purple-600/80' : 'bg-white/80';
  const headerBorder = isDark ? 'border-slate-700' : isPurple ? 'border-purple-500' : 'border-slate-200';
  const headerText = isDark ? 'text-slate-300' : isPurple ? 'text-white' : 'text-slate-600';
  const headerHover = isDark ? 'hover:bg-slate-800' : isPurple ? 'hover:bg-purple-500' : 'hover:bg-slate-100';
  const importBorder = isDark ? 'border-slate-600' : isPurple ? 'border-purple-400' : 'border-slate-300';
  const importText = isDark ? 'text-slate-300' : isPurple ? 'text-purple-100' : 'text-slate-600';
  const importHover = isDark ? 'hover:bg-slate-800' : isPurple ? 'hover:bg-purple-500' : 'hover:bg-slate-50';

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <Sidebar
        user={{ email: user.email, name: user.name, role: user.role }}
        mobileOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />
      <div className="lg:ml-60 flex min-h-screen flex-col print:ml-0">
        <header className={cn('sticky top-0 z-30 flex h-16 items-center gap-3 border-b-[0.5px] px-4 backdrop-blur print:hidden sm:gap-4 sm:px-6', headerBg, headerBorder)}>
          <button
            className={cn('flex items-center justify-center rounded-lg p-1.5 lg:hidden', headerText, headerHover)}
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
            </svg>
          </button>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/candidates/import"
              className={cn('hidden items-center gap-1.5 rounded-lg border-[0.5px] px-3 py-2 text-[13px] font-medium md:inline-flex', importBorder, importText, importHover)}
            >
              <Settings className="h-4 w-4" />
              Import CSV
            </Link>
            <UserMenu user={{ email: user.email, name: user.name, role: user.role }} />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 print:p-0">{children}</main>
      </div>
    </div>
  );
}
