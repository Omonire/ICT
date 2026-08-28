import { Request, Response } from 'express';
import { AppDataSource } from '../config/data-source';
import { SchedulingConfig } from '../entities/SchedulingConfig';
import { SchedulingRun } from '../entities/SchedulingRun';
import { ScheduleConflict, ConflictStatus } from '../entities/ScheduleConflict';
import { ScheduleHistory } from '../entities/ScheduleHistory';
import { AppError, asyncHandler } from '../utils/errors';
import { runPriorityScheduling, publishSchedule, duplicateSchedule } from '../services/priority-scheduling-engine';
import { logActivity } from '../services/activity-log';
import { broadcast } from '../services/websocket';
import { normalizeSubjectCombination, displaySubjectCombination, analyzeSubjectCombinations } from '../services/scheduling-engine';
import { Candidate } from '../entities/Candidate';
import { CareerGroup } from '../entities/CareerGroup';

// ─── Priority Management ──────────────────────────────────────────────────

/**
 * GET /api/schedule/priority-config
 * Get the active scheduling config with priority settings.
 */
export const getPriorityConfig = asyncHandler(async (_req: Request, res: Response) => {
  const repo = AppDataSource.getRepository(SchedulingConfig);
  const active = await repo.findOne({ where: { isActive: true } });
  if (!active) {
    // Return default config shape
    res.json({
      data: {
        id: null,
        name: 'Default',
        examPriorityOrder: [],
        firstChoicePriority: {},
        tieBreaker: null,
        rules: null,
      },
    });
    return;
  }
  res.json({
    data: {
      id: active.id,
      name: active.name,
      examPriorityOrder: active.examPriorityOrder ?? [],
      firstChoicePriority: active.firstChoicePriority ?? {},
      tieBreaker: active.tieBreaker ?? null,
      rules: active.rules,
    },
  });
});

/**
 * PUT /api/schedule/priority-config/exam-order
 * Update the exam combination priority order.
 */
export const updateExamPriorityOrder = asyncHandler(async (req: Request, res: Response) => {
  const { examPriorityOrder } = req.body as { examPriorityOrder: string[] };
  const repo = AppDataSource.getRepository(SchedulingConfig);

  let config = await repo.findOne({ where: { isActive: true } });
  if (!config) {
    config = repo.create({
      name: 'Active Config',
      rules: undefined as any,
      isActive: true,
    });
  }

  config.examPriorityOrder = examPriorityOrder;
  await repo.save(config);

  await logActivity({
    action: 'priority.exam_order_updated',
    userId: req.user?.id ?? null,
    entityType: 'scheduling_config',
    entityId: config.id,
    details: { examPriorityOrder },
  });

  res.json({ data: { examPriorityOrder: config.examPriorityOrder } });
});

/**
 * PUT /api/schedule/priority-config/first-choice
 * Update the first-choice priority for a specific exam combination.
 */
export const updateFirstChoicePriority = asyncHandler(async (req: Request, res: Response) => {
  const { normalizedKey, priority } = req.body as { normalizedKey: string; priority: string[] };
  const repo = AppDataSource.getRepository(SchedulingConfig);

  let config = await repo.findOne({ where: { isActive: true } });
  if (!config) {
    config = repo.create({
      name: 'Active Config',
      rules: undefined as any,
      isActive: true,
    });
  }

  if (!config.firstChoicePriority) {
    config.firstChoicePriority = {};
  }
  config.firstChoicePriority[normalizedKey] = priority;
  await repo.save(config);

  await logActivity({
    action: 'priority.first_choice_updated',
    userId: req.user?.id ?? null,
    entityType: 'scheduling_config',
    entityId: config.id,
    details: { normalizedKey, priority },
  });

  res.json({ data: { firstChoicePriority: config.firstChoicePriority } });
});

/**
 * PUT /api/schedule/priority-config/tie-breaker
 * Update the tie-breaker rule.
 */
export const updateTieBreaker = asyncHandler(async (req: Request, res: Response) => {
  const { tieBreaker } = req.body as { tieBreaker: string };
  const repo = AppDataSource.getRepository(SchedulingConfig);

  let config = await repo.findOne({ where: { isActive: true } });
  if (!config) {
    config = repo.create({
      name: 'Active Config',
      rules: undefined as any,
      isActive: true,
    });
  }

  config.tieBreaker = tieBreaker as any;
  await repo.save(config);

  await logActivity({
    action: 'priority.tie_breaker_updated',
    userId: req.user?.id ?? null,
    entityType: 'scheduling_config',
    entityId: config.id,
    details: { tieBreaker },
  });

  res.json({ data: { tieBreaker: config.tieBreaker } });
});

