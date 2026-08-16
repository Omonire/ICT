'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ClipboardList, LayoutGrid, Timer, Users, Zap } from 'lucide-react';
import { apiGet } from '@/lib/api';
import type { Analytics } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { SkeletonTable } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#8b5cf6',
  unscheduled: '#94a3b8',
  completed: '#f59e0b',
};
const HALL_COLORS = ['#4f46e5', '#7c3aed', '#9333ea', '#c026d3', '#db2777', '#e11d48'];

export default function AnalyticsPage() {
  const { error } = useToast();
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    apiGet<{ data: Analytics }>('/api/analytics')
      .then((r) => setData(r.data))
      .catch((err) => error('Could not load analytics', err instanceof Error ? err.message : undefined));
  }, [error]);

  if (!data) {
    return (
      <div>
        <PageHeader title="Analytics" description="Load, coverage and capacity overview." />
        <Card>
          <div className="p-4">
            <SkeletonTable rows={8} cols={4} />
          </div>
        </Card>
      </div>
    );
  }

  const { candidates } = data;
  const statusData = [
    { name: 'Scheduled', value: candidates.scheduled, color: STATUS_COLORS.scheduled },
    { name: 'Unscheduled', value: candidates.unscheduled, color: STATUS_COLORS.unscheduled },
    { name: 'Completed', value: candidates.completed, color: STATUS_COLORS.completed },
  ].filter((d) => d.value > 0);

  const stats = [
    {
      label: 'Total candidates',
      value: candidates.total,
      icon: Users,
      sub: `${data.scheduledPct}% scheduled`,
    },
    {
      label: 'Scheduled',
      value: candidates.scheduled,
      icon: ClipboardList,
      sub: `${candidates.total > 0 ? Math.round((candidates.scheduled / candidates.total) * 100) : 0}% of total`,
    },
    {
      label: 'Completed',
      value: candidates.completed,
      icon: Zap,
      sub: `${data.completedPct}% of total`,
    },
    {
      label: 'Hall utilization',
      value: `${data.utilizationPct}%`,
      icon: LayoutGrid,
      sub: 'across all active sessions',
    },
  ];

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Load, coverage and capacity overview across halls, sessions and programmes."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, sub }) => (
          <Card key={label}>
            <div className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-medium text-slate-500">{label}</p>
                <Icon className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
              <p className="mt-1 text-[11px] text-slate-400">{sub}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Candidates by status</CardTitle>
          </CardHeader>
          <div className="h-64 px-4 pb-4">
            {statusData.length === 0 ? (
              <EmptyState title="No candidates" description="Import candidates to see breakdowns." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={3}>
                    {statusData.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: '0.5px solid #e2e8f0', fontSize: 12 }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assigned seats by hall</CardTitle>
          </CardHeader>
          <div className="h-64 px-4 pb-4">
            {data.byHall.every((h) => h.assigned === 0) ? (
              <EmptyState title="No assignments yet" description="Confirm a schedule to populate halls." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byHall}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: '0.5px solid #e2e8f0', fontSize: 12 }}
                  />
                  <Bar dataKey="assigned" radius={[6, 6, 0, 0]}>
                    {data.byHall.map((h, i) => (
                      <Cell key={h.id} fill={HALL_COLORS[i % HALL_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Programme coverage</CardTitle>
            <p className="text-[12px] text-slate-400">
              <Link href="/candidates" className="text-purple-600 hover:underline">
                Manage candidates
              </Link>
            </p>
          </CardHeader>
          <div className="space-y-4 p-5">
            {data.byGroup.length === 0 && (
              <EmptyState title="No programmes" description="Career groups will appear after import." />
            )}
            {data.byGroup.map((g) => (
              <div key={g.id}>
                <div className="mb-1.5 flex items-center justify-between text-[13px]">
                  <span className="font-medium text-slate-700">{g.name}</span>
                  <span className="font-mono text-[11px] text-slate-400">
                    {g.scheduled}/{g.total} scheduled
                  </span>
                </div>
                <Progress value={g.total > 0 ? (g.scheduled / g.total) * 100 : 0} className="h-2" />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session load</CardTitle>
            <p className="text-[12px] text-slate-400">Assigned candidates per session.</p>
          </CardHeader>
          <div className="h-64 px-4 pb-4">
            {data.bySession.every((s) => s.assigned === 0) ? (
              <EmptyState title="No session load" description="Confirm a schedule to see load." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.bySession} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={70}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: '0.5px solid #e2e8f0', fontSize: 12 }}
                  />
                  <Bar dataKey="assigned" fill="#4f46e5" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Hall utilization</CardTitle>
          <p className="text-[12px] text-slate-400">
            <Timer className="mr-1 inline h-3 w-3" />
            Percentage of assigned seats against each hall&apos;s capacity.
          </p>
        </CardHeader>
        <div className="space-y-4 p-5">
          {data.byHall.map((h) => (
            <div key={h.id}>
              <div className="mb-1.5 flex items-center justify-between text-[13px]">
                <span className="font-medium text-slate-700">{h.name}</span>
                <span className="font-mono text-[11px] text-slate-400">
                  {h.assigned}/{h.capacity} seats · {h.utilization}%
                </span>
              </div>
              <Progress value={h.utilization} className="h-2" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
