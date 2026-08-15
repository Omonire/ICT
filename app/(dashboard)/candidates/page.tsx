'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowUpDown, ChevronUp, ChevronDown, Eye, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api';
import { ApiRequestError } from '@/lib/api';
import type { Candidate, CareerGroup, Hall, Paginated, Session } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';
import { Select, Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { SkeletonTable } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Menu } from '@/components/ui/menu';
import { useToast } from '@/components/ui/toast';
import { formatDate } from '@/lib/format';

interface CandidatesQuery {
  page: number;
  limit: number;
  search: string;
  status: string;
  careerGroupId: string;
  hallId: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

const DEFAULT_QUERY: CandidatesQuery = {
  page: 1,
  limit: 25,
  search: '',
  status: '',
  careerGroupId: '',
  hallId: '',
  sortBy: 'id',
  sortOrder: 'asc',
};

function SortHeader({
  label,
  column,
  query,
  setQuery,
}: {
  label: string;
  column: string;
  query: CandidatesQuery;
  setQuery: (q: CandidatesQuery) => void;
}) {
  const active = query.sortBy === column;
  return (
    <button
      className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-slate-700"
      onClick={() =>
        setQuery({
          ...query,
          sortBy: column,
          sortOrder: active && query.sortOrder === 'asc' ? 'desc' : 'asc',
        })
      }
    >
      {label}
      {active ? (
        query.sortOrder === 'asc' ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      )}
    </button>
  );
}

export default function CandidatesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { success, error } = useToast();