// ─── Priority Scheduling ──────────────────────────────────────────────────

/**
 * POST /api/schedule/priority-generate
 * Run priority-aware scheduling.
 */
export const priorityGenerate = asyncHandler(async (req: Request, res: Response) => {
  const { configId, sessionIds } = req.body as {
    configId?: string;
    sessionIds: string[];
  };

  const { run, result } = await runPriorityScheduling(
    configId ?? null,
    sessionIds,
    req.user?.id ?? null
  );

  broadcast('schedule.updated', {
    runId: run.id,
    status: run.status,
    candidateCount: run.candidateCount,
    scheduledCount: run.scheduledCount,
    overflowCount: run.overflowCount,
    conflictCount: run.conflictCount,
  });

  res.json({
    data: {
      runId: run.id,
      status: run.status,
      candidateCount: run.candidateCount,
      scheduledCount: run.scheduledCount,
      overflowCount: run.overflowCount,
      conflictCount: run.conflictCount,
      dayCount: run.dayCount,
      days: result.days,
      needsAttention: result.needsAttention,
      examPriorityOrder: result.examPriorityOrder,
      firstChoicePriority: result.firstChoicePriority,
      summary: run.summary,
    },
  });
});

// ─── Conflicts / Needs Attention ──────────────────────────────────────────

/**
 * GET /api/schedule/conflicts
 * Get all open conflicts for a scheduling run.
 */
export const getConflicts = asyncHandler(async (req: Request, res: Response) => {
  const runId = req.query.runId as string | undefined;
  const status = req.query.status as string | undefined;
  const repo = AppDataSource.getRepository(ScheduleConflict);

  const where: Record<string, unknown> = {};
  if (runId) where.schedulingRunId = runId;
  if (status) where.status = status;

  const conflicts = await repo.find({
    where,
    relations: ['candidate'],
    order: { createdAt: 'ASC' },
  });

  res.json({ data: conflicts });
});

/**
 * PUT /api/schedule/conflicts/:id/resolve
 * Resolve or ignore a conflict.
 */
export const resolveConflict = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, resolutionNotes } = req.body as {
    status: string;
    resolutionNotes?: string;
  };

  const repo = AppDataSource.getRepository(ScheduleConflict);
  const conflict = await repo.findOne({ where: { id } });
  if (!conflict) throw AppError.notFound('Conflict not found');

  conflict.status = status;
  conflict.resolutionNotes = resolutionNotes ?? null;
  conflict.resolvedBy = req.user?.id ?? null;
  conflict.resolvedAt = new Date();
  await repo.save(conflict);

  res.json({ data: conflict });
});

// ─── Publishing ────────────────────────────────────────────────────────────

/**
 * POST /api/schedule/publish
 * Publish a scheduling run as an immutable historical record.
 */
export const publish = asyncHandler(async (req: Request, res: Response) => {
  const { runId, name, description } = req.body as {
    runId: string;
    name: string;
    description?: string;
  };

  const result = await publishSchedule(runId, name, description ?? null, req.user?.id ?? null);
  broadcast('schedule.published', { runId, name, publishedAt: result.publishedAt });
  res.json({ data: result });
});

// ─── History ───────────────────────────────────────────────────────────────

/**
 * GET /api/schedule/history
 * List all published schedule history records.
 */
export const getScheduleHistory = asyncHandler(async (_req: Request, res: Response) => {
  const repo = AppDataSource.getRepository(ScheduleHistory);
  const records = await repo.find({
    order: { publishedAt: 'DESC' },
    take: 50,
  });
  res.json({ data: records });
});

/**
 * GET /api/schedule/history/:id
 * Get a specific schedule history record with full snapshot.
 */
export const getScheduleHistoryById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const repo = AppDataSource.getRepository(ScheduleHistory);
  const record = await repo.findOne({ where: { id } });
  if (!record) throw AppError.notFound('Schedule history record not found');
  res.json({ data: record });
});

// ─── Duplication ───────────────────────────────────────────────────────────

/**
 * POST /api/schedule/duplicate
 * Duplicate an existing scheduling run.
 */
export const duplicate = asyncHandler(async (req: Request, res: Response) => {
  const { runId, mode, name } = req.body as {
    runId: string;
    mode: 'keep_assignments' | 'recalculate';
    name?: string;
  };

  const result = await duplicateSchedule(runId, mode, name ?? undefined, req.user?.id ?? null);
  res.json({ data: { runId: result.newRun.id, status: result.newRun.status } });
});
