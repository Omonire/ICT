'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Armchair, Building2 } from 'lucide-react';
import { apiGet } from '@/lib/api';
import type { Hall, Seat, Session, Candidate } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/ui/badge';
import { PageLoader } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

interface SeatMapData {
  hall: Hall;
  seats: Seat[];
}

export default function HallDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<SeatMapData | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [seatCandidate, setSeatCandidate] = useState<Candidate | null>(null);
  const [candidateLoading, setCandidateLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sessionId) params.set('sessionId', sessionId);
      const res = await apiGet<{ data: SeatMapData }>(`/api/seats/${id}?${params}`);
      setData(res.data);
    } finally {
      setLoading(false);
    }
  }, [id, sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    apiGet<{ data: Session[] }>('/api/sessions')
      .then((r) => {
        setSessions(r.data);
        if (!sessionId && r.data.length > 0) setSessionId(r.data[0].id);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (selectedSeat?.candidateId) {
      setCandidateLoading(true);
      apiGet<{ data: Candidate }>(`/api/candidates/${selectedSeat.candidateId}`)
        .then((r) => setSeatCandidate(r.data))
        .catch(() => setSeatCandidate(null))
        .finally(() => setCandidateLoading(false));
    } else {
      setSeatCandidate(null);
    }
  }, [selectedSeat]);

  if (loading && !data) return <PageLoader label="Loading seat map…" />;
  if (!data) return <EmptyState title="Hall not found" description="This hall may have been removed." />;

  const hall = data.hall;
  const occupied = data.seats.filter((s) => s.status === 'occupied').length;
  const utilization = hall.capacity > 0 ? Math.round((occupied / hall.capacity) * 100) : 0;
  const activeSession = sessions.find((s) => s.id === sessionId);

  return (
    <div>
      <PageHeader
        title={hall.name}
        description={`${hall.capacity.toLocaleString()} seats · ${occupied.toLocaleString()} occupied`}
        actions={
          <Link
            href="/halls"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border-[0.5px] border-slate-300 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" /> All halls
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <StatusBadge status={hall.status} />
          <span className="text-[13px] text-slate-500">
            Utilization <span className="font-mono font-medium text-slate-700">{utilization}%</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[13px] font-medium text-slate-600">Viewing session</label>
          <Select className="w-auto" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.examDate} · {s.name} ({s.startTime})
              </option>
            ))}
          </Select>
        </div>
      </div>

      {activeSession && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href={`/attendance/sheet/${activeSession.id}/${hall.id}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border-[0.5px] border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
          >
            Print attendance sheet for this session
          </Link>
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between border-b-[0.5px] border-slate-100 px-5 py-3">
          <p className="text-[13px] font-semibold text-slate-700">Seat plan</p>
          <div className="flex items-center gap-4 text-[12px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-slate-200" /> Available
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-purple-600" /> Occupied
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-slate-400" /> Click for details
            </span>
          </div>
        </div>
        <div className="px-5 py-6">
          {loading ? (
            <div className="grid grid-cols-8 gap-2 sm:grid-cols-12 md:grid-cols-16">
              {Array.from({ length: 80 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded bg-slate-100" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-14 xl:grid-cols-16">
              {data.seats.map((seat) => {
                const occupiedSeat = seat.status === 'occupied';
                return (
                  <button
                    key={seat.id}
                    onClick={() => setSelectedSeat(seat)}
                    title={`${seat.seatNumber}${seat.candidateId ? ` · ${seat.candidateId}` : ''}`}
                    className={cn(
                      'group flex aspect-square items-center justify-center rounded-md border-[0.5px] transition-all',
                      occupiedSeat
                        ? 'border-purple-700 bg-purple-600 text-purple-50 shadow-sm hover:ring-2 hover:ring-purple-500'
                        : 'border-slate-200 bg-slate-50 text-slate-400 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700'
                    )}
                  >
                    <span className="font-mono text-[9px] font-medium sm:text-[10px]">
                      {seat.seatNumber.split('-')[1]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      <Dialog
        open={selectedSeat !== null}
        onClose={() => setSelectedSeat(null)}
        title={selectedSeat ? `Seat ${selectedSeat.seatNumber}` : ''}
        description={activeSession ? `${activeSession.examDate} · ${activeSession.name} session` : undefined}
        footer={
          selectedSeat?.candidateId ? (
            <Link
              href={`/candidates?search=${encodeURIComponent(selectedSeat.candidateId)}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-purple-600 px-4 text-sm font-medium text-white hover:bg-purple-700"
            >
              View candidate record
            </Link>
          ) : undefined
        }
      >
        {selectedSeat && (
          <div>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-lg',
                  selectedSeat.status === 'occupied' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-400'
                )}
              >
                <Armchair className="h-6 w-6" />
              </div>
              <div>
                <p className="font-mono text-sm font-semibold text-slate-900">{selectedSeat.seatNumber}</p>
                <StatusBadge status={selectedSeat.status} />
              </div>
            </div>

            {selectedSeat.status === 'occupied' && selectedSeat.candidateId && (
              <div className="mt-5 rounded-lg border-[0.5px] border-slate-200 bg-slate-50 p-4">
                {candidateLoading ? (
                  <p className="text-[13px] text-slate-500">Loading candidate…</p>
                ) : seatCandidate ? (
                  <div className="space-y-1.5 text-[13px]">
                    <p className="font-semibold text-slate-900">{seatCandidate.name}</p>
                    <p className="font-mono text-[12px] text-purple-700">{seatCandidate.id}</p>
                    <p className="text-slate-600">{seatCandidate.careerGroup?.name ?? '—'}</p>
                    <p className="font-mono text-[12px] text-slate-500">{seatCandidate.matricNo ?? ''}</p>
                    <p className="text-slate-500">
                      Exam date: {seatCandidate.assignedExamDate ? formatDate(seatCandidate.assignedExamDate) : '—'}
                    </p>
                  </div>
                ) : (
                  <p className="text-[13px] text-slate-500">Candidate details unavailable.</p>
                )}
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
