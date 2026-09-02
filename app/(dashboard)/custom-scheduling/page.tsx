'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Filter,
  LayoutGrid,
  ListChecks,
  MapPin,
  RefreshCw,
  Search,
  Settings2,
  Users,
} from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import type {
  CustomCombinationAnalysis,
  CustomDaySchedule,
  CustomScheduleResult,
  CustomSchedulingConfig,
  CustomSchedulingPreview,
  CustomSubjectCombination,
  Hall as HallType,
  NeedsAttentionItem,
  ReschedulingEntry,
  ScheduleConflict,
  Session,
  SchedulingRun,
} from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/components/auth/auth-context';
import { SkeletonTable, SkeletonCards } from '@/components/ui/skeleton';
import { AirplaneLoader } from '@/components/ui/airplane-loader';
import { cn } from '@/lib/utils';

// ─── API Endpoints ─────────────────────────────────────────────────────────
const EP = {
  combinations: '/api/schedule/subject-combinations',
  subjects: '/api/schedule/subjects',
  combinationAnalysis: '/api/schedule/combination-analysis',
  preview: '/api/schedule/preview-new',
  generate: '/api/schedule/generate-new',
  priorityGenerate: '/api/schedule/priority-generate',
  regenerateDay: '/api/schedule/regenerate-day',
  regenerateSession: '/api/schedule/regenerate-session',
  reschedulingQueue: '/api/schedule/rescheduling-queue',
  rescheduleCandidate: '/api/schedule/reschedule-candidate',
  rescheduleBulk: '/api/schedule/reschedule-bulk',
  runs: '/api/schedule/runs',
  conflicts: '/api/schedule/conflicts',
  activeConfig: '/api/schedule/configs/active',
  configs: '/api/schedule/configs',
};

// ─── Steps ─────────────────────────────────────────────────────────────────
const STEPS = [
  'Select combination',
  'Analyse candidates',
  'Configure rules',
  'Preview',
  'Generate',
  'View results',
] as const;

// ─── Helpers ───────────────────────────────────────────────────────────────
function formatDate(d: string) {
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-NG', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return d;
  }
}

