'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Database,
  Loader2,
  Rocket,
  Shield,
  ShieldOff,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-context';
import { useToast } from '@/components/ui/toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import type { Session } from '@/lib/types';

export default function SuperadminPage() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const [maintenance, setMaintenance] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [seedSessionId, setSeedSessionId] = useState('');
  const [seedCount, setSeedCount] = useState(50);

  const loadSessions = useCallback(() => {
    apiGet<{ data: Session[] }>('/api/sessions')
      .then((r) => {
        setSessions(r.data);
        if (r.data.length > 0 && !seedSessionId) setSeedSessionId(r.data[0].id);
      })
      .catch(() => {});
  }, [seedSessionId]);

  useEffect(() => {
    if (user) loadSessions();
  }, [user, loadSessions]);

  if (user?.role !== 'superadmin') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <ShieldOff className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-4 text-[15px] font-semibold text-slate-700">Access denied</p>
          <p className="mt-1 text-[13px] text-slate-400">Superadmin access required.</p>
        </div>
      </div>
    );
  }

  async function toggleMaintenance() {
    setLoading('maintenance');
    try {
      const res = await apiPost<{ maintenance: boolean }>('/api/admin/maintenance', { enabled: !maintenance });
      setMaintenance(res.maintenance);
      success('Maintenance mode', res.maintenance ? 'Enabled — non-admin users cannot access the system.' : 'Disabled — system is live.');
    } catch (err) {
      toastError('Failed', err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(null);
    }
  }

  async function purgeSessions() {
    setLoading('purge-sessions');
    try {
      await apiPost('/api/admin/purge-sessions', {});
      success('Sessions purged', 'All sessions cleared. Candidates reset to unscheduled. Halls preserved.');
      loadSessions();
    } catch (err) {
      toastError('Failed', err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(null);
    }
  }

  async function fullPurge() {
    setLoading('full-purge');
    try {
      await apiPost('/api/admin/purge', {});
      success('System purged', 'All data cleared except user accounts.');
      loadSessions();
    } catch (err) {
      toastError('Failed', err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(null);
    }
  }

  async function reseed() {
    setLoading('reseed');
    try {
      const res = await apiPost<{ candidateCount: number; message: string }>('/api/admin/seed', {});
      success('System seeded', res.message);
      loadSessions();
    } catch (err) {
      toastError('Failed', err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(null);
    }
  }

  async function seedForSession() {
    if (!seedSessionId) return;
    setLoading('seed-session');
    try {
      const res = await apiPost<{ message: string; candidatesAdded: number; assigned: number }>(
        '/api/admin/seed-for-session',
        { sessionId: seedSessionId, count: seedCount }
      );
      success('Session seeded', res.message);
    } catch (err) {
      toastError('Failed', err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(null);
    }
  }

  const isBusy = loading !== null;

  return (
    <div className="page-animate">
      <PageHeader
        title="Superadmin Panel"
        description="System-level controls. Use with caution — these actions are irreversible."
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {/* Maintenance Mode */}
        <Card className="p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-[15px] font-semibold text-slate-900">Maintenance Mode</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-400">
                Block all non-admin access. Admins and superadmins can still use the system.
              </p>
              <Button
                variant={maintenance ? 'destructive' : 'outline'}
                size="sm"
                className="mt-3"
                disabled={isBusy}
                onClick={() => void toggleMaintenance()}
              >
                {loading === 'maintenance' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {maintenance ? 'Disable Maintenance' : 'Enable Maintenance'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Seed Session */}
        <Card className="p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <Rocket className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-[15px] font-semibold text-slate-900">Seed Session</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-400">
                Generate and assign candidates directly into a specific session.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Session</label>
                  <select
                    className="input-field text-[13px]"
                    value={seedSessionId}
                    onChange={(e) => setSeedSessionId(e.target.value)}
                  >
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {s.examDate}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-24">
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Count</label>
                  <Input
                    type="number"
                    min={1}
                    max={5000}
                    value={seedCount}
                    onChange={(e) => setSeedCount(Number(e.target.value))}
                    className="text-[13px]"
                  />
                </div>
                <Button size="sm" disabled={isBusy || !seedSessionId} onClick={() => void seedForSession()}>
                  {loading === 'seed-session' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  <Zap className="h-3.5 w-3.5" /> Seed
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Purge Sessions */}
        <Card className="p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <Trash2 className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-[15px] font-semibold text-slate-900">Purge Sessions</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-400">
                Remove all sessions, assignments and seat data. Candidates are preserved but reset to unscheduled. Halls are kept.
              </p>
              <Button variant="destructive" size="sm" className="mt-3" disabled={isBusy} onClick={() => void purgeSessions()}>
                {loading === 'purge-sessions' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                <Trash2 className="h-3.5 w-3.5" /> Purge Sessions
              </Button>
            </div>
          </div>
        </Card>

        {/* Full Purge */}
        <Card className="p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <Database className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-[15px] font-semibold text-slate-900">Full System Purge</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-400">
                Nuke everything — candidates, sessions, halls, seats, career groups. User accounts are preserved.
              </p>
              <Button variant="destructive" size="sm" className="mt-3" disabled={isBusy} onClick={() => void fullPurge()}>
                {loading === 'full-purge' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                <Database className="h-3.5 w-3.5" /> Full Purge
              </Button>
            </div>
          </div>
        </Card>

        {/* Reseed */}
        <Card className="p-5 sm:col-span-2">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-50 text-gold-600">
              <Users className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-[15px] font-semibold text-slate-900">Reseed Demo Data</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-400">
                Populate the system with 520 demo candidates, 5 halls, 12 sessions and 260 pre-assigned placements.
                Safe to run on an empty or already-seeded database.
              </p>
              <Button variant="outline" size="sm" className="mt-3" disabled={isBusy} onClick={() => void reseed()}>
                {loading === 'reseed' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                <Rocket className="h-3.5 w-3.5" /> Reseed System
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
