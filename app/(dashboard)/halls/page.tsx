'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, MapPin, Pencil, Plus } from 'lucide-react';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import type { Hall } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/ui/badge';
import { SkeletonCards } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';

function HallCard({ hall, onEdit }: { hall: Hall; onEdit: () => void }) {
  const router = useRouter();
  const utilization = hall.capacity > 0 ? Math.round(((hall.seatsOccupied ?? 0) / hall.capacity) * 100) : 0;
  return (
    <button
      onClick={() => router.push(`/halls/${hall.id}`)}
      className="card-surface card-surface-hover group flex flex-col p-5 text-left"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-slate-500 transition-colors group-hover:bg-purple-50 group-hover:text-purple-700">
          <Building2 className="h-5 w-5" />
        </div>
        <StatusBadge status={hall.status} />
      </div>
      <h3 className="mt-4 text-[15px] font-semibold text-slate-900">{hall.name}</h3>
      <p className="mt-0.5 text-[13px] text-slate-500">{hall.capacity} seats</p>
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-[12px]">
          <span className="text-slate-500">Occupancy</span>
          <span className="font-mono text-slate-400">
            {hall.seatsOccupied ?? 0}/{hall.seatsTotal ?? 0}
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
        <MapPin className="h-3.5 w-3.5" /> Open seat map
      </div>
      <div className="mt-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-slate-400 hover:text-slate-700"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
      </div>
    </button>
  );
}

export default function HallsPage() {
  const { success, error } = useToast();
  const [halls, setHalls] = useState<Hall[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Hall | null>(null);
  const [form, setForm] = useState({ name: '', capacity: '100', status: 'active' });
  const [saving, setSaving] = useState(false);

  const load = () =>
    apiGet<{ data: Hall[] }>('/api/halls')
      .then((r) => setHalls(r.data))
      .catch(() => setHalls([]))
      .finally(() => setLoading(false));

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setForm({ name: '', capacity: '100', status: 'active' });
    setCreateOpen(true);
  }
  function openEdit(hall: Hall) {
    setForm({ name: hall.name, capacity: String(hall.capacity), status: hall.status });
    setEditing(hall);
  }

  async function save() {
    if (!form.name.trim() || Number(form.capacity) < 10) return;
    setSaving(true);
    try {
      if (editing) {
        await apiPut(`/api/halls/${editing.id}`, {
          name: form.name,
          capacity: Number(form.capacity),
          status: form.status,
        });
        success('Hall updated', `${form.name} saved.`);
      } else {
        await apiPost('/api/halls', { name: form.name, capacity: Number(form.capacity), status: form.status });
        success('Hall created', `${form.name} added with ${form.capacity} seats.`);
      }
      setCreateOpen(false);
      setEditing(null);
      void load();
    } catch (err) {
      error('Could not save hall', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  const totalSeats = halls?.reduce((s, h) => s + h.capacity, 0) ?? 0;

  return (
    <div>
      <PageHeader
        title="Halls"
        description={`${halls?.length ?? 0} venues · ${totalSeats.toLocaleString()} seats in total.`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add hall
          </Button>
        }
      />

      {loading ? (
        <SkeletonCards count={4} />
      ) : halls && halls.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {halls.map((h) => (
            <HallCard key={h.id} hall={h} onEdit={() => openEdit(h)} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<Building2 className="h-5 w-5" />}
            title="No halls yet"
            description="Create a hall to start allocating seats for your examinations."
            action={{ label: 'Add hall', onClick: openCreate }}
          />
        </Card>
      )}

      <Dialog
        open={createOpen || editing !== null}
        onClose={() => {
          setCreateOpen(false);
          setEditing(null);
        }}
        title={editing ? `Edit ${editing.name}` : 'Add hall'}
        description="Halls define the venues candidates are seated in."
        footer={
          <>
            <Button variant="ghost" onClick={() => { setCreateOpen(false); setEditing(null); }} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add hall'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Hall name</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Hall F" />
          </div>
          <div>
            <label className="label">Capacity (seats)</label>
            <Input
              type="number"
              min={10}
              max={2000}
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Status</label>
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </Select>
            <p className="mt-1 text-[12px] text-slate-500">
              Disabled halls are excluded from automatic scheduling.
            </p>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
