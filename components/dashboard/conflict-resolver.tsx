'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Zap } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import type { ScheduleConflict } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

interface ConflictSuggestion {
  conflictId: string;
  candidateName: string;
  currentSession: string;
  currentHall: string;
  suggestedSession: string;
  suggestedHall: string;
  reason: string;
}

export function ConflictResolver() {
  const { success, error } = useToast();
  const [conflicts, setConflicts] = useState<ScheduleConflict[] | null>(null);
  const [suggestions, setSuggestions] = useState<ConflictSuggestion[] | null>(null);
  const [resolving, setResolving] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);

  const loadConflicts = useCallback(() => {
    apiGet<{ data: ScheduleConflict[] }>('/api/schedule/conflicts')
      .then((r) => setConflicts(r.data))
      .catch(() => setConflicts([]));
  }, []);

  useEffect(() => {
    loadConflicts();
  }, [loadConflicts]);

  const autoResolve = useCallback(async () => {
    setResolving(true);
    try {
      const res = await apiPost<{ data: ConflictSuggestion[] }>('/api/schedule/auto-resolve-conflicts');
      setSuggestions(res.data);
      if (res.data.length === 0) {
        success('No conflicts', 'All conflicts have been resolved.');
        loadConflicts();
      }
    } catch (e) {
      error('Auto-resolve failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setResolving(false);
    }
  }, [success, error, loadConflicts]);

  const applySuggestion = useCallback(
    async (suggestion: ConflictSuggestion) => {
      setApplying(suggestion.conflictId);
      try {
        await apiPost('/api/schedule/resolve-conflict', {
          conflictId: suggestion.conflictId,
          suggestedSessionId: suggestion.suggestedSession,
          suggestedHallId: suggestion.suggestedHall,
        });
        success('Conflict resolved', `${suggestion.candidateName} has been reassigned.`);
        setSuggestions((prev) => prev?.filter((s) => s.conflictId !== suggestion.conflictId) ?? null);
        loadConflicts();
      } catch (e) {
        error('Could not apply resolution', e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setApplying(null);
      }
    },
    [success, error, loadConflicts]
  );

  const openConflicts = conflicts?.filter((c) => c.status === 'open') ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> Schedule conflicts
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void autoResolve()}
            disabled={resolving || openConflicts.length === 0}
          >
            {resolving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : (
              <Zap className="h-3.5 w-3.5 mr-1" />
            )}
            Auto-resolve
          </Button>
        </div>
        <p className="text-[12px] text-slate-500 mt-1">
          {openConflicts.length} open conflict(s) detected.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {conflicts === null ? (
          <p className="text-[13px] text-slate-400">Loading conflicts…</p>
        ) : openConflicts.length === 0 && !suggestions ? (
          <EmptyState
            icon={<CheckCircle2 className="h-5 w-5 text-gold-500" />}
            title="No open conflicts"
            description="All scheduling conflicts have been resolved."
          />
        ) : (
          <>
            {openConflicts.length > 0 && (
              <div className="space-y-2">
                {openConflicts.map((conflict) => (
                  <div
                    key={conflict.id}
                    className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-3"
                  >
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-slate-800">
                        {conflict.candidate?.name ?? 'Unknown candidate'}
                      </p>
                      <p className="text-[12px] text-slate-500 mt-0.5">{conflict.description}</p>
                      <div className="flex gap-2 mt-1.5">
                        <Badge variant="amber">{conflict.conflictType}</Badge>
                        {conflict.firstChoice && (
                          <Badge variant="outline">{conflict.firstChoice}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {suggestions && suggestions.length > 0 && (
              <div className="space-y-2 mt-4">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                  Suggested resolutions
                </p>
                {suggestions.map((s) => (
                  <div
                    key={s.conflictId}
                    className="flex items-start gap-3 rounded-lg border border-purple-200 bg-purple-50/50 px-4 py-3"
                  >
                    <CheckCircle2 className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-slate-800">
                        Move {s.candidateName}
                      </p>
                      <p className="text-[12px] text-slate-500 mt-0.5">
                        {s.currentSession} ({s.currentHall}) → {s.suggestedSession} ({s.suggestedHall})
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{s.reason}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => void applySuggestion(s)}
                      disabled={applying === s.conflictId}
                    >
                      {applying === s.conflictId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : null}
                      Apply
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
