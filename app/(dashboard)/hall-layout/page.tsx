'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Building2, MapPin } from 'lucide-react';
import { apiGet } from '@/lib/api';
import type { Hall, Seat } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SkeletonCards } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';

interface HallWithStats extends Hall {
  seatsTotal: number;
  seatsOccupied: number;
}

interface SeatWithCandidate extends Seat {
  candidate?: { id: string; name: string; email: string } | null;
}

export default function HallLayoutPage() {
  const { error } = useToast();
  const [halls, setHalls] = useState<HallWithStats[] | null>(null);
  const [selectedHall, setSelectedHall] = useState<HallWithStats | null>(null);
  const [seats, setSeats] = useState<SeatWithCandidate[] | null>(null);
  const [loadingSeats, setLoadingSeats] = useState(false);

  const loadHalls = useCallback(() => {
    apiGet<{ data: HallWithStats[] }>('/api/halls')
      .then((r) => setHalls(r.data))
      .catch(() => {
        error('Could not load halls');
        setHalls([]);
      });
  }, [error]);

  useEffect(() => {
    loadHalls();
  }, [loadHalls]);

  const loadSeats = useCallback(
    async (hall: HallWithStats) => {
      setSelectedHall(hall);
      setSeats(null);
      setLoadingSeats(true);
      try {
        const res = await apiGet<{ data: { hall: unknown; seats: SeatWithCandidate[] } }>(`/api/seats?hallId=${hall.id}`);
        setSeats(res.data.seats);
      } catch {
        error('Could not load seats');
        setSeats([]);
      } finally {
        setLoadingSeats(false);
      }
    },
    [error]
  );

  const seatStats = useMemo(() => {
    if (!seats) return { occupied: 0, available: 0, total: 0 };
    const occupied = seats.filter((s) => s.status === 'occupied').length;
    return { occupied, available: seats.length - occupied, total: seats.length };
  }, [seats]);

  const cols = useMemo(() => {
    if (!seats || seats.length === 0) return 10;
    return Math.min(10, Math.ceil(Math.sqrt(seats.length)));
  }, [seats]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hall layout"
        description="Visual floor plan of exam halls and seat assignments."
        actions={
          selectedHall ? (
            <Button variant="outline" onClick={() => { setSelectedHall(null); setSeats(null); }}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to halls
            </Button>
          ) : undefined
        }
      />

      {!halls ? (
        <SkeletonCards count={6} />
      ) : halls.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Building2 className="h-5 w-5" />}
            title="No halls yet"
            description="Create a hall to view its visual layout."
            action={{ label: 'Go to halls', onClick: () => (window.location.href = '/halls') }}
          />
        </Card>
      ) : selectedHall ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-purple-600" />
                {selectedHall.name}
              </CardTitle>
              <div className="flex items-center gap-3 mt-1 text-[12px] text-slate-500">
                <span>Capacity: {selectedHall.capacity}</span>
                <span>·</span>
                <span className="text-gold-600 font-medium">{seatStats.occupied} occupied</span>
                <span>·</span>
                <span className="text-slate-400">{seatStats.available} available</span>
              </div>
            </CardHeader>
            <CardContent>
              {loadingSeats ? (
                <div className="flex items-center justify-center py-16">
                  <p className="text-[13px] text-slate-400">Loading seats…</p>
                </div>
              ) : !seats || seats.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <p className="text-[13px] text-slate-400">No seats configured for this hall.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-[11px] text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded bg-gold-100 border border-gold-300" /> Occupied
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded bg-slate-100 border border-slate-300" /> Available
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded bg-red-100 border border-red-300" /> Conflict
                    </div>
                  </div>

                  <div
                    className="grid gap-1.5"
                    style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                  >
                    {seats.map((seat) => {
                      const isOccupied = seat.status === 'occupied';
                      const candidateName = seat.candidate?.name ?? null;
                      return (
                        <div
                          key={seat.id}
                          className={cn(
                            'group relative flex items-center justify-center rounded-md border px-1 py-2 text-[10px] font-medium transition-colors cursor-default',
                            isOccupied
                              ? 'border-gold-300 bg-gold-50 text-gold-700'
                              : 'border-slate-200 bg-slate-50 text-slate-400'
                          )}
                          title={isOccupied && candidateName ? `${seat.seatNumber} — ${candidateName}` : seat.seatNumber}
                        >
                          <span className="truncate">{seat.seatNumber}</span>
                          {isOccupied && candidateName && (
                            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                              {candidateName}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {halls.map((hall) => {
            const utilization = hall.capacity > 0 ? Math.round(((hall.seatsOccupied ?? 0) / hall.capacity) * 100) : 0;
            return (
              <button
                key={hall.id}
                onClick={() => void loadSeats(hall)}
                className="card-surface card-surface-hover group flex flex-col p-5 text-left"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-slate-500 transition-colors group-hover:bg-purple-50 group-hover:text-purple-700">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <Badge variant={hall.status === 'active' ? 'green' : 'red'}>
                    {hall.status}
                  </Badge>
                </div>
                <h3 className="mt-4 text-[15px] font-semibold text-slate-900">{hall.name}</h3>
                <p className="mt-0.5 text-[13px] text-slate-500">{hall.capacity} seats</p>
                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-[12px]">
                    <span className="text-slate-500">Utilization</span>
                    <span className="font-mono text-slate-400">
                      {hall.seatsOccupied ?? 0}/{hall.seatsTotal ?? hall.capacity}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-purple-600 transition-all duration-300"
                      style={{ width: `${utilization}%` }}
                    />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-[12px] font-medium text-purple-700">
                  <MapPin className="h-3.5 w-3.5" /> View floor plan
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
