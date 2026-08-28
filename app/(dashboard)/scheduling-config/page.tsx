'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Clock,
  Download,
  Eye,
  GripVertical,
  History,
  ListChecks,
  RefreshCw,
  Settings2,
  SlidersHorizontal,
  Users,
  XCircle,
  Zap,
} from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import type {
  CustomCombinationAnalysis,
  CustomSubjectCombination,
  PriorityConfig,
  ScheduleHistory,
  SchedulingRun,
  Session,
  Hall,
  TieBreakerRule,
} from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/components/auth/auth-context';
import { SkeletonCards, SkeletonTable } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ─── API Endpoints ─────────────────────────────────────────────────────────
const EP = {
  priorityConfig: '/api/schedule/priority-config',
  examOrder: '/api/schedule/priority-config/exam-order',
  firstChoice: '/api/schedule/priority-config/first-choice',
  tieBreaker: '/api/schedule/priority-config/tie-breaker',
  combinations: '/api/schedule/subject-combinations',
  combinationAnalysis: '/api/schedule/combination-analysis',
  priorityGenerate: '/api/schedule/priority-generate',
  runs: '/api/schedule/runs',
  publish: '/api/schedule/publish',
  history: '/api/schedule/history',
  duplicate: '/api/schedule/duplicate',
  sessions: '/api/sessions',
  halls: '/api/halls',
};

