'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { History } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-context';
import type { ActivityEntry, Paginated } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { SkeletonTable } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { formatDateTime } from '@/lib/format';

const ACTION_LABELS: Record<string, string> = {
  auth_login: 'Login',
  auth_logout: 'Logout',
  candidate_create: 'Candidate created',
  candidate_update: 'Candidate updated',
  candidate_delete: 'Candidate deleted',
  candidate_import: 'CSV import',
  candidate_import_rollback: 'Import rolled back',
  hall_create: 'Hall created',
  hall_update: 'Hall updated',
  hall_delete: 'Hall deleted',
  session_create: 'Session created',
  session_update: 'Session updated',
  session_delete: 'Session deleted',
  schedule_generate: 'Schedule generated',
  schedule_preview: 'Schedule previewed',
  schedule_confirm: 'Schedule confirmed',
  schedule_clear: 'Schedule cleared',
  assignment_create: 'Assignment created',
  assignment_update: 'Assignment updated',
  assignment_delete: 'Assignment deleted',
  attendance_generate: 'Attendance sheet generated',
  attendance_pdf: 'Attendance PDF downloaded',
  attendance_html: 'Attendance HTML viewed',
};

function actionLabel(a: ActivityEntry) {
  if (ACTION_LABELS[a.action]) return ACTION_LABELS[a.action];
  return a.action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ActivityPage() {
  const { user } = useAuth();
  const { error } = useToast();
  const [data, setData] = useState<Paginated<ActivityEntry> | null>(null);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');

  useEffect(() => {
    if (!user) return;
    apiGet<Paginated<ActivityEntry>>(`/api/activity-log?page=${page}${action ? `&action=${action}` : ''}`)
      .then(setData)
      .catch((err) => error('Could not load activity log', err instanceof Error ? err.message : undefined));
  }, [user, page, action, error]);

  return (
    <div>
      <PageHeader
        title="Activity log"
        description="A chronological audit trail of every action taken across the platform."
      />

      <Card>
        <div className="flex flex-col gap-3 border-b-[0.5px] border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-[13px] font-medium text-slate-600">
            <History className="h-4 w-4 text-slate-400" />
            {data ? `${data.meta.total} events` : 'Loading…'}
          </div>
          <Select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className="h-9 w-full sm:w-56"
          >
            <option value="">All actions</option>
            {Object.entries(ACTION_LABELS)
              .sort(([, a], [, b]) => a.localeCompare(b))
              .map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
          </Select>
        </div>

        {!data ? (
          <div className="p-4">
            <SkeletonTable rows={8} cols={4} />
          </div>
        ) : data.data.length === 0 ? (
          <EmptyState
            icon={<History className="h-5 w-5" />}
            title="No activity yet"
            description="Actions you take will appear here."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b-[0.5px] border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3 font-medium">Event</th>
                    <th className="px-5 py-3 font-medium">Details</th>
                    <th className="px-5 py-3 font-medium">User</th>
                    <th className="px-5 py-3 font-medium">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y-[0.5px] divide-slate-100">
                  {data.data.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-5 py-3">
                        <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[12px] font-medium text-purple-700">
                          {actionLabel(entry)}
                        </span>
                        {entry.entityType && (
                          <span className="ml-2 font-mono text-[11px] text-slate-400">
                            {entry.entityType}
                            {entry.entityId ? `:${entry.entityId.slice(0, 8)}` : ''}
                          </span>
                        )}
                      </td>
                      <td className="max-w-xs truncate px-5 py-3 text-slate-500">
                        {entry.details
                          ? Object.entries(entry.details)
                              .filter(([k, v]) => v !== null && v !== undefined && v !== '')
                              .slice(0, 3)
                              .map(([k, v]) => (
                                <span key={k}>
                                  <span className="font-medium text-slate-600">{k}</span>:{' '}
                                  {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                </span>
                              ))
                              .reduce<ReactNode[]>((acc, node, i) => {
                                if (i > 0) acc.push(' · ');
                                acc.push(node);
                                return acc;
                              }, [])
                          : '—'}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                        {entry.user ? entry.user.name || entry.user.email : 'system'}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-[12px] text-slate-400">
                        {formatDateTime(entry.timestamp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t-[0.5px] border-slate-100 px-5 py-3">
              <Pagination
                page={data.meta.page}
                totalPages={data.meta.totalPages}
                total={data.meta.total}
                pageSize={data.meta.limit}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
