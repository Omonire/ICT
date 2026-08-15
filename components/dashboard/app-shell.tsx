'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  CalendarClock,
  CalendarDays,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  MapPin,
  Settings,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth/auth-context';
import { useToast } from '@/components/ui/toast';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
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
      { href: '/sessions', label: 'Sessions', icon: CalendarDays },
      { href: '/schedule', label: 'Schedule', icon: CalendarClock },
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

function Sidebar({ user }: { user: { email: string; name: string | null; role: string } }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const { success } = useToast();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-slate-900 text-slate-300 print:hidden">
      <div className="flex h-16 items-center gap-2.5 border-b-[0.5px] border-slate-800 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[15px] font-semibold leading-tight text-white">ExamFlow</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Operations console</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV.map((group) => (
          <div key={group.section} className="mb-5">
            <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {group.section}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                        active
                          ? 'bg-brand-600/15 text-brand-300'
                          : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                      )}
                    >
                      <item.icon className={cn('h-4 w-4', active ? 'text-brand-400' : 'text-slate-500')} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t-[0.5px] border-slate-800 px-3 py-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600/20 text-[12px] font-semibold text-brand-300">
            {user.name ? user.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() : 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-slate-200">{user.name ?? user.email}</p>
            <p className="truncate text-[11px] capitalize text-slate-500">{user.role}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 w-full justify-start text-slate-400 hover:bg-slate-800/70 hover:text-slate-200"
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
    </aside>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    } else if (!loading && user) {
      setReady(true);
    }
  }, [loading, user, router]);

  if (loading || !ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="h-6 w-6 text-brand-500" />
          <p className="text-[12px] text-slate-500">Checking session…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <Sidebar user={{ email: user.email, name: user.name, role: user.role }} />
      <div className="ml-60 flex min-h-screen flex-col print:ml-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b-[0.5px] border-slate-200 bg-white/80 px-6 backdrop-blur print:hidden">
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/candidates/import"
              className="hidden items-center gap-1.5 rounded-lg border-[0.5px] border-slate-300 px-3 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50 md:inline-flex"
            >
              <Settings className="h-4 w-4" />
              Import CSV
            </Link>
            <UserMenu user={{ email: user.email, name: user.name, role: user.role }} />
          </div>
        </header>
        <main className="flex-1 px-6 py-6 lg:px-8 print:p-0">{children}</main>
      </div>
    </div>
  );
}