function formatTime(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${suffix}`;
}

function reasonLabel(reason: string) {
  const map: Record<string, string> = {
    capacity_exceeded: 'Capacity exceeded',
    no_available_session: 'No available session',
    scheduling_conflict: 'Scheduling conflict',
    no_compatible_hall: 'No compatible hall',
    seat_spacing_constraint: 'Seat spacing constraint',
    other: 'Other',
  };
  return map[reason] ?? reason;
}

function reasonColor(reason: string) {
  const map: Record<string, 'amber' | 'red' | 'slate'> = {
    capacity_exceeded: 'amber',
    no_available_session: 'red',
    scheduling_conflict: 'red',
    no_compatible_hall: 'amber',
    seat_spacing_constraint: 'slate',
    other: 'slate',
  };
  return map[reason] ?? 'slate';
}

// ─── Stat Card ─────────────────────────────────────────────────────────────
function Stat({
  label,
  value,
  tone = 'slate',
  icon,
}: {
  label: string;
  value: string | number;
  tone?: 'slate' | 'amber' | 'green' | 'purple' | 'red';
  icon?: React.ReactNode;
}) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    purple: 'border-purple-200 bg-purple-50 text-purple-700',
    red: 'border-red-200 bg-red-50 text-red-700',
  };
  return (
    <div className={cn('rounded-lg border-[0.5px] px-4 py-3', tones[tone])}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-xl font-semibold">{value}</p>
      </div>
      <p className="text-[12px] text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

// ─── Step Indicator ────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: number }) {
  return (
    <div className="grid gap-2 sm:grid-cols-6">
      {STEPS.map((label, i) => (
        <div
          key={label}
          className={cn(
            'flex items-center gap-2 border-b-2 px-2 pb-2 text-[12px] font-medium transition-colors',
            step === i + 1
              ? 'border-purple-600 text-purple-700'
              : step > i + 1
                ? 'border-gold-500 text-gold-700'
                : 'border-slate-200 text-slate-400'
          )}
        >
          <span className="font-mono">0{i + 1}</span>
          <span className="hidden sm:inline">{label}</span>
          {i < 5 && <ChevronRight className="ml-auto hidden h-3.5 w-3.5 sm:block" />}
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
function CustomSchedulingContent() {
  const { user } = useAuth();
  const { error, success, info } = useToast();
  const searchParams = useSearchParams();

  // Step from URL (initial only)
  const urlStep = searchParams.get('step') || 'select';
  const urlKeys = searchParams.get('keys') || '';
  const stepMap: Record<string, number> = { select: 1, analysis: 2, configure: 3, preview: 4, results: 5 };

  const [step, setStep] = useState(stepMap[urlStep] || 1);

  function navigateStep(newStep: number, keys?: string[]) {
    const stepNames = ['select', 'analysis', 'configure', 'preview', 'results'];
    const name = stepNames[newStep - 1] || 'select';
    const k = keys || selectedKeys;
    const url = `/custom-scheduling?step=${name}${k.length > 0 ? `&keys=${k.join(',')}` : ''}`;
    window.history.replaceState(null, '', url);
    setStep(newStep);
  }

  // Data
  const [combinations, setCombinations] = useState<CustomSubjectCombination[] | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<CustomCombinationAnalysis | null>(null);
  const [halls, setHalls] = useState<HallType[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeConfig, setActiveConfig] = useState<CustomSchedulingConfig | null>(null);
  const [configs, setConfigs] = useState<CustomSchedulingConfig[]>([]);
  const [preview, setPreview] = useState<CustomSchedulingPreview | null>(null);
  const [generateResult, setGenerateResult] = useState<CustomScheduleResult | null>(null);
  const [runs, setRuns] = useState<SchedulingRun[]>([]);
  const [queue, setQueue] = useState<ReschedulingEntry[]>([]);
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
  const [needsAttention, setNeedsAttention] = useState<NeedsAttentionItem[]>([]);

  // UI state
  const [selectedKeys, setSelectedKeys] = useState<string[]>(urlKeys ? urlKeys.split(',').filter(Boolean) : []);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [configId, setConfigId] = useState<string | undefined>(undefined);
  const [loadingCombinations, setLoadingCombinations] = useState(true);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [regenConfirm, setRegenConfirm] = useState<{ type: 'day' | 'session'; label: string; payload: Record<string, string> } | null>(null);

  // Create combination modal state
  const [createComboOpen, setCreateComboOpen] = useState(false);
  const [newSubject1, setNewSubject1] = useState('');
  const [newSubject2, setNewSubject2] = useState('');
  const [newSubject3, setNewSubject3] = useState('');
  const [newSubject4, setNewSubject4] = useState('');
  const [newFirstChoice, setNewFirstChoice] = useState('');
  const [creatingCombo, setCreatingCombo] = useState(false);

  // Section refs for auto-scroll
  const sectionRefs = {
    2: useRef<HTMLDivElement>(null),
    3: useRef<HTMLDivElement>(null),
    4: useRef<HTMLDivElement>(null),
    5: useRef<HTMLDivElement>(null),
  };

  function scrollToStep(targetStep: number) {
    const ref = sectionRefs[targetStep as keyof typeof sectionRefs];
    if (ref?.current) {
      setTimeout(() => {
        ref.current!.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    }
  }

  const canCreate = newSubject1.trim() && newSubject2.trim() && newSubject3.trim() && newSubject4.trim();

  function resetCreateForm() {
    setNewSubject1('');
    setNewSubject2('');
    setNewSubject3('');
    setNewSubject4('');
    setNewFirstChoice('');
  }

  // Filter state for results
  const [filterDay, setFilterDay] = useState<string>('');
  const [filterHall, setFilterHall] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState('');

  // Auto-scroll to current step section whenever step changes
  useEffect(() => {
    if (step >= 2) {
      scrollToStep(step);
    }
  }, [step]);

  // ─── Load initial data ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    Promise.allSettled([
      apiGet<{ data: CustomSubjectCombination[] }>(EP.combinations),
      apiGet<{ data: string[] }>(EP.subjects),
      apiGet<{ data: HallType[] }>('/api/halls'),
      apiGet<{ data: Session[] }>('/api/sessions'),
      apiGet<{ data: CustomSchedulingConfig }>(EP.activeConfig),
      apiGet<{ data: CustomSchedulingConfig[] }>(EP.configs),
      apiGet<{ data: SchedulingRun[] }>(EP.runs),
      apiGet<{ data: ReschedulingEntry[] }>(EP.reschedulingQueue),
      apiGet<{ data: ScheduleConflict[] }>(EP.conflicts),
    ]).then(([comboRes, subjRes, hallRes, sessRes, configRes, configsRes, runsRes, queueRes, conflictRes]) => {
      if (comboRes.status === 'fulfilled') setCombinations(comboRes.value.data);
      else setCombinations([]);
      if (subjRes.status === 'fulfilled') setSubjects(subjRes.value.data);
      else setSubjects([]);
      if (hallRes.status === 'fulfilled') setHalls(hallRes.value.data);
      if (sessRes.status === 'fulfilled') setSessions(sessRes.value.data);
      if (configRes.status === 'fulfilled' && configRes.value.data) setActiveConfig(configRes.value.data);
      if (configsRes.status === 'fulfilled') setConfigs(configsRes.value.data);
      if (runsRes.status === 'fulfilled') setRuns(runsRes.value.data);
      if (queueRes.status === 'fulfilled') setQueue(queueRes.value.data);
      if (conflictRes.status === 'fulfilled') setConflicts(conflictRes.value.data);
    }).catch(() => setCombinations([])).finally(() => setLoadingCombinations(false));
  }, [user]);

  // ─── Derived state ──────────────────────────────────────────────────────
  const selectedCombos = useMemo(
    () => combinations?.filter((c) => selectedKeys.includes(c.normalizedKey)) ?? [],
    [combinations, selectedKeys]
  );

  const selected = selectedCombos.length === 1 ? selectedCombos[0] : null;

  const totalCapacity = useMemo(
    () => halls.filter((h) => h.status === 'active').reduce((sum, h) => sum + h.capacity, 0),
    [halls]
  );

  // ─── Load combination analysis ──────────────────────────────────────────
  const loadAnalysis = useCallback(async (normalizedKey: string) => {
    setLoadingAnalysis(true);
    setAnalysis(null);
    try {
      const res = await apiGet<{ data: CustomCombinationAnalysis }>(`${EP.combinationAnalysis}/${encodeURIComponent(normalizedKey)}`);
      setAnalysis(res.data);
    } catch (e) {
      error('Analysis unavailable', e instanceof Error ? e.message : 'Backend endpoint not ready');
    } finally {
      setLoadingAnalysis(false);
    }
  }, [error]);

  // ─── Toggle combination selection ─────────────────────────────────────
  function toggleCombination(key: string) {
    setSelectedKeys((prev) => (prev[0] === key ? [] : [key]));
  }

  // ─── Proceed with selected combinations ──────────────────────────────
  async function proceedWithCombinations() {
    if (selectedKeys.length === 0) return;
    setPreview(null);
    setGenerateResult(null);
    setFilterDay('');
    setFilterHall('');
    setFilterSearch('');
    navigateStep(2, selectedKeys);
    await loadAnalysis(selectedKeys[0]);
  }

  // ─── Create combination ──────────────────────────────────────────────
  async function createCombination() {
    const subjects = [newSubject1, newSubject2, newSubject3, newSubject4]
      .map((s) => s.trim())
      .filter(Boolean);
    if (subjects.length < 2) {
      error('Invalid subjects', 'Enter at least 2 subjects.');
      return;
    }
    setCreatingCombo(true);
    try {
      await apiPost('/api/custom-combinations', {
        subjects,
        firstChoice: newFirstChoice.trim() || undefined,
      });
      success('Combination created', `${subjects.length} subjects saved.`);
      setCreateComboOpen(false);
      resetCreateForm();
      // Refresh combinations list
      const res = await apiGet<{ data: CustomSubjectCombination[] }>(EP.combinations);
      setCombinations(res.data);
    } catch (err) {
      error('Failed to create combination', err instanceof Error ? err.message : undefined);
    } finally {
      setCreatingCombo(false);
    }
  }

  // ─── Toggle session selection ───────────────────────────────────────────
  function toggleSession(sessionId: string) {
    setSelectedSessionIds((prev) =>
      prev.includes(sessionId) ? prev.filter((id) => id !== sessionId) : [...prev, sessionId]
    );
  }

  function selectAllSessions() {
    setSelectedSessionIds(sessions.map((s) => s.id));
  }

  // ─── Load preview ───────────────────────────────────────────────────────
  async function loadPreview() {
    if (selectedKeys.length === 0 || selectedSessionIds.length === 0) {
      error('Missing selection', 'Select at least one combination and one session before previewing.');
      return;
    }
    setLoadingPreview(true);
    setPreview(null);
    try {
      const res = await apiPost<{ data: CustomSchedulingPreview }>(EP.preview, {
        ...(selectedKeys.length === 1
          ? { subjectCombination: selectedKeys[0] }
          : { subjectCombinations: selectedKeys }),
        sessionIds: selectedSessionIds,
        configId,
      }, { timeoutMs: 120000 });
      setPreview(res.data);
      navigateStep(4);
      scrollToStep(4);
    } catch (e) {
      error('Preview failed', e instanceof Error ? e.message : 'The backend preview endpoint returned an error.');
    } finally {
      setLoadingPreview(false);
    }
  }

  // ─── Generate schedule ──────────────────────────────────────────────────
  async function generateSchedule() {
    if (selectedKeys.length === 0 || selectedSessionIds.length === 0) return;
    setGenerating(true);
    try {
      const res = await apiPost<{ data: CustomScheduleResult }>(EP.generate, {
        ...(selectedKeys.length === 1
          ? { subjectCombination: selectedKeys[0] }
          : { subjectCombinations: selectedKeys }),
        sessionIds: selectedSessionIds,
        configId,
      }, { timeoutMs: 180000 });
      setGenerateResult(res.data);
      setConfirmOpen(false);
      navigateStep(5);
      scrollToStep(5);
      success('Schedule generated', `${res.data.scheduledCount} candidates scheduled across ${res.data.dayCount} day(s).`);

      // Refresh runs and queue
      const [runsRes, queueRes] = await Promise.allSettled([
        apiGet<{ data: SchedulingRun[] }>(EP.runs),
        apiGet<{ data: ReschedulingEntry[] }>(EP.reschedulingQueue),
      ]);
      if (runsRes.status === 'fulfilled') setRuns(runsRes.value.data);
      if (queueRes.status === 'fulfilled') setQueue(queueRes.value.data);
    } catch (e) {
      error('Generation failed', e instanceof Error ? e.message : 'The backend generation endpoint returned an error.');
    } finally {
      setGenerating(false);
    }
  }

  // ─── Regenerate ─────────────────────────────────────────────────────────
  async function doRegenerate() {
    if (!regenConfirm || !generateResult) return;
    setRegenerating(regenConfirm.label);
    try {
      let res;
      if (regenConfirm.type === 'day') {
        res = await apiPost<{ data: CustomScheduleResult }>(EP.regenerateDay, {
          runId: generateResult.runId,
          dayDate: regenConfirm.payload.dayDate,
        }, { timeoutMs: 180000 });
      } else {
        res = await apiPost<{ data: CustomScheduleResult }>(EP.regenerateSession, {
          runId: generateResult.runId,
          sessionId: regenConfirm.payload.sessionId,
        }, { timeoutMs: 180000 });
      }
      setGenerateResult(res.data);
      success('Regeneration complete', `${res.data.scheduledCount} candidates scheduled.`);
      const queueRes = await Promise.allSettled([apiGet<{ data: ReschedulingEntry[] }>(EP.reschedulingQueue)]);
      if (queueRes[0].status === 'fulfilled') setQueue(queueRes[0].value.data);
    } catch (e) {
      error('Regeneration failed', e instanceof Error ? e.message : 'Could not regenerate.');
    } finally {
      setRegenerating(null);
      setRegenConfirm(null);
    }
  }

  // ─── View a past run ────────────────────────────────────────────────────
  function viewRun(run: SchedulingRun) {
    if (run.summary && typeof run.summary === 'object') {
      const s = run.summary as Record<string, unknown>;
      info('Run details', `Scheduled: ${s.scheduled ?? run.scheduledCount} | Overflow: ${s.overflow ?? run.overflowCount} | Days: ${s.days ?? run.dayCount}`);
    }
  }

  // ─── Filtered results ──────────────────────────────────────────────────
  const filteredDays = useMemo(() => {
    if (!generateResult) return [];
    let days = generateResult.days ?? [];
    if (filterDay) {
      days = days.filter((d) => d.date === filterDay);
    }
    return days;
  }, [generateResult, filterDay]);

  const uniqueResultDates = useMemo(() => {
    if (!generateResult) return [];
    return [...new Set((generateResult.days ?? []).map((d) => d.date))];
  }, [generateResult]);

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader
        title="Custom scheduling"
        description="Schedule a JAMB subject combination through the backend scheduling engine"
        actions={
          <Badge variant={generateResult ? 'green' : 'outline'}>
            {generateResult ? 'Schedule active' : 'Backend controlled'}
          </Badge>
        }
      />

      <StepIndicator step={step} />

      {/* ─── Step 1: Subject Combinations ─────────────────────────────── */}
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-purple-600" /> Subject combinations
              </span>
              <Button variant="outline" size="sm" onClick={() => setCreateComboOpen(true)}>
                + Create combination
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCombinations ? (
              <SkeletonCards count={4} />
            ) : combinations === null || combinations.length === 0 ? (
              <EmptyState
                icon={<Users className="h-5 w-5" />}
                title="No combinations found"
                description="Import candidate data with JAMB subject columns before starting a custom schedule."
              />
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {selectedKeys.length > 0 && (
                      <p className="text-[13px] text-slate-600">
                        {selectedKeys.length} of {combinations.length} selected
                      </p>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedKeys(selectedKeys.length === combinations.length ? [] : combinations.map((c) => c.normalizedKey))}
                    >
                      {selectedKeys.length === combinations.length ? 'Deselect all' : 'Select all'}
                    </Button>
                  </div>
                  {selectedKeys.length > 0 && (
                    <Button size="sm" onClick={() => void proceedWithCombinations()}>
                      Proceed with {selectedKeys.length} combination{selectedKeys.length !== 1 ? 's' : ''} →
                    </Button>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {combinations.map((combo) => {
                    const isSelected = selectedKeys.includes(combo.normalizedKey);
                    return (
                      <button
                        key={combo.normalizedKey}
                        onClick={() => toggleCombination(combo.normalizedKey)}
                        className={cn(
                          'relative rounded-lg border-2 px-4 py-4 text-left transition-all hover:shadow-sm',
                          isSelected
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-slate-200 hover:border-purple-300 hover:bg-slate-50'
                        )}
                      >
                        <div className="absolute top-3 right-3">
                          <div className={cn(
                            'flex h-6 w-6 items-center justify-center rounded-full border-2',
                            isSelected ? 'border-purple-500 bg-purple-500' : 'border-slate-300 bg-white'
                          )}>
                            {isSelected && <CheckCircle2 className="h-4 w-4 text-white" />}
                          </div>
                        </div>
                        <div className="pr-8">
                          <div className="flex flex-wrap gap-1.5">
                            {combo.subjects.map((s) => (
                              <Badge key={s} variant="outline">{s}</Badge>
                            ))}
                          </div>
                        </div>
                        <p className="mt-3 text-lg font-semibold text-slate-900">
                          {combo.candidateCount.toLocaleString()}
                        </p>
                        <p className="text-[12px] text-slate-500">candidates in this combination</p>
                        {combo.careerGroupName && (
                          <p className="text-[11px] text-slate-400 mt-1">Group: {combo.careerGroupName}</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Examination window</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-xl font-semibold text-slate-900">{sessions.length}</p>
                <p className="text-[12px] text-slate-500">sessions available</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-gold-600" />
              <div>
                <p className="text-xl font-semibold text-slate-900">{halls.filter((h) => h.status === 'active').length}</p>
                <p className="text-[12px] text-slate-500">active halls · {totalCapacity.toLocaleString()} seats</p>
              </div>
            </div>
            {activeConfig && (
              <div className="flex items-center gap-3">
                <Settings2 className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-sm font-medium text-slate-900">{activeConfig.name}</p>
                  <p className="text-[12px] text-slate-500">active config</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ─── Step 2: Candidate Analysis ───────────────────────────────── */}
      {selectedCombos.length > 0 && step >= 2 && (
        <section ref={sectionRefs[2]} className="space-y-4 animate-slide-in">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">Candidate analysis</h2>
              <p className="text-[13px] text-slate-500">
                {selectedCombos.length === 1
                  ? selectedCombos[0].displayName
                  : `${selectedCombos.length} combinations selected`}
              </p>
            </div>
            {step < 3 && (
              <Button size="sm" onClick={() => navigateStep(3)}>
                Configure rules <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>

          {loadingAnalysis ? (
            <SkeletonTable rows={6} cols={4} />
          ) : analysis ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Total candidates" value={analysis.candidateCount.toLocaleString()} tone="purple" icon={<Users className="h-4 w-4" />} />
                <Stat label="Unscheduled" value={analysis.statusBreakdown.unscheduled.toLocaleString()} tone={analysis.statusBreakdown.unscheduled > 0 ? 'amber' : 'green'} />
                <Stat label="Already scheduled" value={analysis.statusBreakdown.scheduled.toLocaleString()} tone="slate" />
                <Stat label="Completed" value={analysis.statusBreakdown.completed.toLocaleString()} tone="slate" />
              </div>

              {(analysis.firstChoiceDistribution ?? []).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-[14px]">First-choice programme distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="divide-y divide-slate-100">
                      {analysis.firstChoiceDistribution.map((fc) => (
                        <div key={fc.firstChoice} className="flex items-center justify-between py-2.5 text-[13px]">
                          <div className="flex items-center gap-3">
                            <span className="text-slate-700 font-medium">{fc.firstChoice}</span>
                            <span className="text-[11px] text-slate-400">{fc.percentage}%</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-purple-500"
                                style={{ width: `${fc.percentage}%` }}
                              />
                            </div>
                            <span className="font-mono font-medium text-slate-900 w-12 text-right">
                              {fc.candidateCount.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <EmptyState
                icon={<AlertTriangle className="h-5 w-5" />}
                title="Analysis not available"
                description="The backend could not provide analysis for this combination."
              />
            </Card>
          )}
        </section>
      )}

      {/* ─── Step 3: Configure Rules ──────────────────────────────────── */}
      {/* ─── Step 3: Configuration ─────────────────────────────────────── */}
      {selectedCombos.length > 0 && step >= 3 && (
        <div ref={sectionRefs[3]} className="animate-slide-in">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-purple-600" /> Scheduling configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Session selection */}
            <div>
              <h3 className="text-[13px] font-semibold text-slate-900 mb-3">Select sessions</h3>
              <div className="flex items-center gap-2 mb-3">
                <Button size="sm" variant="outline" onClick={selectAllSessions}>
                  Select all
                </Button>
                <span className="text-[12px] text-slate-500">
                  {selectedSessionIds.length} of {sessions.length} selected
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-60 overflow-y-auto">
                {sessions.map((session) => (
                  <label
                    key={session.id}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-[13px] cursor-pointer transition-colors',
                      selectedSessionIds.includes(session.id)
                        ? 'border-purple-400 bg-purple-50'
                        : 'border-slate-200 hover:border-slate-300'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSessionIds.includes(session.id)}
                      onChange={() => toggleSession(session.id)}
                      className="h-4 w-4 accent-purple-600"
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 truncate">{session.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {formatDate(session.examDate)} · {formatTime(session.startTime)}–{formatTime(session.endTime)}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Config selection */}
            {configs.length > 0 && (
              <div>
                <h3 className="text-[13px] font-semibold text-slate-900 mb-3">Scheduling config</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setConfigId(undefined)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-[13px] transition-colors',
                      !configId
                        ? 'border-purple-400 bg-purple-50 font-medium text-purple-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    )}
                  >
                    Use active config
                  </button>
                  {configs.map((cfg) => (
                    <button
                      key={cfg.id}
                      onClick={() => setConfigId(cfg.id)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-[13px] transition-colors',
                        configId === cfg.id
                          ? 'border-purple-400 bg-purple-50 font-medium text-purple-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      )}
                    >
                      {cfg.name}
                      {cfg.isActive && <span className="ml-1 text-[10px] text-emerald-600">(active)</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => void loadPreview()} disabled={loadingPreview || selectedSessionIds.length === 0}>
                {loadingPreview ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" /> Generating preview…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Continue to preview <ChevronRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
        </div>
      )}

      {/* ─── Step 4: Preview ──────────────────────────────────────────── */}
      {selectedCombos.length > 0 && step >= 4 && (
        <div ref={sectionRefs[4]} className="animate-slide-in">
        <Card>
          <CardHeader>
            <CardTitle>Preview before generation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Review the backend preview carefully. Generation requires explicit confirmation and persists assignments to the database.</p>
            </div>

            {loadingPreview ? (
              <div className="mt-6">
                <AirplaneLoader label="Computing preview…" />
              </div>
            ) : preview ? (
              <div className="mt-5 space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Stat label="Total candidates" value={preview.candidateCount.toLocaleString()} tone="purple" icon={<Users className="h-4 w-4" />} />
                  <Stat label="Can be scheduled" value={preview.candidatesScheduled.toLocaleString()} tone="green" icon={<CheckCircle2 className="h-4 w-4" />} />
                  <Stat label="Overflow" value={preview.candidatesOverflow.toLocaleString()} tone={preview.candidatesOverflow > 0 ? 'amber' : 'green'} />
                  <Stat label="Capacity utilization" value={`${preview.capacityUtilization}%`} tone={preview.capacityUtilization > 90 ? 'green' : 'amber'} />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Stat label="Estimated days" value={preview.estimatedDays} tone="purple" icon={<CalendarDays className="h-4 w-4" />} />
                  <Stat label="Sessions used" value={preview.sessions.length} tone="slate" icon={<Clock className="h-4 w-4" />} />
                  <Stat label="Halls available" value={preview.availableHalls.length} tone="slate" icon={<MapPin className="h-4 w-4" />} />
                </div>

                {/* Day breakdown preview */}
                {preview.days?.length > 0 && (
                  <div>
                    <h3 className="text-[13px] font-semibold text-slate-900 mb-3">Schedule breakdown</h3>
                    <div className="space-y-3">
                      {preview.days.map((day) => (
                        <div key={day.dayNumber} className="rounded-lg border border-slate-200 overflow-hidden">
                          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                            <Badge variant="brand">DAY {day.dayNumber}</Badge>
                            <span className="text-[13px] font-medium text-slate-700">{formatDate(day.date)}</span>
                            <span className="text-[12px] text-slate-500 ml-auto">
                              {day.sessions.reduce((sum, s) => sum + s.totalAssigned, 0)} candidates
                            </span>
                          </div>
                          <div className="divide-y divide-slate-100">
                            {day.sessions.map((sess) => (
                              <div key={sess.session.id} className="px-4 py-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline">{sess.session.name}</Badge>
                                  <span className="text-[12px] text-slate-500">
                                    {formatTime(sess.session.startTime)}–{formatTime(sess.session.endTime)}
                                  </span>
                                  <span className="text-[12px] text-slate-400 ml-auto">{sess.totalAssigned} assigned</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {sess.halls.map((hall) => (
                                    <div key={hall.hall.id} className="flex items-center gap-1.5 text-[12px] text-slate-600">
                                      <MapPin className="h-3 w-3 text-slate-400" />
                                      <span>{hall.hall.name}</span>
                                      <span className="text-slate-400">({hall.totalAssigned}/{hall.hall.capacity})</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {preview.candidatesCannotSchedule > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
                    <strong>{preview.candidatesCannotSchedule}</strong> candidate(s) cannot be scheduled — no sessions are available.
                  </div>
                )}

                <div className="flex justify-end">
                  <Button onClick={() => setConfirmOpen(true)} disabled={generating}>
                    Confirm & generate <CheckCircle2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-[13px] text-slate-500">The backend preview will appear here once available.</p>
            )}
          </CardContent>
        </Card>
        </div>
      )}

      {/* ─── Step 5/6: Generation loading ─────────────────────────────── */}
      {generating && (
        <Card>
          <CardContent className="py-8">
            <AirplaneLoader label="Generating schedule…" />
          </CardContent>
        </Card>
      )}

      {/* ─── Step 6: Results ──────────────────────────────────────────── */}
      {generateResult && step >= 5 && (
        <section ref={sectionRefs[5]} className="space-y-4 animate-slide-in">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">Generated schedule</h2>
              <p className="text-[13px] text-slate-500">
                {generateResult.displayName} · Run {generateResult.runId?.slice(0, 8) ?? '—'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => { setSelectedKeys([]); navigateStep(1); }}>
                New schedule
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Scheduled" value={(generateResult.scheduledCount ?? 0).toLocaleString()} tone="green" icon={<CheckCircle2 className="h-4 w-4" />} />
            <Stat label="Overflow" value={(generateResult.overflowCount ?? 0).toLocaleString()} tone={(generateResult.overflowCount ?? 0) > 0 ? 'amber' : 'green'} />
            <Stat label="Days" value={generateResult.dayCount ?? 0} tone="purple" icon={<CalendarDays className="h-4 w-4" />} />
            <Stat label="Total candidates" value={(generateResult.candidateCount ?? 0).toLocaleString()} tone="slate" />
          </div>

          {/* Overflow message */}
          {(generateResult.overflowCount ?? 0) > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-800 flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Rescheduling required for {generateResult.overflowCount ?? 0} candidate(s)</p>
                <p className="mt-1">These candidates could not be scheduled due to capacity constraints. They appear in the rescheduling queue below.</p>
              </div>
            </div>
          )}

          {/* Filters */}
          <Card>
            <CardContent className="py-3">
              <div className="flex flex-wrap items-center gap-3">
                <Filter className="h-4 w-4 text-slate-400" />
                <select
                  value={filterDay}
                  onChange={(e) => setFilterDay(e.target.value)}
                  className="h-8 rounded-lg border border-slate-300 px-2 text-[13px]"
                >
                  <option value="">All days</option>
                  {uniqueResultDates.map((d) => (
                    <option key={d} value={d}>{formatDate(d)}</option>
                  ))}
                </select>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    placeholder="Search halls…"
                    className="h-8 rounded-lg border border-slate-300 pl-7 pr-3 text-[13px] w-48"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Day results */}
          <div className="space-y-4">
            {filteredDays.map((day) => (
              <DayResult
                key={day.dayNumber}
                day={day}
                runId={generateResult.runId}
                filterHall={filterHall}
                filterSearch={filterSearch}
                onRegenerate={(type, label, payload) => setRegenConfirm({ type, label, payload })}
                regenerating={regenerating}
              />
            ))}
            {filteredDays.length === 0 && (
              <Card>
                <EmptyState
                  icon={<LayoutGrid className="h-5 w-5" />}
                  title="No results match filters"
                  description="Adjust your day or hall filter to see results."
                />
              </Card>
            )}
          </div>
        </section>
      )}

      {/* ─── Past runs ────────────────────────────────────────────────── */}
      {runs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-500" /> Scheduling runs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
              {runs.map((run) => (
                <div key={run.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate">{run.subjectCombination?.split('|').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' + ')}</p>
                    <p className="text-[11px] text-slate-500">
                      {run.scheduledCount} scheduled · {run.overflowCount} overflow · {run.dayCount} day(s)
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={run.status === 'completed' ? 'green' : run.status === 'partial' ? 'amber' : 'slate'}>
                      {run.status}
                    </Badge>
                    <Button size="sm" variant="ghost" onClick={() => viewRun(run)}>Details</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Needs Attention ──────────────────────────────────────────── */}
      {(needsAttention.length > 0 || conflicts.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Needs attention
            </CardTitle>
            <p className="text-[12px] text-slate-500 mt-1">
              {needsAttention.length + conflicts.length} item(s) require admin review.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {needsAttention.map((item, i) => (
                <div
                  key={`na-${i}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5 text-[13px]"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">{item.candidateName}</p>
                    <p className="text-[11px] text-slate-500">
                      {item.subjectCombination} · {item.firstChoice}
                    </p>
                    <p className="text-[11px] text-amber-700 mt-0.5">{item.reason}</p>
                  </div>
                  <Badge variant="amber">{item.conflictType}</Badge>
                </div>
              ))}
              {conflicts.filter((c) => c.status === 'open').map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50/60 px-3 py-2.5 text-[13px]"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">{c.candidate?.name ?? c.candidateId.slice(0, 8)}</p>
                    <p className="text-[11px] text-slate-500">{c.description}</p>
                  </div>
                  <Badge variant="red">{c.conflictType}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Rescheduling Queue ───────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-amber-500" /> Rescheduling queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <p className="text-[13px] text-slate-500">No candidates are waiting for rescheduling.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {queue.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-[13px]"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">{entry.candidate?.name ?? entry.candidateId.slice(0, 8)}</p>
                    <p className="text-[11px] text-slate-500">
                      <Badge variant={reasonColor(entry.reason) as 'amber' | 'red' | 'slate'} className="mr-1">
                        {reasonLabel(entry.reason)}
                      </Badge>
                      {entry.subjectCombination?.split('|').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' + ')}
                    </p>
                  </div>
                  <Badge variant={entry.status === 'rescheduled' ? 'green' : entry.status === 'pending' ? 'amber' : 'slate'}>
                    {entry.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Confirm Generation Dialog ────────────────────────────────── */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void generateSchedule()}
        title="Confirm schedule generation"
        description={`This will generate and persist a schedule for ${preview?.candidateCount.toLocaleString() ?? 0} candidates across ${preview?.estimatedDays ?? 0} day(s). Existing assignments for this combination will be replaced.`}
        confirmLabel="Confirm & generate"
        loading={generating}
      />

      {/* ─── Regeneration Confirm Dialog ──────────────────────────────── */}
      <ConfirmDialog
        open={!!regenConfirm}
        onClose={() => setRegenConfirm(null)}
        onConfirm={() => void doRegenerate()}
        title={`Regenerate ${regenConfirm?.type}`}
        description={`Regenerating ${regenConfirm?.label} may replace existing assignments for this scope. The backend will re-assign affected candidates.`}
        confirmLabel="Regenerate"
        loading={!!regenerating}
      />

      {/* ─── Create Combination Modal ────────────────────────────────── */}
      {createComboOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Create subject combination</h2>
            <p className="text-[13px] text-slate-500 mb-4">
              Select the JAMB subjects for this combination.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-[13px] font-medium text-slate-700">Subject 1 *</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[13px] focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white"
                  value={newSubject1}
                  onChange={(e) => setNewSubject1(e.target.value)}
                >
                  <option value="">— Select subject —</option>
                  {subjects.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[13px] font-medium text-slate-700">Subject 2 *</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[13px] focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white"
                  value={newSubject2}
                  onChange={(e) => setNewSubject2(e.target.value)}
                >
                  <option value="">— Select subject —</option>
                  {subjects.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[13px] font-medium text-slate-700">Subject 3 *</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[13px] focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white"
                  value={newSubject3}
                  onChange={(e) => setNewSubject3(e.target.value)}
                >
                  <option value="">— Select subject —</option>
                  {subjects.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[13px] font-medium text-slate-700">Subject 4 *</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[13px] focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white"
                  value={newSubject4}
                  onChange={(e) => setNewSubject4(e.target.value)}
                >
                  <option value="">— Select subject —</option>
                  {subjects.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[13px] font-medium text-slate-700">First choice (optional)</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[13px] focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  placeholder="e.g. MBBS Medicine & Surgery"
                  value={newFirstChoice}
                  onChange={(e) => setNewFirstChoice(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" onClick={() => { setCreateComboOpen(false); resetCreateForm(); }}>
                Cancel
              </Button>
              <Button onClick={() => void createCombination()} disabled={creatingCombo || !canCreate}>
                {creatingCombo ? 'Creating…' : 'Create combination'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Day Result Sub-Component ──────────────────────────────────────────────
function DayResult({
  day,
  runId,
  filterHall,
  filterSearch,
  onRegenerate,
  regenerating,
}: {
  day: CustomDaySchedule;
  runId: string;
  filterHall: string;
  filterSearch: string;
  onRegenerate: (type: 'day' | 'session', label: string, payload: Record<string, string>) => void;
  regenerating: string | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const totalCandidates = day.sessions.reduce((sum, s) => sum + s.totalAssigned, 0);

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 w-full bg-slate-50 px-4 py-3 border-b border-slate-200 hover:bg-slate-100 transition-colors"
      >
        <Badge variant="brand">DAY {day.dayNumber}</Badge>
        <span className="text-[13px] font-semibold text-slate-800">{formatDate(day.date)}</span>
        <span className="text-[12px] text-slate-500">
          {day.sessions.length} session(s) · {totalCandidates.toLocaleString()} candidates
        </span>
        <ChevronRight className={cn('h-4 w-4 text-slate-400 ml-auto transition-transform', expanded && 'rotate-90')} />
      </button>

      {expanded && (
        <div className="divide-y divide-slate-100">
          {day.sessions.map((sess) => (
            <div key={sess.session.id} className="px-4 py-3">
              <div className="flex items-center gap-3 mb-2">
                <Badge variant="outline">{sess.session.name}</Badge>
                <span className="text-[12px] text-slate-500">
                  {formatTime(sess.session.startTime)}–{formatTime(sess.session.endTime)}
                </span>
                <span className="text-[12px] text-slate-400">{sess.totalAssigned} assigned</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-[11px]"
                  disabled={!!regenerating}
                  onClick={() => onRegenerate('session', `Session ${sess.session.name}`, { sessionId: sess.session.id })}
                >
                  <RefreshCw className={cn('h-3 w-3 mr-1', regenerating === `Session ${sess.session.name}` && 'animate-spin')} />
                  Regen session
                </Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {sess.halls.map((hall) => (
                  <div
                    key={hall.hall.id}
                    className="rounded-md border border-slate-100 bg-slate-50/50 px-3 py-2"
                  >
                    <div className="flex items-center justify-between text-[12px]">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 text-purple-500" />
                        <span className="font-medium text-slate-700">{hall.hall.name}</span>
                      </div>
                      <span className="text-slate-500">
                        {hall.totalAssigned}/{hall.hall.capacity}
                      </span>
                    </div>
                    {hall.seats.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {hall.seats.slice(0, 20).map((seat) => (
                          <span
                            key={seat.seatNumber}
                            className="inline-block rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-mono text-purple-700"
                            title={seat.candidateName || seat.candidateId}
                          >
                            {seat.seatNumber}
                          </span>
                        ))}
                        {hall.seats.length > 20 && (
                          <span className="text-[10px] text-slate-400">+{hall.seats.length - 20} more</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="px-4 py-2 bg-slate-50 flex justify-end">
            <Button
              size="sm"
              variant="outline"
              disabled={!!regenerating}
              onClick={() => onRegenerate('day', `Day ${day.dayNumber} (${formatDate(day.date)})`, { dayDate: day.date })}
            >
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', regenerating === `Day ${day.dayNumber} (${formatDate(day.date)})` && 'animate-spin')} />
              Regenerate day
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CustomSchedulingPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><AirplaneLoader /></div>}>
      <CustomSchedulingContent />
    </Suspense>
  );
}
