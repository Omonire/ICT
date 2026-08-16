'use client';

import Link from 'next/link';
import {
  CalendarClock,
  CheckCircle2,
  FileSpreadsheet,
  Users,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import { useApi } from '@/lib/use-api';
import { apiGet } from '@/lib/api';
import type { Analytics, ScheduleStatus, ActivityEntry } from '@/lib/types';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { SkeletonCards } from '@/components/ui/skeleton';
import { PageLoader } from '@/components/ui/spinner';
import { ProgressLabeled } from '@/components/ui/progress';
import { relativeTime } from '@/lib/format';
import { EmptyState } from '@/components/ui/empty-state';

export default function DashboardPage() {
  const analytics = useApi<Analytics>(() => apiGet<{ data: Analytics }>('/api/analytics').then((r) => r.data), []);
  const schedule = useApi<ScheduleStatus>(() => apiGet<{ data: ScheduleStatus }>('/api/schedule/status').then((r) => r.data), []);
  const activity = useApi<{ data: ActivityEntry[] }>(() => apiGet('/api/activity-log?limit=8'), []);

  if (analytics.loading && !analytics.data) return <PageLoader label="Loading overview…" />;
  if (analytics.error) {
    return <EmptyState title="Could not load the overview" description={analytics.error} />;
  }

  const a = analytics.data!;
  const s = schedule.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Operations overview</h1>
          <p className="mt-1 text-[13px] text-slate-500">
            A live view of the current exam cycle.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {s?.status !== 'none' && (
            <StatusBadge status={s?.status ?? 'none'} />
          )}
          <Link
            href="/schedule"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-purple-600 px-4 text-sm font-medium text-white hover:bg-purple-700"
          >
            <CalendarClock className="h-4 w-4" /> Manage schedule
          </Link>
        </div>
      </div>

      {analytics.loading ? (
        <SkeletonCards count={4} />
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total candidates"
            value={a.candidates.total.toLocaleString()}
            icon={<Users className="h-4 w-4" />}
          />
          <StatCard
            label="Scheduled"
            value={a.candidates.scheduled.toLocaleString()}
            sub={`${a.scheduledPct}% of all candidates`}
            accent
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
          <StatCard
            label="Unscheduled"
            value={a.candidates.unscheduled.toLocaleString()}
            sub="Awaiting placement"
            icon={<XCircle className="h-4 w-4" />}
          />
          <StatCard
            label="Hall utilization"
            value={`${a.utilizationPct}%`}
            sub={`${a.candidates.completed} completed`}
            icon={<FileSpreadsheet className="h-4 w-4" />}
          />
        </div>
      )}

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Exam cycle progress</CardTitle>
            <CardDescription>Placement and completion across the cycle.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ProgressLabeled label="Candidates scheduled" hint={`${a.scheduledPct}%`} value={a.scheduledPct} />
            <ProgressLabeled
              label="Seat utilization"
              hint={`${a.utilizationPct}%`}
              value={a.utilizationPct}
              indicatorClassName="bg-purple-600"
            />
            <ProgressLabeled
              label="Exams completed"
              hint={`${a.completedPct}%`}
              value={a.completedPct}
              indicatorClassName="bg-gold-500"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Candidates by group</CardTitle>
            <CardDescription>Breakdown by career line.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {a.byGroup.map((g) => {
              const pct = g.total > 0 ? Math.round((g.scheduled / g.total) * 100) : 0;
              return (
                <div key={g.id}>
                  <div className="mb-1 flex items-center justify-between text-[12px]">
                    <span className="font-medium text-slate-700">{g.name}</span>
                    <span className="font-mono text-slate-400">
                      {g.scheduled}/{g.total}
                    </span>
                  </div>
                  <ProgressLabeled value={pct} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Session load</CardTitle>
              <CardDescription>How many candidates each session carries.</CardDescription>
            </div>
            <Link href="/sessions" className="flex items-center gap-1 text-[13px] font-medium text-purple-700 hover:underline">
              All sessions <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {a.bySession.slice(0, 6).map((sess) => (
              <div key={sess.id} className="flex items-center gap-3">
                <div className="w-32 shrink-0">
                  <p className="font-mono text-[12px] font-medium text-slate-700">{sess.examDate}</p>
                  <p className="text-[11px] text-slate-500">
                    {sess.name} · {sess.startTime}
                  </p>
                </div>
                <div className="flex-1">
                  <ProgressLabeled value={sess.utilization} hint={`${sess.assigned} / ${sess.capacity}`} />
                </div>
              </div>
            ))}
            {a.bySession.length === 0 && (
              <p className="py-8 text-center text-[13px] text-slate-500">No sessions defined yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest actions across the platform.</CardDescription>
          </CardHeader>
          <CardContent>
            {activity.loading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-4 animate-pulse rounded bg-slate-100" />
                ))}
              </div>
            ) : activity.data && activity.data.data.length > 0 ? (
              <ul className="space-y-3">
                {activity.data.data.slice(0, 7).map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-slate-700">{entry.action}</p>
                      <p className="text-[11px] text-slate-400">
                        {entry.user ? entry.user.name ?? entry.user.email : 'System'}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-slate-400">
                      {relativeTime(entry.timestamp)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-8 text-center text-[13px] text-slate-500">No activity yet.</p>
            )}
            {activity.data && activity.data.data.length > 0 && (
              <Link
                href="/activity"
                className="mt-4 flex items-center justify-center gap-1 rounded-lg border-[0.5px] border-slate-200 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
              >
                View full audit log <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