// ─── Tie-breaker options ───────────────────────────────────────────────────
const TIE_BREAKER_OPTIONS: { value: TieBreakerRule; label: string; description: string }[] = [
  { value: 'name_asc', label: 'Name (A–Z)', description: 'Alphabetical by candidate name' },
  { value: 'name_desc', label: 'Name (Z–A)', description: 'Reverse alphabetical by candidate name' },
  { value: 'id_asc', label: 'ID (Low–High)', description: 'By candidate ID ascending' },
  { value: 'id_desc', label: 'ID (High–Low)', description: 'By candidate ID descending' },
  { value: 'random', label: 'Random', description: 'Randomly shuffle tied candidates' },
];

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function SchedulingConfigPage() {
  const { user } = useAuth();
  const { error, success } = useToast();

  // Data
  const [priorityConfig, setPriorityConfig] = useState<PriorityConfig | null>(null);
  const [combinations, setCombinations] = useState<CustomSubjectCombination[] | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [runs, setRuns] = useState<SchedulingRun[]>([]);
  const [history, setHistory] = useState<ScheduleHistory[]>([]);
  const [analysis, setAnalysis] = useState<CustomCombinationAnalysis | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'priority' | 'history'>('priority');
  const [selectedCombo, setSelectedCombo] = useState<string | null>(null);
  const [draggedExam, setDraggedExam] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [publishDialog, setPublishDialog] = useState<{ runId: string; name: string } | null>(null);
  const [duplicateDialog, setDuplicateDialog] = useState<{ runId: string; mode: 'keep_assignments' | 'recalculate' } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  // ─── Load data ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    Promise.allSettled([
      apiGet<{ data: PriorityConfig }>(EP.priorityConfig),
      apiGet<{ data: CustomSubjectCombination[] }>(EP.combinations),
      apiGet<{ data: Session[] }>(EP.sessions),
      apiGet<{ data: Hall[] }>(EP.halls),
      apiGet<{ data: SchedulingRun[] }>(EP.runs),
      apiGet<{ data: ScheduleHistory[] }>(EP.history),
    ]).then(([cfgRes, comboRes, sessRes, hallRes, runsRes, histRes]) => {
      if (cfgRes.status === 'fulfilled') setPriorityConfig(cfgRes.value.data);
      if (comboRes.status === 'fulfilled') setCombinations(comboRes.value.data);
      if (sessRes.status === 'fulfilled') setSessions(sessRes.value.data);
      if (hallRes.status === 'fulfilled') setHalls(hallRes.value.data);
      if (runsRes.status === 'fulfilled') setRuns(runsRes.value.data);
      if (histRes.status === 'fulfilled') setHistory(histRes.value.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  // ─── Exam priority reorder (drag-and-drop) ──────────────────────────
  const examOrder = useMemo(() => {
    if (!combinations) return [];
    const adminOrder = priorityConfig?.examPriorityOrder ?? [];
    const adminSet = new Set(adminOrder);
    const ordered = adminOrder.filter((k) => combinations.some((c) => c.normalizedKey === k));
    const remaining = combinations
      .map((c) => c.normalizedKey)
      .filter((k) => !adminSet.has(k));
    return [...ordered, ...remaining];
  }, [combinations, priorityConfig]);

  const handleExamDragStart = useCallback((index: number) => {
    setDraggedExam(index);
  }, []);

  const handleExamDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedExam === null || draggedExam === index) return;
    const newOrder = [...examOrder];
    const [removed] = newOrder.splice(draggedExam, 1);
    newOrder.splice(index, 0, removed);
    setDraggedExam(index);
    // Save immediately
    apiPost(EP.examOrder, { examPriorityOrder: newOrder }).then(() => {
      setPriorityConfig((prev) => prev ? { ...prev, examPriorityOrder: newOrder } : prev);
      success('Exam order updated');
    }).catch((e) => error('Failed to update', e instanceof Error ? e.message : 'Unknown error'));
  }, [draggedExam, examOrder, success, error]);

  const handleExamDragEnd = useCallback(() => {
    setDraggedExam(null);
  }, []);

  // ─── First-choice priority (checkbox multi-select) ───────────────
  const [selectedFCs, setSelectedFCs] = useState<string[]>([]);
  const [savingFC, setSavingFC] = useState(false);

  const loadAnalysis = useCallback(async (normalizedKey: string) => {
    setSelectedCombo(normalizedKey);
    setAnalysis(null);
    setSelectedFCs([]);
    try {
      const res = await apiGet<{ data: CustomCombinationAnalysis }>(`${EP.combinationAnalysis}/${encodeURIComponent(normalizedKey)}`);
      setAnalysis(res.data);
      // Load existing priority for this combo
      const existing = priorityConfig?.firstChoicePriority?.[normalizedKey] ?? [];
      if (existing.length > 0) setSelectedFCs(existing);
    } catch (e) {
      error('Analysis unavailable', e instanceof Error ? e.message : 'Backend not ready');
    }
  }, [error, priorityConfig]);

  function toggleFC(firstChoice: string) {
    setSelectedFCs((prev) => {
      if (prev.includes(firstChoice)) return prev.filter((fc) => fc !== firstChoice);
      if (prev.length >= 4) return prev;
      return [...prev, firstChoice];
    });
  }

  function moveFC(fromIndex: number, direction: 'up' | 'down') {
    setSelectedFCs((prev) => {
      const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
      if (toIndex < 0 || toIndex >= prev.length) return prev;
      const next = [...prev];
      [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
      return next;
    });
  }

  async function saveFCPriority() {
    if (!selectedCombo || selectedFCs.length === 0) return;
    setSavingFC(true);
    try {
      // Include unchecked items at the end so the full list is preserved
      const allFCs = analysis?.firstChoiceDistribution.map((f) => f.firstChoice) ?? [];
      const unchecked = allFCs.filter((fc) => !selectedFCs.includes(fc));
      const fullOrder = [...selectedFCs, ...unchecked];
      await apiPost(EP.firstChoice, { normalizedKey: selectedCombo, priority: fullOrder });
      setPriorityConfig((prev) => {
        if (!prev) return prev;
        const fcp = { ...(prev.firstChoicePriority ?? {}) };
        fcp[selectedCombo] = fullOrder;
        return { ...prev, firstChoicePriority: fcp };
      });
      success('First-choice priority saved', `${selectedFCs.length} programme(s) prioritised.`);
    } catch (e) {
      error('Failed to save', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSavingFC(false);
    }
  }

  // ─── Tie-breaker update ─────────────────────────────────────────────
  async function updateTieBreaker(rule: TieBreakerRule) {
    try {
      await apiPost(EP.tieBreaker, { tieBreaker: rule });
      setPriorityConfig((prev) => prev ? { ...prev, tieBreaker: rule } : prev);
      success('Tie-breaker updated');
    } catch (e) {
      error('Failed to update', e instanceof Error ? e.message : 'Unknown error');
    }
  }

  // ─── Priority scheduling generation ─────────────────────────────────
  function toggleSession(id: string) {
    setSelectedSessionIds((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  }

  async function runPriorityGenerate() {
    if (selectedSessionIds.length === 0) {
      error('No sessions', 'Select at least one session.');
      return;
    }
    setGenerating(true);
    try {
      await apiPost(EP.priorityGenerate, {
        configId: priorityConfig?.id,
        sessionIds: selectedSessionIds,
      }, { timeoutMs: 180000 });
      success('Schedule generated', 'Priority-based schedule created successfully.');
      // Refresh runs
      const runsRes = await apiGet<{ data: SchedulingRun[] }>(EP.runs);
      setRuns(runsRes.data);
    } catch (e) {
      error('Generation failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setGenerating(false);
    }
  }

  // ─── Publishing ─────────────────────────────────────────────────────
  async function doPublish() {
    if (!publishDialog) return;
    setPublishing(true);
    try {
      await apiPost(EP.publish, {
        runId: publishDialog.runId,
        name: publishDialog.name,
      });
      success('Schedule published', `"${publishDialog.name}" is now a historical record.`);
      setPublishDialog(null);
      const [runsRes, histRes] = await Promise.all([
        apiGet<{ data: SchedulingRun[] }>(EP.runs),
        apiGet<{ data: ScheduleHistory[] }>(EP.history),
      ]);
      setRuns(runsRes.data);
      setHistory(histRes.data);
    } catch (e) {
      error('Publish failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setPublishing(false);
    }
  }

  // ─── Duplication ────────────────────────────────────────────────────
  async function doDuplicate() {
    if (!duplicateDialog) return;
    setDuplicating(true);
    try {
      const res = await apiPost<{ data: { runId: string; status: string } }>(EP.duplicate, {
        runId: duplicateDialog.runId,
        mode: duplicateDialog.mode,
      });
      success('Schedule duplicated', `New draft created: ${res.data.runId.slice(0, 8)}`);
      setDuplicateDialog(null);
      const runsRes = await apiGet<{ data: SchedulingRun[] }>(EP.runs);
      setRuns(runsRes.data);
    } catch (e) {
      error('Duplication failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setDuplicating(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────
  const totalCapacity = useMemo(
    () => halls.filter((h) => h.status === 'active').reduce((sum, h) => sum + h.capacity, 0),
    [halls]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scheduling configuration"
        description="Configure exam priority, first-choice priority, tie-breaker rules, and manage schedule history"
      />

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-slate-200">
        {([
          { key: 'priority' as const, label: 'Priority & Rules', icon: SlidersHorizontal },
          { key: 'history' as const, label: 'Schedule History', icon: History },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors -mb-px',
              activeTab === key
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'priority' && (
        <div className="space-y-6">
          {/* ─── Exam Priority ──────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-purple-600" /> Exam combination priority
              </CardTitle>
              <p className="text-[12px] text-slate-500 mt-1">
                Drag to reorder. Exams are processed in this order during scheduling.
              </p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <SkeletonTable rows={4} cols={3} />
              ) : !combinations || combinations.length === 0 ? (
                <EmptyState
                  icon={<ListChecks className="h-5 w-5" />}
                  title="No exam combinations"
                  description="Import candidate data to see subject combinations."
                />
              ) : (
                <div className="space-y-1">
                  {examOrder.map((key, index) => {
                    const combo = combinations.find((c) => c.normalizedKey === key);
                    if (!combo) return null;
                    return (
                      <div
                        key={key}
                        draggable
                        onDragStart={() => handleExamDragStart(index)}
                        onDragOver={(e) => handleExamDragOver(e, index)}
                        onDragEnd={handleExamDragEnd}
                        className={cn(
                          'flex items-center gap-3 rounded-lg border px-4 py-3 text-[13px] cursor-grab active:cursor-grabbing transition-colors',
                          draggedExam === index
                            ? 'border-purple-400 bg-purple-50 opacity-70'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        )}
                      >
                        <GripVertical className="h-4 w-4 text-slate-400 shrink-0" />
                        <span className="font-mono text-[12px] text-slate-400 w-6">{index + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap gap-1.5">
                            {combo.subjects.map((s) => (
                              <Badge key={s} variant="outline">{s}</Badge>
                            ))}
                          </div>
                        </div>
                        <span className="text-[12px] text-slate-500 shrink-0">
                          {combo.candidateCount.toLocaleString()} candidates
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ─── First-Choice Priority ──────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-gold-600" /> First-choice programme priority
              </CardTitle>
              <p className="text-[12px] text-slate-500 mt-1">
                Select an exam combination, then check up to 4 first-choice programmes to prioritise. Use arrows to reorder.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Combination selector */}
              <div className="flex flex-wrap gap-2">
                {combinations?.slice(0, 20).map((combo) => (
                  <button
                    key={combo.normalizedKey}
                    onClick={() => void loadAnalysis(combo.normalizedKey)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-[12px] transition-colors',
                      selectedCombo === combo.normalizedKey
                        ? 'border-purple-400 bg-purple-50 font-medium text-purple-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    )}
                  >
                    {combo.displayName}
                  </button>
                ))}
                {(combinations?.length ?? 0) > 20 && (
                  <span className="self-center text-[11px] text-slate-400">+{(combinations?.length ?? 0) - 20} more</span>
                )}
              </div>

              {/* First-choice checkboxes */}
              {selectedCombo && (
                <div>
                  {analysis ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[12px] text-slate-500">
                          {selectedFCs.length}/4 selected
                          {selectedFCs.length >= 4 && (
                            <span className="ml-1 text-amber-600">(max reached — uncheck to change)</span>
                          )}
                        </p>
                        <Button
                          size="sm"
                          onClick={saveFCPriority}
                          disabled={savingFC || selectedFCs.length === 0}
                        >
                          {savingFC ? 'Saving…' : 'Save priority'}
                        </Button>
                      </div>

                      {/* Selected programmes (ordered) */}
                      {selectedFCs.length > 0 && (
                        <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-3">
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-purple-600">
                            Prioritised order
                          </p>
                          <div className="space-y-1">
                            {selectedFCs.map((fc, index) => (
                              <div
                                key={fc}
                                className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-[13px] shadow-sm"
                              >
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-600 text-[10px] font-bold text-white">
                                  {index + 1}
                                </span>
                                <span className="flex-1 font-medium text-slate-800">{fc}</span>
                                <div className="flex gap-0.5">
                                  <button
                                    onClick={() => moveFC(index, 'up')}
                                    disabled={index === 0}
                                    className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                                    title="Move up"
                                  >
                                    <ChevronDown className="h-3.5 w-3.5 rotate-180" />
                                  </button>
                                  <button
                                    onClick={() => moveFC(index, 'down')}
                                    disabled={index === selectedFCs.length - 1}
                                    className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                                    title="Move down"
                                  >
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                <button
                                  onClick={() => toggleFC(fc)}
                                  className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                                  title="Remove from priority"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* All available programmes with checkboxes */}
                      <div className="rounded-lg border border-slate-200 bg-white">
                        <div className="border-b border-slate-100 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Available first-choice programmes
                          </p>
                        </div>
                        <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                          {analysis.firstChoiceDistribution.map((fc) => {
                            const isSelected = selectedFCs.includes(fc.firstChoice);
                            const isDisabled = !isSelected && selectedFCs.length >= 4;
                            return (
                              <label
                                key={fc.firstChoice}
                                className={cn(
                                  'flex items-center gap-3 px-3 py-2.5 text-[13px] transition-colors',
                                  isSelected ? 'bg-purple-50/50' : isDisabled ? 'opacity-50' : 'hover:bg-slate-50 cursor-pointer'
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  disabled={isDisabled}
                                  onChange={() => toggleFC(fc.firstChoice)}
                                  className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                                />
                                <span className={cn('flex-1', isSelected ? 'font-medium text-purple-700' : 'text-slate-700')}>
                                  {fc.firstChoice}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  {fc.candidateCount.toLocaleString()} ({fc.percentage}%)
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <SkeletonTable rows={4} cols={3} />
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ─── Tie-Breaker ───────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-emerald-600" /> Candidate tie-breaker
              </CardTitle>
              <p className="text-[12px] text-slate-500 mt-1">
                When candidates share the same exam + first-choice, this rule determines processing order.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {TIE_BREAKER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => void updateTieBreaker(opt.value)}
                    className={cn(
                      'rounded-lg border px-4 py-3 text-left transition-colors',
                      priorityConfig?.tieBreaker === opt.value
                        ? 'border-purple-400 bg-purple-50 ring-1 ring-purple-200'
                        : 'border-slate-200 hover:border-slate-300'
                    )}
                  >
                    <p className="text-[13px] font-medium text-slate-800">{opt.label}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{opt.description}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ─── Quick Generate ─────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-purple-600" /> Priority scheduling
              </CardTitle>
              <p className="text-[12px] text-slate-500 mt-1">
                Generate a schedule using the admin-defined priority order.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-[13px] font-medium text-slate-700 mb-2">Select sessions</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-48 overflow-y-auto">
                  {sessions.map((session) => (
                    <label
                      key={session.id}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] cursor-pointer transition-colors',
                        selectedSessionIds.includes(session.id)
                          ? 'border-purple-400 bg-purple-50'
                          : 'border-slate-200 hover:border-slate-300'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedSessionIds.includes(session.id)}
                        onChange={() => toggleSession(session.id)}
                        className="h-3.5 w-3.5 accent-purple-600"
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-700 truncate">{session.name}</p>
                        <p className="text-[10px] text-slate-500">{session.examDate}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-slate-500">
                  {selectedSessionIds.length} session(s) · {totalCapacity.toLocaleString()} total seats
                </p>
                <Button onClick={() => void runPriorityGenerate()} disabled={generating || selectedSessionIds.length === 0}>
                  {generating ? 'Generating…' : 'Generate priority schedule'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ─── Recent Runs ────────────────────────────────────────── */}
          {runs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-500" /> Recent scheduling runs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {runs.map((run) => (
                    <div key={run.id} className="flex items-center justify-between gap-3 py-3 text-[13px]">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate">
                          {run.subjectCombination === 'priority-based'
                            ? 'Priority-based schedule'
                            : run.subjectCombination?.split('|').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' + ')}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {run.scheduledCount} scheduled · {run.overflowCount} overflow · {run.conflictCount ?? 0} conflicts · {run.dayCount} day(s)
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={run.isPublished ? 'green' : run.status === 'completed' ? 'brand' : 'slate'}>
                          {run.isPublished ? 'Published' : run.status}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(`/api/schedule/reports/${run.id}/pdf`, '_blank')}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        {!run.isPublished && run.status !== 'generating' && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setPublishDialog({ runId: run.id, name: `Schedule ${new Date(run.createdAt).toLocaleDateString()}` })}
                            >
                              Publish
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDuplicateDialog({ runId: run.id, mode: 'keep_assignments' })}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-purple-600" /> Schedule history
            </CardTitle>
            <p className="text-[12px] text-slate-500 mt-1">
              Published schedules are immutable historical records. Each publication is permanently retained.
            </p>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <EmptyState
                icon={<History className="h-5 w-5" />}
                title="No published schedules"
                description="Publish a schedule to create the first historical record."
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {history.map((record) => (
                  <div key={record.id} className="flex items-center justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800">{record.name}</p>
                      <p className="text-[12px] text-slate-500 mt-0.5">
                        Published: {new Date(record.publishedAt).toLocaleDateString('en-NG', {
                          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                      <div className="flex gap-3 mt-1 text-[11px] text-slate-400">
                        <span>{record.scheduledCount} scheduled</span>
                        <span>{record.overflowCount} overflow</span>
                        <span>{record.conflictCount} conflicts</span>
                        <span>{record.dayCount} day(s)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDuplicateDialog({ runId: record.schedulingRunId, mode: 'keep_assignments' })}
                      >
                        <Copy className="h-3.5 w-3.5 mr-1" /> Duplicate
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Publish Dialog ──────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!publishDialog}
        onClose={() => setPublishDialog(null)}
        onConfirm={() => void doPublish()}
        title="Publish schedule"
        description={`Publish this schedule as an immutable historical record? It will be permanently retained and can be duplicated later.`}
        confirmLabel="Publish"
        loading={publishing}
      />

      {/* ─── Duplicate Dialog ────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!duplicateDialog}
        onClose={() => setDuplicateDialog(null)}
        onConfirm={() => void doDuplicate()}
        title="Duplicate schedule"
        description={
          duplicateDialog?.mode === 'keep_assignments'
            ? 'This creates a new schedule with the same assignments as the original. The original remains unchanged.'
            : 'This creates a new schedule and recalculates assignments using current rules and data.'
        }
        confirmLabel="Duplicate"
        loading={duplicating}
      />
    </div>
  );
}
