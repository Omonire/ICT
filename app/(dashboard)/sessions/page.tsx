'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Clock, Plus, Trash2 } from 'lucide-react';
import { apiDelete, apiGet, apiPost } from '@/lib/api';
import type { Session } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SkeletonTable } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { formatDate, formatTime } from '@/lib/format';

export default function SessionsPage() {
  const { success, error } = useToast();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<Session | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [form, setForm] = useState({
    name: 'Morning',
    examDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    startTime: '09:00',
    endTime: '11:00',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    apiGet<{ data: Session[] }>('/api/sessions')
      .then((r) => setSessions(r.data))
      .catch(() => setSessions([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createSession() {
    if (!form.examDate) return;
    setSaving(true);
    try {
      await apiPost('/api/sessions', form);
      success('Session created', `${form.name} · ${form.examDate}`);
      setCreateOpen(false);
      load();
    } catch (err) {
      error('Could not create session', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!deleting) return;
    setDeletingBusy(true);
    apiDelete(`/api/sessions/${deleting.id}`)
      .then(() => {
        success('Session removed', `${deleting.name} · ${deleting.examDate} deleted.`);
        setDeleting(null);
        load();
      })
      .catch((err) => error('Could not delete session', err instanceof Error ? err.message : undefined))
      .finally(() => setDeletingBusy(false));
  }

  const groups = (sessions ?? []).reduce<Record<string, Session[]>>((acc, s) => {
    (acc[s.examDate] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Sessions"
        description="Morning and afternoon exam slots across the examination window."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Add session
          </Button>
        }
      />

      {!sessions ? (
        <Card>
          <div className="p-4">
            <SkeletonTable rows={6} cols={5} />
          </div>
        </Card>
      ) : sessions.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarDays className="h-5 w-5" />}
            title="No sessions yet"
            description="Create your first Morning or Afternoon session to open the exam window."
            action={{ label: 'Add session', onClick: () => setCreateOpen(true) }}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([date, daySessions]) => (
            <div key={date}>
              <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-slate-500">
                {formatDate(date)}
              </h2>
              <Card className="divide-y-[0.5px] divide-slate-100">
                {daySessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50/60">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                        <Clock className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold text-slate-900">{s.name} session</p>
                        <p className="mt-0.5 text-[12px] text-slate-500">
                          {formatTime(s.startTime)} – {formatTime(s.endTime)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[12px] text-slate-400">{date}</span>
                      <button
                        onClick={() => setDeleting(s)}
                        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        aria-label="Delete session"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add session"
        description="Sessions define when exams take place. Candidates are scheduled into these slots."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={() => void createSession()} disabled={saving}>
              {saving ? 'Creating…' : 'Create session'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Session name</label>
            <div className="flex gap-2">
              {['Morning', 'Afternoon'].map((n) => (
                <button
                  key={n}
                  onClick={() => setForm({ ...form, name: n })}
                  className={`flex-1 rounded-lg border-[0.5px] px-3 py-2 text-[13px] font-medium transition-colors ${
                    form.name === n ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="col-span-2">
            <label className="label">Exam date</label>
            <Input
              type="date"
              value={form.examDate}
              onChange={(e) => setForm({ ...form, examDate: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Start time</label>
            <Input
              type="time"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            />
          </div>
          <div>
            <label className="label">End time</label>
            <Input
              type="time"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            />
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={deletingBusy}
        destructive
        title="Delete session"
        description={`${deleting?.name} session on ${deleting ? formatDate(deleting.examDate) : ''} will be removed. Any scheduled candidates for this slot will lose their placement.`}
        confirmLabel="Delete session"
      />
    </div>
  );
}
