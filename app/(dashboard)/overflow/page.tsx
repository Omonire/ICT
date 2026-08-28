'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Loader2,
  MapPin,
  RefreshCw,
  Users,
  XCircle,
} from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import type {
  ReschedulingEntry,
  Session,
  Hall,
  RescheduleCandidateResult,
} from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonTable } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/components/auth/auth-context';
import { formatDate, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function OverflowPage() {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [entries, setEntries] = useState<ReschedulingEntry[] | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'rescheduled' | 'excluded'>('pending');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const pageSize = 100;

  // Reschedule dialog
  const [rescheduleEntry, setRescheduleEntry] = useState<ReschedulingEntry | null>(null);
  const [targetSession, setTargetSession] = useState('');
  const [targetHall, setTargetHall] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  const loadData = useCallback(async (status?: string, pageOffset = 0) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status && status !== 'all') params.set('status', status);
      params.set('limit', String(pageSize));
      params.set('offset', String(pageOffset));
      const qs = params.toString();
      const [entriesRes, sessionsRes, hallsRes] = await Promise.allSettled([
        apiGet<{ data: ReschedulingEntry[]; meta: { total: number } }>(`/api/schedule/rescheduling-queue${qs ? `?${qs}` : ''}`),
        apiGet<{ data: Session[] }>('/api/sessions'),
        apiGet<{ data: Hall[] }>('/api/halls'),
      ]);
      if (entriesRes.status === 'fulfilled') {
        setEntries(entriesRes.value.data);
        setTotal(entriesRes.value.meta?.total ?? entriesRes.value.data.length);
      } else {
        setEntries([]);
      }
      if (sessionsRes.status === 'fulfilled') setSessions(sessionsRes.value.data);
      if (hallsRes.status === 'fulfilled') setHalls(hallsRes.value.data);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadData(filter, 0);
  }, [user]);

  const filtered = useMemo(() => {
    if (!entries) return [];
    return entries;
  }, [entries]);

  const stats = useMemo(() => {
    if (!entries) return { total: 0, pending: 0, rescheduled: 0, excluded: 0 };
    return {
      total: entries.length,
      pending: entries.filter((e) => e.status === 'pending').length,
      rescheduled: entries.filter((e) => e.status === 'rescheduled').length,
      excluded: entries.filter((e) => e.status === 'excluded').length,
    };
  }, [entries]);

  const availableHalls = useMemo(() => {
    if (!targetSession) return halls;
    return halls.filter((h) => h.status === 'active');
  }, [halls, targetSession]);

  async function handleReschedule() {
    if (!rescheduleEntry || !targetSession || !targetHall) return;
    setRescheduling(true);
    try {
      await apiPost<RescheduleCandidateResult>('/api/schedule/reschedule-candidate', {
        entryId: rescheduleEntry.id,
        targetSessionId: targetSession,
        targetHallId: targetHall,
      });
      success('Candidate rescheduled', `${rescheduleEntry.candidate?.name ?? rescheduleEntry.candidateId} has been placed.`);
      setRescheduleEntry(null);
      setTargetSession('');
      setTargetHall('');
      loadData(filter, page);
    } catch (err) {
      error('Reschedule failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRescheduling(false);
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'pending':
        return <Badge variant="amber" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case 'rescheduled':
        return <Badge variant="green" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Rescheduled</Badge>;
      case 'excluded':
        return <Badge variant="slate" className="gap-1"><XCircle className="h-3 w-3" /> Excluded</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  function getReasonIcon(reason: string) {
    if (reason.includes('capacity') || reason.includes('full')) return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    if (reason.includes('daily') || reason.includes('already')) return <Clock className="h-4 w-4 text-blue-500" />;
    return <AlertTriangle className="h-4 w-4 text-slate-400" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overflow & Day Rescheduling"
        description="Candidates that couldn't be placed during scheduling. Review and manually assign them to available sessions."
        actions={
          <Button variant="outline" onClick={() => loadData(filter, page)} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> Refresh
          </Button>
        }
      />

      {/* Stats */}
      {loading && !entries ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <div className="p-5">
                <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
                <div className="mt-2 h-7 w-12 animate-pulse rounded bg-slate-100" />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card>
            <div className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-medium text-slate-500">Total overflow</p>
                <Users className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-1 text-2xl font-bold text-slate-900">{stats.total}</p>
            </div>
          </Card>
          <Card>
            <div className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-medium text-slate-500">Pending</p>
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              <p className="mt-1 text-2xl font-bold text-amber-600">{stats.pending}</p>
            </div>
          </Card>
          <Card>
            <div className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-medium text-slate-500">Rescheduled</p>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </div>
              <p className="mt-1 text-2xl font-bold text-green-600">{stats.rescheduled}</p>
            </div>
          </Card>
          <Card>
            <div className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-medium text-slate-500">Excluded</p>
                <XCircle className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-1 text-2xl font-bold text-slate-600">{stats.excluded}</p>
            </div>
          </Card>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-slate-400" />
        {(['pending', 'all', 'rescheduled', 'excluded'] as const).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(0); loadData(f, 0); }}
            className={cn(
              'rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
              filter === f
                ? 'bg-purple-100 text-purple-700'
                : 'text-slate-500 hover:bg-slate-100'
            )}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'pending' && stats.pending > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {stats.pending}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Entries table */}
      {loading && !entries ? (
        <Card>
          <div className="p-4">
            <SkeletonTable rows={8} cols={6} />
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CheckCircle2 className="h-5 w-5" />}
            title={filter === 'pending' ? 'No pending overflow' : 'No entries found'}
            description={
              filter === 'pending'
                ? 'All candidates have been placed. No overflow to reschedule.'
                : `No ${filter} entries in the rescheduling queue.`
            }
          />
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-4 py-3 font-medium text-slate-600">Candidate</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Subjects</th>
                  <th className="px-4 py-3 font-medium text-slate-600">First choice</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Reason</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-900">{entry.candidate?.name ?? 'Unknown'}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{entry.candidateId.slice(0, 8)}…</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[12px] text-slate-600 max-w-[200px] truncate" title={entry.subjectCombination}>
                        {entry.subjectCombination}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700">
                        {entry.candidate?.name ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {getReasonIcon(entry.reason)}
                        <span className="text-[12px] text-slate-600 max-w-[180px] truncate" title={entry.reason}>
                          {entry.reason}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(entry.status)}</td>
                    <td className="px-4 py-3 text-right">
                      {entry.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRescheduleEntry(entry);
                            setTargetSession('');
                            setTargetHall('');
                          }}
                        >
                          <MapPin className="h-3.5 w-3.5 mr-1" /> Assign
                        </Button>
                      )}
                      {entry.status === 'rescheduled' && entry.targetExamDate && (
                        <span className="text-[12px] text-green-600">
                          {entry.targetExamDate}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Reschedule dialog */}
      <Dialog
        open={rescheduleEntry !== null}
        onClose={() => setRescheduleEntry(null)}
        title="Reschedule candidate"
        description={`Manually assign ${rescheduleEntry?.candidate?.name ?? 'this candidate'} to a session and hall.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRescheduleEntry(null)} disabled={rescheduling}>
              Cancel
            </Button>
            <Button onClick={handleReschedule} disabled={rescheduling || !targetSession || !targetHall}>
              {rescheduling ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              {rescheduling ? 'Assigning…' : 'Assign candidate'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {rescheduleEntry && (
            <div className="rounded-lg bg-slate-50 p-3 text-[12px]">
              <p><span className="font-medium text-slate-700">Candidate:</span> {rescheduleEntry.candidate?.name}</p>
              <p><span className="font-medium text-slate-700">Subjects:</span> {rescheduleEntry.subjectCombination}</p>
              <p><span className="font-medium text-slate-700">Reason:</span> {rescheduleEntry.reason}</p>
            </div>
          )}

          <div>
            <label className="label">Target session</label>
            <select
              value={targetSession}
              onChange={(e) => {
                setTargetSession(e.target.value);
                setTargetHall('');
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[13px] text-slate-900 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="">Select a session…</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {formatDate(s.examDate)} ({formatTime(s.startTime)}–{formatTime(s.endTime)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Target hall</label>
            <select
              value={targetHall}
              onChange={(e) => setTargetHall(e.target.value)}
              disabled={!targetSession}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[13px] text-slate-900 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
            >
              <option value="">Select a hall…</option>
              {availableHalls.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} (capacity: {h.capacity})
                </option>
              ))}
            </select>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
