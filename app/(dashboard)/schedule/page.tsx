'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import type { ScheduleState, ScheduleStatus, SchedulePreview, Session, PlanSummary } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoader } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { formatDate, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

type Step = 'status' | 'generate' | 'review';

function SummaryGrid({ summary }: { summary: PlanSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div className="rounded-lg border-[0.5px] border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xl font-semibold text-slate-900">{summary.totalCandidates.toLocaleString()}</p>
        <p className="text-[12px] text-slate-500">Candidates considered</p>
      </div>
      <div className="rounded-lg border-[0.5px] border-emerald-200 bg-emerald-50 px-4 py-3">
        <p className="text-xl font-semibold text-emerald-700">{summary.assignedCount.toLocaleString()}</p>
        <p className="text-[12px] text-emerald-700/80">Seated</p>
      </div>
      <div className="rounded-lg border-[0.5px] border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-xl font-semibold text-amber-700">{summary.unassignedCount.toLocaleString()}</p>
        <p className="text-[12px] text-amber-700/80">Overflow</p>
      </div>
      <div className="rounded-lg border-[0.5px] border-brand-200 bg-brand-50 px-4 py-3">
        <p className="text-xl font-semibold text-brand-700">{summary.sessionsUsed}</p>
        <p className="text-[12px] text-brand-700/80">Sessions used</p>
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const router = useRouter();
  const { success, error } = useToast();
  const [status, setStatus] = useState<ScheduleStatus | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<SchedulePreview | null>(null);
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [overflow, setOverflow] = useState<Array<{ id: string; name: string }>>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, sessionRes] = await Promise.all([
        apiGet<{ data: ScheduleStatus }>('/api/schedule/status'),
        apiGet<{ data: Session[] }>('/api/sessions'),
      ]);
      setStatus(statusRes.data);
      setSessions(sessionRes.data);
      if (statusRes.data.sessionIds && statusRes.data.sessionIds.length > 0) {
        setSelected(new Set(statusRes.data.sessionIds));
      } else if (sessionRes.data.length > 0) {
        setSelected(new Set(sessionRes.data.map((s) => s.id)));
      }
    } catch {
      error('Could not load schedule data', undefined);
    } finally {
      setLoading(false);
    }
  }, [error]);

  const loadPreview = useCallback(async () => {
    try {
      const res = await apiGet<{ data: SchedulePreview }>('/api/schedule/preview');
      setPreview(res.data);
      setStatus((prev) => (prev ? { ...prev, status: res.data.status } : prev));
    } catch {
      setPreview(null);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (status && (status.status === 'draft' || status.status === 'confirmed')) {
      void loadPreview();
    }
  }, [status?.status, loadPreview]);

  async function generate() {
    if (selected.size === 0) {
      error('Select at least one session', 'The engine needs exam slots to place candidates.');
      return;
    }
    setGenerating(true);
    try {
      const res = await apiPost<{ data: { status: string; summary: PlanSummary; unassigned: Array<{ id: string; name: string }> } }>(
        '/api/schedule/generate',
        { sessionIds: [...selected] }
      );
      setOverflow(res.data.unassigned);
      setPreview((prev) => (prev ? { ...prev, status: res.data.status as ScheduleState, summary: res.data.summary } : prev));
      setStatus((prev) =>
        prev ? { ...prev, status: 'draft' as ScheduleState, summary: res.data.summary } : prev
      );
      success('Schedule generated', `${res.data.summary.assignedCount} candidates seated across ${res.data.summary.sessionsUsed} sessions.`);
      void loadPreview();
    } catch (err) {
      error('Generation failed', err instanceof Error ? err.message : undefined);
    } finally {
      setGenerating(false);
    }
  }

  async function confirm() {
    setConfirming(true);
    try {
      const res = await apiPost<{ data: { status: string; assignmentCount: number } }>('/api/schedule/confirm');
      setStatus((prev) => (prev ? { ...prev, status: res.data.status as ScheduleState } : prev));
      setPreview((prev) => (prev ? { ...prev, status: res.data.status as ScheduleState } : prev));
      success('Schedule confirmed', `${res.data.assignmentCount} assignments are now locked in.`);
    } catch (err) {
      error('Could not confirm', err instanceof Error ? err.message : undefined);
    } finally {
      setConfirming(false);
    }
  }

  async function clearSchedule() {
    setClearing(true);
    try {
      await apiPost<{ data: { status: string } }>('/api/schedule/clear');
      setStatus((prev) => (prev ? { ...prev, status: 'none', summary: null, sessionIds: [] } : prev));
      setPreview(null);
      setOverflow([]);
      success('Schedule cleared', 'All assignments were removed. Candidates are unscheduled.');
    } catch (err) {
      error('Could not clear schedule', err instanceof Error ? err.message : undefined);
    } finally {
      setClearing(false);
      setClearOpen(false);
    }
  }

  if (loading) return <PageLoader label="Loading schedule…" />;

  const step: Step = status && status.status !== 'none' ? 'review' : 'generate';

  return (
    <div>
      <PageHeader
        title="Scheduling engine"
        description="Automatic hall and seat allocation for the current exam window."
        actions={
          status && status.status !== 'none' ? (
            <Button
              variant="destructive-outline"
              onClick={() => setClearOpen(true)}
              disabled={clearing}
            >
              <Trash2 className="h-4 w-4" /> Clear schedule
            </Button>
          ) : undefined
        }
      />

      {/* Status banner */}
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                status?.status === 'confirmed'
                  ? 'bg-emerald-50 text-emerald-600'
                  : status?.status === 'draft'
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-slate-100 text-slate-400'
              )}
            >
              {status?.status === 'confirmed' ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : status?.status === 'draft' ? (
                <Sparkles className="h-5 w-5" />
              ) : (
                <CalendarClock className="h-5 w-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[14px] font-semibold text-slate-900">
                  Schedule {status?.status === 'none' ? 'not generated' : status?.status === 'draft' ? 'draft ready for review' : 'confirmed'}
                </p>
                <StatusBadge status={status?.status ?? 'none'} />
              </div>
              <p className="mt-0.5 text-[12px] text-slate-500">
                {status?.assignmentCount ?? 0} assignments in place
                {status?.confirmedAt ? ` · confirmed ${new Date(status.confirmedAt).toLocaleString()}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {status?.status !== 'confirmed' && (
              <Button onClick={() => void generate()} disabled={generating || selected.size === 0}>
                {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generating ? 'Generating…' : status?.status === 'draft' ? 'Regenerate' : 'Generate schedule'}
              </Button>
            )}
            {status?.status === 'draft' && (
              <Button variant="secondary" onClick={() => void confirm()} disabled={confirming || (status.assignmentCount ?? 0) === 0}>
                <CheckCircle2 className="h-4 w-4" />
                {confirming ? 'Confirming…' : 'Confirm schedule'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {step === 'generate' && (
        <Card>
          <CardHeader>
            <CardTitle>1 · Choose the exam window</CardTitle>
            <CardDescription>
              Select the sessions to schedule candidates into. The engine will seat candidates into the
              earliest available slot, filling halls to capacity before moving on.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[13px] text-slate-600">
                <span className="font-semibold text-slate-900">{selected.size}</span> of {sessions.length} sessions selected
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set(sessions.map((s) => s.id)))}>
                  Select all
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {sessions.map((s) => {
                const active = selected.has(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      const next = new Set(selected);
                      if (next.has(s.id)) next.delete(s.id);
                      else next.add(s.id);
                      setSelected(next);
                    }}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border-[0.5px] px-4 py-3 text-left transition-colors',
                      active
                        ? 'border-brand-600 bg-brand-50/70'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border-[0.5px]',
                        active ? 'border-brand-600 bg-brand-600' : 'border-slate-300 bg-white'
                      )}
                    >
                      {active && <CheckCircle2 className="h-3 w-3 text-white" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-slate-800">
                        {s.examDate} · {s.name}
                      </p>
                      <p className="text-[12px] text-slate-500">
                        {formatTime(s.startTime)} – {formatTime(s.endTime)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'review' && preview && (
        <div className="space-y-6">
          {preview.summary && <SummaryGrid summary={preview.summary} />}

          {overflow.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg border-[0.5px] border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="text-[13px] text-amber-800">
                <p className="font-semibold">Overflow detected — {overflow.length} candidates could not be seated.</p>
                <p className="mt-0.5">
                  {overflow.slice(0, 6).map((c) => c.id).join(', ')}
                  {overflow.length > 6 && ` +${overflow.length - 6} more`}. Add more sessions or a hall with spare
                  capacity and regenerate.
                </p>
              </div>
            </div>
          )}

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>2 · Review the draft</CardTitle>
                <CardDescription>
                  {preview.status === 'confirmed' ? 'Confirmed placements by hall and session.' : 'Preview the proposed placements before confirming.'}
                </CardDescription>
              </div>
              <Button variant="outline" onClick={() => void loadPreview()}>
                <RefreshCw className="h-4 w-4" /> Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {preview.groups.length === 0 ? (
                <EmptyState
                  icon={<Users className="h-5 w-5" />}
                  title="No assignments in this window"
                  description="Generate the schedule to place candidates into halls and seats."
                />
              ) : (
                <div className="space-y-6">
                  {preview.groups.map((g) => (
                    <div key={`${g.session.id}:${g.hall.id}`}>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[13px] font-semibold text-slate-900">{g.session.examDate}</span>
                          <StatusBadge status={g.session.name.toLowerCase()} />
                          <span className="text-[13px] text-slate-600">
                            {g.session.name} · {formatTime(g.session.startTime)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[12px] font-medium text-slate-700">
                            {g.hall.name}
                          </span>
                          <span className="font-mono text-[12px] text-slate-500">
                            {g.candidates.length}/{g.hall.capacity}
                          </span>
                          <span className="hidden w-24 sm:block">
                            <Progress
                              value={Math.round((g.candidates.length / g.hall.capacity) * 100)}
                              indicatorClassName={g.candidates.length / g.hall.capacity > 0.9 ? 'bg-emerald-500' : 'bg-brand-600'}
                            />
                          </span>
                        </div>
                      </div>
                      <div className="overflow-hidden rounded-lg border-[0.5px] border-slate-200">
                        <table className="w-full text-[13px]">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-3 py-2 text-left font-mono text-[11px] font-semibold uppercase text-slate-500">Seat</th>
                              <th className="px-3 py-2 text-left font-mono text-[11px] font-semibold uppercase text-slate-500">ID</th>
                              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-slate-500">Candidate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.candidates.slice(0, 12).map((c) => (
                              <tr key={`${c.candidateId}:${c.seatNumber}`} className="border-t-[0.5px] border-slate-100">
                                <td className="px-3 py-1.5 font-mono text-[12px] text-brand-700">{c.seatNumber}</td>
                                <td className="px-3 py-1.5 font-mono text-[12px] text-slate-600">{c.candidateId}</td>
                                <td className="px-3 py-1.5 text-slate-800">{c.name}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {g.candidates.length > 12 && (
                          <p className="border-t-[0.5px] border-slate-100 px-3 py-2 text-[12px] text-slate-500">
                            …and {g.candidates.length - 12} more candidates
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {preview.status === 'confirmed' && (
            <div className="flex items-start gap-3 rounded-lg border-[0.5px] border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Schedule confirmed</p>
                <p>
                  Attendance sheets are now available in the{' '}
                  <button onClick={() => router.push('/attendance')} className="font-medium underline hover:text-emerald-900">
                    Attendance sheets
                  </button>{' '}
                  section.
                </p>
              </div>
            </div>
          )}

          {preview.status === 'draft' && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => void generate()}>
                <RefreshCw className="h-4 w-4" /> Regenerate
              </Button>
              <Button variant="secondary" onClick={() => void confirm()} disabled={confirming}>
                <CheckCircle2 className="h-4 w-4" />
                {confirming ? 'Confirming…' : 'Confirm schedule'}
              </Button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={clearSchedule}
        loading={clearing}
        destructive
        title="Clear the entire schedule"
        description="Every candidate will lose their hall, seat and session placement. Attendance sheets will be empty until you regenerate. This cannot be undone."
        confirmLabel="Clear schedule"
      />
    </div>
  );
}
