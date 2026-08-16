'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, MapPin, Search } from 'lucide-react';
import { apiGet } from '@/lib/api';
import type { Paginated, Candidate } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/lib/hooks';

interface Results {
  candidates: Candidate[];
}

export default function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounced = useDebounce(query, 300);

  const active = debounced.trim().length > 0;

  useEffect(() => {
    if (!active) {
      setResults(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    apiGet<Paginated<Candidate>>(
      `/api/candidates?search=${encodeURIComponent(debounced)}&limit=6`,
      { signal: ctrl.signal }
    )
      .then((res) => setResults({ candidates: res.data }))
      .catch(() => {
        if (!ctrl.signal.aborted) setResults({ candidates: [] });
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [active, debounced]);

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    router.push(`/candidates?search=${encodeURIComponent(q)}`);
    setOpen(false);
    setQuery('');
  };

  const resultsView = () => {
    if (!active || !results) return null;
    if (results.candidates.length === 0) {
      return (
        <div className="px-4 py-6 text-center text-[13px] text-slate-500">
          No matches for “{debounced}”
        </div>
      );
    }
    return (
      <div className="py-1">
        <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Candidates
        </p>
        {results.candidates.slice(0, 6).map((c) => (
          <Link
            key={c.id}
            href={`/candidates?search=${encodeURIComponent(c.id)}`}
            onClick={() => setOpen(false)}
            className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-slate-50"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 font-mono text-[12px] text-purple-600">{c.id}</span>
              <span className="truncate text-[13px] text-slate-700">{c.name}</span>
            </div>
            <span className="shrink-0 text-[11px] text-slate-400">
              {c.assignedHall ? (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {c.assignedHall.name} · {c.assignedSeatNumber}
                </span>
              ) : (
                'Unassigned'
              )}
            </span>
          </Link>
        ))}
        <button
          onClick={() => void runSearch()}
          className="flex w-full items-center justify-center gap-1.5 border-t-[0.5px] border-slate-100 px-3 py-2.5 text-[12px] font-medium text-purple-700 hover:bg-purple-50"
        >
          See all results <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input
        value={query}
        placeholder="Search by ID, name, hall or session…"
        className="pl-9"
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void runSearch();
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {active && (
        <div className="absolute top-full z-40 mt-1.5 w-full overflow-hidden rounded-lg border-[0.5px] border-slate-200 bg-white shadow-card-hover animate-toast-in">
          {resultsView()}
          {loading && (
            <div className="flex items-center justify-center gap-2 px-4 py-3 text-[12px] text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