  const [query, setQuery] = useState<CandidatesQuery>(() => ({
    ...DEFAULT_QUERY,
    search: searchParams.get('search') ?? '',
  }));
  const [data, setData] = useState<Paginated<Candidate> | null>(null);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<CareerGroup[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editCandidate, setEditCandidate] = useState<Candidate | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Candidate | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    apiGet<{ data: CareerGroup[] }>('/api/career-groups')
      .then((r) => setGroups(r.data))
      .catch(() => undefined);
    apiGet<{ data: Hall[] }>('/api/halls')
      .then((r) => setHalls(r.data))
      .catch(() => undefined);
    apiGet<{ data: Session[] }>('/api/sessions')
      .then((r) => setSessions(r.data))
      .catch(() => undefined);
  }, []);

  const fetchCandidates = useCallback(
    async (q: CandidatesQuery) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('page', String(q.page));
        params.set('limit', String(q.limit));
        if (q.search) params.set('search', q.search);
        if (q.status) params.set('status', q.status);
        if (q.careerGroupId) params.set('careerGroupId', q.careerGroupId);
        if (q.hallId) params.set('hallId', q.hallId);
        params.set('sortBy', q.sortBy);
        params.set('sortOrder', q.sortOrder);
        const res = await apiGet<Paginated<Candidate>>(`/api/candidates?${params}`);
        setData(res);
      } catch (err) {
        error('Failed to load candidates', err instanceof Error ? err.message : undefined);
      } finally {
        setLoading(false);
      }
    },
    [error]
  );

  useEffect(() => {
    void fetchCandidates(query);
  }, [query, fetchCandidates]);

  const setQueryDebounced = useCallback(
    (partial: Partial<CandidatesQuery>) => {
      setQuery((prev) => ({ ...prev, ...partial, page: 1 }));
    },
    []
  );

  const queryString = useMemo(
    () =>
      new URLSearchParams({
        page: String(query.page),
        limit: String(query.limit),
        ...(query.search ? { search: query.search } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.careerGroupId ? { careerGroupId: query.careerGroupId } : {}),
        ...(query.hallId ? { hallId: query.hallId } : {}),
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      }).toString(),
    [query]
  );

  function confirmDelete() {
    if (!deleteCandidate) return;
    setDeleting(true);
    apiDelete(`/api/candidates/${deleteCandidate.id}`)
      .then(() => {
        success('Candidate removed', `${deleteCandidate.id} was deleted.`);
        setDeleteCandidate(null);
        void fetchCandidates(query);
      })
      .catch((err) => error('Could not delete candidate', err instanceof Error ? err.message : undefined))
      .finally(() => setDeleting(false));
  }

  const totalCapacity = halls.reduce((s, h) => s + h.capacity, 0);

  return (
    <div>
      <PageHeader
        title="Candidates"
        description="Search, filter and manage every registered candidate."
        actions={
          <>
            <Button variant="outline" onClick={() => router.push('/candidates/import')}>
              <Upload className="h-4 w-4" /> Import CSV
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add candidate
            </Button>
          </>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b-[0.5px] border-slate-100 px-4 py-3">
          <SearchInput
            value={query.search}
            onChange={(v) => setQueryDebounced({ search: v })}
            placeholder="Search by ID, name, email or matric…"
            className="min-w-[240px] flex-1 sm:max-w-xs"
          />
          <Select
            className="w-auto"
            value={query.status}
            onChange={(e) => setQueryDebounced({ status: e.target.value })}
          >
            <option value="">All statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="unscheduled">Unscheduled</option>
            <option value="completed">Completed</option>
          </Select>
          <Select
            className="w-auto"
            value={query.careerGroupId}
            onChange={(e) => setQueryDebounced({ careerGroupId: e.target.value })}
          >
            <option value="">All groups</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </Select>
          <Select
            className="w-auto"
            value={query.hallId}
            onChange={(e) => setQueryDebounced({ hallId: e.target.value })}
          >
            <option value="">All halls</option>
            {halls.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </Select>
        </div>

        {loading ? (
          <div className="px-4 py-4">
            <SkeletonTable rows={10} cols={7} />
          </div>
        ) : data && data.data.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>
                    <SortHeader label="ID" column="id" query={query} setQuery={setQuery} />
                  </TableHead>
                  <TableHead>
                    <SortHeader label="Candidate" column="name" query={query} setQuery={setQuery} />
                  </TableHead>
                  <TableHead>Programme</TableHead>
                  <TableHead>
                    <SortHeader label="Status" column="status" query={query} setQuery={setQuery} />
                  </TableHead>
                  <TableHead>Hall / Seat</TableHead>
                  <TableHead>
                    <SortHeader label="Exam date" column="assignedExamDate" query={query} setQuery={setQuery} />
                  </TableHead>
                  <TableHead className="w-10 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-[12px] text-brand-700">{c.id}</TableCell>
                    <TableCell>
                      <p className="font-medium text-slate-800">{c.name}</p>
                      <p className="font-mono text-[11px] text-slate-400">{c.email}</p>
                    </TableCell>
                    <TableCell className="text-slate-600">{c.careerGroup?.name ?? '—'}</TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                    <TableCell>
                      {c.assignedHall ? (
                        <span className="flex items-center gap-1.5 text-[13px] text-slate-700">
                          <span className="font-medium">{c.assignedHall.name}</span>
                          <span className="font-mono text-[12px] text-slate-500">{c.assignedSeatNumber}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-[12px] text-slate-600">
                      {c.assignedExamDate ? formatDate(c.assignedExamDate) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Menu
                        items={[
                          {
                            label: 'View details',
                            icon: <Eye className="h-3.5 w-3.5" />,
                            onClick: () => setEditCandidate(c),
                          },
                          {
                            label: 'Edit',
                            icon: <Pencil className="h-3.5 w-3.5" />,
                            onClick: () => setEditCandidate(c),
                          },
                          {
                            label: 'Delete',
                            icon: <Trash2 className="h-3.5 w-3.5" />,
                            destructive: true,
                            onClick: () => setDeleteCandidate(c),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              page={data.meta.page}
              totalPages={data.meta.totalPages}
              total={data.meta.total}
              pageSize={data.meta.limit}
              onPageChange={(page) => setQuery((prev) => ({ ...prev, page }))}
            />
          </>
        ) : (
          <EmptyState
            icon={<Upload className="h-5 w-5" />}
            title="No candidates match"
            description={
              query.search || query.status || query.careerGroupId || query.hallId
                ? 'Try adjusting your search or filters.'
                : 'Import a CSV of candidates to get started.'
            }
            action={
              query.search || query.status || query.careerGroupId || query.hallId
                ? { label: 'Clear filters', onClick: () => setQuery({ ...DEFAULT_QUERY }) }
                : { label: 'Import candidates', onClick: () => router.push('/candidates/import') }
            }
          />
        )}
      </Card>

      {data && (
        <p className="mt-3 text-[12px] text-slate-400">
          Showing results for <span className="font-mono">{queryString.slice(0, 80)}…</span>
        </p>
      )}

      <CandidateForm
        open={addOpen || editCandidate !== null}
        candidate={editCandidate}
        groups={groups}
        halls={halls}
        sessions={sessions}
        totalCapacity={totalCapacity}
        onClose={() => {
          setAddOpen(false);
          setEditCandidate(null);
        }}
        onSaved={() => {
          setAddOpen(false);
          setEditCandidate(null);
          void fetchCandidates(query);
        }}
      />

      <ConfirmDialog
        open={deleteCandidate !== null}
        onClose={() => setDeleteCandidate(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        destructive
        title="Delete candidate"
        description={`${deleteCandidate?.id} — ${deleteCandidate?.name} will be permanently removed from the examination register. This cannot be undone.`}
        confirmLabel="Delete candidate"
      />
    </div>
  );
}

function CandidateForm({
  open,
  candidate,
  groups,
  halls,
  sessions,
  totalCapacity,
  onClose,
  onSaved,
}: {
  open: boolean;
  candidate: Candidate | null;
  groups: CareerGroup[];
  halls: Hall[];
  sessions: Session[];
  totalCapacity: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { success, error } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    matricNo: '',
    careerGroupId: '',
    status: 'unscheduled',
  });
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (candidate) {
      setForm({
        name: candidate.name,
        email: candidate.email,
        matricNo: candidate.matricNo ?? '',
        careerGroupId: candidate.careerGroupId,
        status: candidate.status,
      });
    } else {
      setForm({ name: '', email: '', matricNo: '', careerGroupId: groups[0]?.id ?? '', status: 'unscheduled' });
    }
  }, [candidate, groups]);

  async function save() {
    setFieldError(null);
    if (!form.name.trim() || !form.email.trim() || !form.careerGroupId) {
      setFieldError('Name, email and programme are required.');
      return;
    }
    setSaving(true);
    try {
      if (candidate) {
        await apiPut(`/api/candidates/${candidate.id}`, form);
        success('Candidate updated', `${candidate.id} saved.`);
      } else {
        await apiPost('/api/candidates', form);
        success('Candidate added', 'Registered successfully.');
      }
      onSaved();
    } catch (err) {
      error('Could not save candidate', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={candidate ? `Edit ${candidate.id}` : 'Add candidate'}
      description={
        candidate
          ? `Update the record for ${candidate.name}.`
          : `Register a new candidate. ${totalCapacity.toLocaleString()} seats available across ${halls.length} halls.`
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : candidate ? 'Save changes' : 'Add candidate'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {fieldError && (
          <div className="rounded-lg border-[0.5px] border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
            {fieldError}
          </div>
        )}
        <div>
          <label className="label">Full name</label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Adaeze Adeyemi" />
        </div>
        <div>
          <label className="label">Email</label>
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" placeholder="student@university.edu" />
        </div>
        <div>
          <label className="label">Matric / reg number</label>
          <Input value={form.matricNo} onChange={(e) => setForm({ ...form, matricNo: e.target.value })} placeholder="FUT/2025/123" />
        </div>
        <div>
          <label className="label">Programme</label>
          <Select value={form.careerGroupId} onChange={(e) => setForm({ ...form, careerGroupId: e.target.value })}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </Select>
        </div>
        {candidate && (
          <div>
            <label className="label">Status</label>
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="unscheduled">Unscheduled</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
            </Select>
          </div>
        )}
        {candidate && (
          <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-[12px] text-slate-600">
            {candidate.assignedHall ? (
              <>
                Assigned to <span className="font-semibold">{candidate.assignedHall.name}</span> seat{' '}
                <span className="font-mono">{candidate.assignedSeatNumber}</span>
                {candidate.assignedExamDate && <> on {formatDate(candidate.assignedExamDate)}</>}.
              </>
            ) : (
              'Not yet assigned to a hall.'
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
