import { Request, Response } from 'express';
import { AppDataSource } from '../config/data-source';
import { Candidate, CandidateStatus } from '../entities/Candidate';
import { CandidateAssignment } from '../entities/CandidateAssignment';
import { Hall } from '../entities/Hall';
import { Seat } from '../entities/Seat';
import { ScheduleMeta, ScheduleState } from '../entities/ScheduleMeta';
import { SchedulingConfig } from '../entities/SchedulingConfig';
import { SchedulingRun } from '../entities/SchedulingRun';
import { ReschedulingEntry } from '../entities/ReschedulingEntry';
import { CareerGroup } from '../entities/CareerGroup';
import { AppError, asyncHandler } from '../utils/errors';
import { generateSchedule } from '../services/scheduler';
import {
  analyzeSubjectCombinations,
  calculateFirstChoiceDistribution,
  previewScheduling,
  createPreviewContext,
  generateScheduling,
  regenerateDay,
  regenerateSession,
  getReschedulingQueue,
  rescheduleCandidate,
  rescheduleCandidates,
  normalizeSubjectCombination,
  displaySubjectCombination,
  getCandidatesForCombination,
} from '../services/scheduling-engine';
import { logActivity } from '../services/activity-log';
import { genUuid } from '../utils/ids';

async function getOrCreateMeta(): Promise<ScheduleMeta> {
  const repo = AppDataSource.getRepository(ScheduleMeta);
  let meta = await repo.findOne({ where: { id: 'schedule' } });
  if (!meta) {
    meta = repo.create({ id: 'schedule', status: ScheduleState.NONE, sessionIds: null });
    await repo.save(meta);
  }
  return meta;
}

export const capacity = asyncHandler(async (req: Request, res: Response) => {
  const sessionIds = (req.query.sessionIds as string) ?? '';
  const ids = sessionIds ? sessionIds.split(',').filter(Boolean) : [];

  const candidateRepo = AppDataSource.getRepository(Candidate);
  const hallRepo = AppDataSource.getRepository(Hall);

  const totalCandidates = await candidateRepo
    .createQueryBuilder('c')
    .where('c.status != :status', { status: CandidateStatus.COMPLETED })
    .getCount();

  const halls = await hallRepo.find();
  const activeHalls = halls.filter((h) => h.status === 'active');
  const capacityPerSession = activeHalls.reduce((sum, h) => sum + h.capacity, 0);
  const totalCapacity = capacityPerSession * Math.max(ids.length, 1);

  res.json({
    data: {
      totalCandidates,
      totalCapacity,
      capacityPerSession,
      activeHallCount: activeHalls.length,
      selectedSessionCount: ids.length,
      halls: activeHalls.map((h) => ({
        id: h.id,
        name: h.name,
        capacity: h.capacity,
      })),
    },
  });
});

export const getStatus = asyncHandler(async (_req: Request, res: Response) => {
  const meta = await getOrCreateMeta();
  const assignmentCount = await AppDataSource.getRepository(CandidateAssignment).count();
  res.json({
    data: {
      status: meta.status,
      sessionIds: meta.sessionIds ?? [],
      generatedAt: meta.generatedAt,
      confirmedAt: meta.confirmedAt,
      summary: meta.summary,
      assignmentCount,
    },
  });
});

export const generate = asyncHandler(async (req: Request, res: Response) => {
  const { sessionIds, candidateIds, strict } = req.body as {
    sessionIds: string[];
    candidateIds?: string[];
    strict?: boolean;
  };

  const result = await generateSchedule({
    sessionIds,
    candidateIds,
    strict: strict ?? false,
    userId: req.user?.id ?? null,
  });

  const meta = await getOrCreateMeta();
  meta.status = ScheduleState.DRAFT;
  meta.sessionIds = sessionIds;
  meta.generatedAt = new Date();
  meta.confirmedAt = null;
  meta.summary = result.summary as unknown as Record<string, unknown>;
  await AppDataSource.getRepository(ScheduleMeta).save(meta);

  await logActivity({
    action: 'schedule.generated',
    userId: req.user?.id ?? null,
    entityType: 'schedule',
    details: {
      sessions: sessionIds.length,
      assigned: result.summary.assignedCount,
      unassigned: result.summary.unassignedCount,
    },
  });

  res.json({
    data: {
      status: ScheduleState.DRAFT,
      summary: result.summary,
      unassigned: result.unassigned.map((c) => ({ id: c.id, name: c.name })),
    },
  });
});

export const preview = asyncHandler(async (_req: Request, res: Response) => {
  const meta = await getOrCreateMeta();
  const assignmentRepo = AppDataSource.getRepository(CandidateAssignment);
  const sessionIds = meta.sessionIds ?? [];

  const qb = assignmentRepo
    .createQueryBuilder('a')
    .leftJoinAndSelect('a.candidate', 'c')
    .leftJoinAndSelect('c.careerGroup', 'cg')
    .leftJoinAndSelect('a.session', 's')
    .leftJoinAndSelect('a.hall', 'h')
    .orderBy('s.examDate', 'ASC')
    .addOrderBy('s.startTime', 'ASC')
    .addOrderBy('h.name', 'ASC')
    .addOrderBy('a.seatNumber', 'ASC');

  if (sessionIds.length > 0) qb.where('a.sessionId IN (:...sessionIds)', { sessionIds });
  const assignments = await qb.getMany();

  const grouped = new Map<
    string,
    {
      session: { id: string; name: string; examDate: string; startTime: string; endTime: string };
      hall: { id: string; name: string; capacity: number };
      candidates: Array<{ candidateId: string; name: string; seatNumber: string; status: string }>;
    }
  >();

  for (const a of assignments) {
    const key = `${a.sessionId}:${a.hallId}`;
    const bucket = grouped.get(key) ?? {
      session: {
        id: a.session.id,
        name: a.session.name,
        examDate: a.session.examDate,
        startTime: a.session.startTime,
        endTime: a.session.endTime,
      },
      hall: { id: a.hall.id, name: a.hall.name, capacity: a.hall.capacity },
      candidates: [],
    };
    bucket.candidates.push({
      candidateId: a.candidateId,
      name: a.candidate?.name ?? '(removed)',
      seatNumber: a.seatNumber,
      status: a.candidate?.status ?? 'unscheduled',
    });
    grouped.set(key, bucket);
  }

  const halls = await AppDataSource.getRepository(Hall).find();
  const totalCapacity = halls.reduce((sum, h) => sum + (h.status === 'active' ? h.capacity : 0), 0);

  res.json({
    data: {
      status: meta.status,
      summary: meta.summary,
      generatedAt: meta.generatedAt,
      confirmedAt: meta.confirmedAt,
      totalCapacity,
      groups: [...grouped.values()].sort(
        (a, b) =>
          a.session.examDate.localeCompare(b.session.examDate) ||
          a.session.startTime.localeCompare(b.session.startTime) ||
          a.hall.name.localeCompare(b.hall.name)
      ),
    },
  });
});

export const confirm = asyncHandler(async (req: Request, res: Response) => {
  const meta = await getOrCreateMeta();
  if (meta.status !== ScheduleState.DRAFT && meta.status !== ScheduleState.CONFIRMED) {
    throw AppError.badRequest('Generate a schedule before confirming it');
  }
  const count = await AppDataSource.getRepository(CandidateAssignment).count();
  if (count === 0) throw AppError.badRequest('The draft schedule has no assignments to confirm');

  meta.status = ScheduleState.CONFIRMED;
  meta.confirmedAt = new Date();
  meta.confirmedBy = req.user?.id ?? null;
  await AppDataSource.getRepository(ScheduleMeta).save(meta);

  await logActivity({
    action: 'schedule.confirmed',
    userId: req.user?.id ?? null,
    entityType: 'schedule',
    details: { assignmentCount: count },
  });

  res.json({ data: { status: ScheduleState.CONFIRMED, confirmedAt: meta.confirmedAt, assignmentCount: count } });
});

export const approve = asyncHandler(async (req: Request, res: Response) => {
  const { mode, candidateIds } = req.body as { mode: 'auto' | 'manual'; candidateIds?: string[] };
  const meta = await getOrCreateMeta();
  if (meta.status !== ScheduleState.DRAFT && meta.status !== ScheduleState.CONFIRMED) {
    throw AppError.badRequest('Generate a schedule before approving it');
  }

  const ds = AppDataSource;
  const qr = ds.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    if (mode === 'manual') {
      if (!candidateIds || candidateIds.length === 0) {
        throw AppError.badRequest('Select at least one candidate to approve');
      }

      // Load only assignments for candidate IDs we care about
      const BATCH = 5000;
      const toRemove: { candidateId: string; hallId: string; seatNumber: string; id: string }[] = [];
      const toKeep: { candidateId: string; hallId: string; seatNumber: string; sessionId: string }[] = [];

      for (let i = 0; i < candidateIds.length; i += BATCH) {
        const chunk = candidateIds.slice(i, i + BATCH);
        const keepRows = await qr.query(
          `SELECT a.id, a.candidate_id, a.hall_id, a.seat_number, a.session_id
           FROM candidate_assignments a WHERE a.candidate_id = ANY($1::varchar[])`,
          [chunk]
        );
        toKeep.push(...keepRows);
      }

      // Get all assignment candidate IDs, find ones NOT in candidateIds
      const allRows = await qr.query(`SELECT id, candidate_id, hall_id, seat_number FROM candidate_assignments`);
      const keepSet = new Set(candidateIds);
      for (const row of allRows) {
        if (!keepSet.has(row.candidate_id)) {
          toRemove.push({ candidateId: row.candidate_id, hallId: row.hall_id, seatNumber: row.seat_number, id: row.id });
        }
      }

      // Bulk unschedule removed candidates via temp table
      if (toRemove.length > 0) {
        await qr.query(`CREATE TEMPORARY TABLE _rm (id VARCHAR, hall_id VARCHAR, seat_number VARCHAR) ON COMMIT DROP`);
        for (let i = 0; i < toRemove.length; i += BATCH) {
          const chunk = toRemove.slice(i, i + BATCH);
          const rows: string[] = [];
          const params: unknown[] = [];
          let pi = 1;
          for (const r of chunk) {
            rows.push(`($${pi}, $${pi + 1}, $${pi + 2})`);
            params.push(r.candidateId, r.hallId, r.seatNumber);
            pi += 3;
          }
          await qr.query(`INSERT INTO _rm (id, hall_id, seat_number) VALUES ${rows.join(',')}`, params);
        }

        // Bulk update candidates to unscheduled
        await qr.query(`UPDATE candidates SET status = $1, assigned_hall_id = NULL, assigned_seat_number = NULL, assigned_session_id = NULL, assigned_exam_date = NULL FROM _rm WHERE candidates.id = _rm.id`, [CandidateStatus.UNSCHEDULED]);

        // Bulk free seats
        await qr.query(`UPDATE seats SET status = 'available', candidate_id = NULL FROM _rm WHERE seats.hall_id = _rm.hall_id AND seats.seat_number = _rm.seat_number`);

        // Bulk delete assignments
        const rmIds = toRemove.map((r) => r.id);
        for (let i = 0; i < rmIds.length; i += BATCH) {
          await qr.query(`DELETE FROM candidate_assignments WHERE id = ANY($1::varchar[])`, [rmIds.slice(i, i + BATCH)]);
        }
      }

      // Bulk schedule kept candidates via temp table
      if (toKeep.length > 0) {
        const sessionById = new Map<string, { examDate: string }>();
        const sessIds = [...new Set(toKeep.map((a) => a.sessionId))];
        if (sessIds.length > 0) {
          for (let i = 0; i < sessIds.length; i += BATCH) {
            const rows = await qr.query(`SELECT id, exam_date FROM sessions WHERE id = ANY($1::varchar[])`, [sessIds.slice(i, i + BATCH)]);
            for (const r of rows) sessionById.set(r.id, { examDate: r.exam_date });
          }
        }

        await qr.query(`CREATE TEMPORARY TABLE _kp (
          candidate_id VARCHAR, hall_id VARCHAR, seat_number VARCHAR, session_id VARCHAR, exam_date VARCHAR
        ) ON COMMIT DROP`);

        for (let i = 0; i < toKeep.length; i += BATCH) {
          const chunk = toKeep.slice(i, i + BATCH);
          const rows: string[] = [];
          const params: unknown[] = [];
          let pi = 1;
          for (const a of chunk) {
            const ed = sessionById.get(a.sessionId)?.examDate ?? null;
            rows.push(`($${pi}, $${pi + 1}, $${pi + 2}, $${pi + 3}, $${pi + 4})`);
            params.push(a.candidateId, a.hallId, a.seatNumber, a.sessionId, ed);
            pi += 5;
          }
          await qr.query(`INSERT INTO _kp (candidate_id, hall_id, seat_number, session_id, exam_date) VALUES ${rows.join(',')}`, params);
        }

        // Bulk update candidates to scheduled
        await qr.query(`UPDATE candidates SET status = $1, assigned_hall_id = _kp.hall_id, assigned_seat_number = _kp.seat_number, assigned_session_id = _kp.session_id, assigned_exam_date = _kp.exam_date FROM _kp WHERE candidates.id = _kp.candidate_id`, [CandidateStatus.SCHEDULED]);

        // Bulk occupy seats
        await qr.query(`UPDATE seats SET status = 'occupied', candidate_id = _kp.candidate_id FROM _kp WHERE seats.hall_id = _kp.hall_id AND seats.seat_number = _kp.seat_number`);
      }

      meta.status = ScheduleState.CONFIRMED;
      meta.confirmedAt = new Date();
      meta.confirmedBy = req.user?.id ?? null;
      await qr.manager.save(meta);
      await qr.commitTransaction();

      await logActivity({
        action: 'schedule.approved',
        userId: req.user?.id ?? null,
        entityType: 'schedule',
        details: { mode, approved: toKeep.length, removed: toRemove.length },
      });

      res.json({ data: { status: ScheduleState.CONFIRMED, assignmentCount: toKeep.length, removedCount: toRemove.length } });
    } else {
      // Auto mode — bulk approve all assignments
      const count = (await qr.query(`SELECT COUNT(*)::int AS cnt FROM candidate_assignments`))[0]?.cnt ?? 0;
      if (count === 0) throw AppError.badRequest('The draft schedule has no assignments to approve');

      // Bulk update all candidates to scheduled using temp table
      await qr.query(`CREATE TEMPORARY TABLE _auto (
        candidate_id VARCHAR, hall_id VARCHAR, seat_number VARCHAR, session_id VARCHAR, exam_date VARCHAR
      ) ON COMMIT DROP`);

      const BATCH = 10000;
      for (let offset = 0; offset < count; offset += BATCH) {
        const rows = await qr.query(
          `SELECT a.candidate_id, a.hall_id, a.seat_number, a.session_id, s.exam_date
           FROM candidate_assignments a JOIN sessions s ON s.id = a.session_id
           ORDER BY a.candidate_id LIMIT $1 OFFSET $2`,
          [BATCH, offset]
        );
        if (rows.length === 0) break;
        const vals: string[] = [];
        const params: unknown[] = [];
        let pi = 1;
        for (const r of rows) {
          vals.push(`($${pi}, $${pi + 1}, $${pi + 2}, $${pi + 3}, $${pi + 4})`);
          params.push(r.candidate_id, r.hall_id, r.seat_number, r.session_id, r.exam_date);
          pi += 5;
        }
        await qr.query(`INSERT INTO _auto (candidate_id, hall_id, seat_number, session_id, exam_date) VALUES ${vals.join(',')}`, params);
      }

      // Bulk update candidates
      await qr.query(`UPDATE candidates SET status = $1, assigned_hall_id = _auto.hall_id, assigned_seat_number = _auto.seat_number, assigned_session_id = _auto.session_id, assigned_exam_date = _auto.exam_date FROM _auto WHERE candidates.id = _auto.candidate_id`, [CandidateStatus.SCHEDULED]);

      // Bulk occupy seats
      await qr.query(`UPDATE seats SET status = 'occupied', candidate_id = _auto.candidate_id FROM _auto WHERE seats.hall_id = _auto.hall_id AND seats.seat_number = _auto.seat_number`);

      meta.status = ScheduleState.CONFIRMED;
      meta.confirmedAt = new Date();
      meta.confirmedBy = req.user?.id ?? null;
      await qr.manager.save(meta);
      await qr.commitTransaction();

      await logActivity({
        action: 'schedule.approved',
        userId: req.user?.id ?? null,
        entityType: 'schedule',
        details: { mode: 'auto', approved: count },
      });

      res.json({ data: { status: ScheduleState.CONFIRMED, assignmentCount: count, removedCount: 0 } });
    }
  } catch (err) {
    await qr.rollbackTransaction();
    throw err;
  } finally {
    await qr.release();
  }
});

export const clear = asyncHandler(async (req: Request, res: Response) => {
  const ds = AppDataSource;
  const qr = ds.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    await qr.query('DELETE FROM candidate_assignments');
    await qr.query('UPDATE candidates SET status = $1, assigned_hall_id = NULL, assigned_seat_number = NULL, assigned_session_id = NULL, assigned_exam_date = NULL', [CandidateStatus.UNSCHEDULED]);
    await qr.query('UPDATE seats SET status = $1, candidate_id = NULL', ['available']);
    const meta = await getOrCreateMeta();
    meta.status = ScheduleState.NONE;
    meta.summary = null;
    meta.confirmedAt = null;
    meta.generatedAt = null;
    await qr.manager.save(meta);
    await qr.commitTransaction();
  } catch (err) {
    await qr.rollbackTransaction();
    throw err;
  } finally {
    await qr.release();
  }

  await logActivity({
    action: 'schedule.cleared',
    userId: req.user?.id ?? null,
    entityType: 'schedule',
  });

  res.json({ data: { status: ScheduleState.NONE, assignmentCount: 0 } });
});

// ─── Scheduling Engine Handlers ─────────────────────────────────────────────

/**
 * GET /api/schedule/subjects
 * List all unique subjects from candidates.
 */
export const listSubjects = asyncHandler(async (_req: Request, res: Response) => {
  const ds = AppDataSource;
  const rows = await ds.query(`
    SELECT DISTINCT LOWER(TRIM(elem::text)) AS subject
    FROM candidates, jsonb_array_elements_text(jamb_subjects) elem
    WHERE jamb_subjects IS NOT NULL AND jsonb_array_length(jamb_subjects) > 0
    ORDER BY subject
  `);
  const subjects: string[] = rows.map((r: { subject: string }) => r.subject);
  res.json({ data: subjects });
});

/**
 * GET /api/schedule/subject-combinations
 * List all unique subject combinations with candidate counts.
 */
export const subjectCombinations = asyncHandler(async (_req: Request, res: Response) => {
  const ds = AppDataSource;

  // Optimized: use SQL to group candidates by jambSubjects directly
  const rows = await ds.query(`
    SELECT
      jamb_subjects as raw_subjects,
      career_group_id,
      COUNT(*)::int as "candidateCount"
    FROM candidates
    WHERE jamb_subjects IS NOT NULL AND jsonb_array_length(jamb_subjects) > 0
    GROUP BY jamb_subjects, career_group_id
    ORDER BY "candidateCount" DESC
  `);

  const groupRepo = ds.getRepository(CareerGroup);
  const groups = await groupRepo.find();
  const groupMap = new Map(groups.map((g) => [g.id, g]));

  const combinationMap = new Map<string, {
    careerGroupId: string | null;
    careerGroupName: string | null;
    candidateCount: number;
    subjects: string[];
  }>();

  for (const row of rows) {
    const subjects: string[] = Array.isArray(row.raw_subjects)
      ? row.raw_subjects
      : typeof row.raw_subjects === 'string'
        ? JSON.parse(row.raw_subjects)
        : [];
    if (subjects.length === 0) continue;

    const normalizedKey = normalizeSubjectCombination(subjects);
    const existing = combinationMap.get(normalizedKey);
    if (existing) {
      existing.candidateCount += row.candidateCount;
    } else {
      const group = row.career_group_id ? groupMap.get(row.career_group_id) : null;
      combinationMap.set(normalizedKey, {
        careerGroupId: row.career_group_id ?? null,
        careerGroupName: group?.name ?? null,
        candidateCount: row.candidateCount,
        subjects,
      });
    }
  }

  const combinations = [...combinationMap.entries()]
    .map(([key, info]) => ({
      normalizedKey: key,
      displayName: displaySubjectCombination(key),
      subjects: info.subjects.sort(),
      candidateCount: info.candidateCount,
      careerGroupId: info.careerGroupId,
      careerGroupName: info.careerGroupName,
      firstChoiceDistribution: [] as { firstChoice: string; candidateCount: number; percentage: number }[],
    }))
    .sort((a, b) => b.candidateCount - a.candidateCount);

  // Fetch first-choice distribution per combination via SQL
  const distRows = await ds.query(`
    SELECT jamb_subjects, first_choice, COUNT(*)::int as cnt
    FROM candidates
    WHERE jamb_subjects IS NOT NULL AND jsonb_array_length(jamb_subjects) > 0
      AND first_choice IS NOT NULL
    GROUP BY jamb_subjects, first_choice
  `);

  const comboByIndex = new Map(combinations.map((c, i) => [c.normalizedKey, i]));
  for (const row of distRows) {
    const subjects: string[] = Array.isArray(row.jamb_subjects)
      ? row.jamb_subjects
      : typeof row.jamb_subjects === 'string'
        ? JSON.parse(row.jamb_subjects)
        : [];
    if (subjects.length === 0) continue;
    const key = normalizeSubjectCombination(subjects);
    const idx = comboByIndex.get(key);
    if (idx === undefined) continue;
    const combo = combinations[idx];
    const fc = (row.first_choice as string).trim();
    const existing = combo.firstChoiceDistribution.find((d) => d.firstChoice === fc);
    if (existing) {
      existing.candidateCount += row.cnt;
    } else {
      combo.firstChoiceDistribution.push({ firstChoice: fc, candidateCount: row.cnt, percentage: 0 });
    }
  }

  // Compute percentages
  for (const combo of combinations) {
    for (const fc of combo.firstChoiceDistribution) {
      fc.percentage = combo.candidateCount > 0
        ? Math.round((fc.candidateCount / combo.candidateCount) * 100 * 100) / 100
        : 0;
    }
    combo.firstChoiceDistribution.sort((a, b) => b.candidateCount - a.candidateCount);
  }

  res.json({ data: combinations });
});

/**
 * GET /api/schedule/combination-analysis/:normalizedKey
 * Get detailed analysis for a specific subject combination.
 */
export const combinationAnalysis = asyncHandler(async (req: Request, res: Response) => {
  const { normalizedKey } = req.params;

  const candidateRepo = AppDataSource.getRepository(Candidate);
  const groupRepo = AppDataSource.getRepository(CareerGroup);

  const CHUNK = 5000;
  let allCandidates: Candidate[] = [];
  let offset = 0;
  while (true) {
    const batch = await candidateRepo.find({ skip: offset, take: CHUNK });
    if (batch.length === 0) break;
    allCandidates = allCandidates.concat(batch);
    if (batch.length < CHUNK) break;
    offset += CHUNK;
  }

  const groups = await groupRepo.find();
  const combinationCandidates = getCandidatesForCombination(allCandidates, normalizedKey);

  if (combinationCandidates.length === 0) {
    throw AppError.notFound('No candidates found for this subject combination');
  }

  const firstChoiceDistribution = calculateFirstChoiceDistribution(
    allCandidates,
    normalizedKey
  );

  // Get status breakdown
  const statusBreakdown = {
    unscheduled: combinationCandidates.filter((c) => c.status === CandidateStatus.UNSCHEDULED).length,
    scheduled: combinationCandidates.filter((c) => c.status === CandidateStatus.SCHEDULED).length,
    completed: combinationCandidates.filter((c) => c.status === CandidateStatus.COMPLETED).length,
  };

  res.json({
    data: {
      subjectCombination: normalizedKey,
      candidateCount: combinationCandidates.length,
      firstChoiceDistribution,
      statusBreakdown,
    },
  });
});

/**
 * POST /api/schedule/preview-new
 * Preview scheduling for one or more subject combinations without persisting.
 */
export const previewNew = asyncHandler(async (req: Request, res: Response) => {
  const { subjectCombination, subjectCombinations, sessionIds, configId } = req.body as {
    subjectCombination?: string;
    subjectCombinations?: string[];
    sessionIds: string[];
    configId?: string;
  };

  const combos = subjectCombinations || (subjectCombination ? [subjectCombination] : []);
  if (combos.length === 0) throw AppError.badRequest('Select at least one subject combination');

  const context = await createPreviewContext(sessionIds, configId);
  const BATCH_SIZE = 5;
  let totalCandidates = 0;
  let totalScheduled = 0;
  let totalOverflow = 0;
  let totalCannotSchedule = 0;
  let totalDays = 0;
  let lastResult: any = null;

  for (let i = 0; i < combos.length; i += BATCH_SIZE) {
    const batch = combos.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((combo) => previewScheduling(combo, sessionIds, configId, context))
    );
    for (const result of results) {
      totalCandidates += result.candidateCount;
      totalScheduled += result.candidatesScheduled;
      totalOverflow += result.candidatesOverflow;
      totalCannotSchedule += result.candidatesCannotSchedule;
      totalDays = Math.max(totalDays, result.estimatedDays);
      lastResult = result;
    }
  }

  // Keep the last combo's full shape (days, sessions, halls) for the UI, but let
  // the aggregated totals win so multi-combination previews report correct counts.
  res.json({
    data: lastResult
      ? {
          ...lastResult,
          candidateCount: totalCandidates,
          candidatesScheduled: totalScheduled,
          candidatesOverflow: totalOverflow,
          candidatesCannotSchedule: totalCannotSchedule,
          estimatedDays: totalDays,
          sessionCount: sessionIds.length,
        }
      : {
          candidateCount: totalCandidates,
          candidatesScheduled: totalScheduled,
          candidatesOverflow: totalOverflow,
          candidatesCannotSchedule: totalCannotSchedule,
          estimatedDays: totalDays,
          sessionCount: sessionIds.length,
          days: [],
        },
  });
});

/**
 * POST /api/schedule/generate-new
 * Generate and persist scheduling for one or more subject combinations.
 */
export const generateNew = asyncHandler(async (req: Request, res: Response) => {
  const { subjectCombination, subjectCombinations, sessionIds, configId } = req.body as {
    subjectCombination?: string;
    subjectCombinations?: string[];
    sessionIds: string[];
    configId?: string;
  };

  const combos = subjectCombinations || (subjectCombination ? [subjectCombination] : []);
  if (combos.length === 0) throw AppError.badRequest('Select at least one subject combination');

  let totalScheduled = 0;
  let totalOverflow = 0;
  let totalDays = 0;
  const runIds: string[] = [];

  for (const combo of combos) {
    const result = await generateScheduling(
      combo,
      sessionIds,
      req.user?.id ?? null,
      configId
    );
    totalScheduled += result.scheduledCount;
    totalOverflow += result.overflowCount;
    totalDays = Math.max(totalDays, result.dayCount);
    runIds.push(result.runId);

    await logActivity({
      action: 'schedule.engine.generated',
      userId: req.user?.id ?? null,
      entityType: 'scheduling_run',
      entityId: result.runId,
      details: {
        subjectCombination: result.displayName,
        scheduledCount: result.scheduledCount,
        overflowCount: result.overflowCount,
        dayCount: result.dayCount,
      },
    });
  }

  res.json({ data: {
    scheduledCount: totalScheduled,
    overflowCount: totalOverflow,
    dayCount: totalDays,
    runId: runIds.length === 1 ? runIds[0] : runIds.join(','),
    displayName: combos.length === 1 ? `${combos.length} combination` : `${combos.length} combinations`,
  }});
});

/**
 * POST /api/schedule/regenerate-day
 * Regenerate scheduling for a specific day.
 */
export const regenerateDayHandler = asyncHandler(async (req: Request, res: Response) => {
  const { runId, dayDate } = req.body as {
    runId: string;
    dayDate: string;
  };

  const result = await regenerateDay(runId, dayDate, req.user?.id ?? null);

  await logActivity({
    action: 'schedule.engine.regenerated_day',
    userId: req.user?.id ?? null,
    entityType: 'scheduling_run',
    entityId: runId,
    details: { dayDate, scheduled: result.scheduledCount },
  });

  res.json({ data: result });
});

/**
 * POST /api/schedule/regenerate-session
 * Regenerate scheduling for a specific session.
 */
export const regenerateSessionHandler = asyncHandler(async (req: Request, res: Response) => {
  const { runId, sessionId } = req.body as {
    runId: string;
    sessionId: string;
  };

  const result = await regenerateSession(runId, sessionId, req.user?.id ?? null);

  await logActivity({
    action: 'schedule.engine.regenerated_session',
    userId: req.user?.id ?? null,
    entityType: 'scheduling_run',
    entityId: runId,
    details: { sessionId, scheduled: result.scheduledCount },
  });

  res.json({ data: result });
});

/**
 * GET /api/schedule/rescheduling-queue
 * Get the rescheduling queue.
 */
export const reschedulingQueue = asyncHandler(async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const offset = Number(req.query.offset) || 0;
  const { entries, total } = await getReschedulingQueue(status, limit, offset);
  res.json({ data: entries, meta: { total, limit, offset } });
});

/**
 * POST /api/schedule/reschedule-candidate
 * Reschedule a single candidate.
 */
export const rescheduleCandidateHandler = asyncHandler(async (req: Request, res: Response) => {
  const { entryId, targetSessionId, targetHallId } = req.body as {
    entryId: string;
    targetSessionId: string;
    targetHallId: string;
  };

  const result = await rescheduleCandidate(
    entryId,
    targetSessionId,
    targetHallId,
    req.user?.id ?? null
  );

  if (!result.success) {
    throw AppError.badRequest(result.message);
  }

  await logActivity({
    action: 'schedule.engine.rescheduled',
    userId: req.user?.id ?? null,
    entityType: 'rescheduling_entry',
    entityId: entryId,
    details: { candidateId: result.candidateId, assignment: result.assignment },
  });

  res.json({ data: result });
});

/**
 * POST /api/schedule/reschedule-bulk
 * Bulk reschedule multiple candidates.
 */
export const rescheduleBulkHandler = asyncHandler(async (req: Request, res: Response) => {
  const { entryIds, targetSessionId, targetHallId } = req.body as {
    entryIds: string[];
    targetSessionId: string;
    targetHallId: string;
  };

  const results = await rescheduleCandidates(
    entryIds,
    targetSessionId,
    targetHallId,
    req.user?.id ?? null
  );

  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  await logActivity({
    action: 'schedule.engine.rescheduled_bulk',
    userId: req.user?.id ?? null,
    entityType: 'rescheduling_entry',
    details: {
      total: entryIds.length,
      succeeded: succeeded.length,
      failed: failed.length,
    },
  });

  res.json({
    data: {
      succeeded,
      failed,
      summary: {
        total: entryIds.length,
        succeededCount: succeeded.length,
        failedCount: failed.length,
      },
    },
  });
});

/**
 * GET /api/schedule/runs
 * List all scheduling runs.
 */
export const listRuns = asyncHandler(async (_req: Request, res: Response) => {
  const repo = AppDataSource.getRepository(SchedulingRun);
  const runs = await repo.find({
    order: { createdAt: 'DESC' },
    take: 50,
  });
  res.json({ data: runs });
});

/**
 * GET /api/schedule/runs/:id
 * Get a specific scheduling run.
 */
export const getRun = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const repo = AppDataSource.getRepository(SchedulingRun);
  const run = await repo.findOne({ where: { id } });
  if (!run) throw AppError.notFound('Scheduling run not found');
  res.json({ data: run });
});

// ─── Scheduling Config Handlers ─────────────────────────────────────────────

/**
 * GET /api/schedule/configs
 * List all scheduling configurations.
 */
export const listConfigs = asyncHandler(async (_req: Request, res: Response) => {
  const repo = AppDataSource.getRepository(SchedulingConfig);
  const configs = await repo.find({ order: { createdAt: 'DESC' } });
  res.json({ data: configs });
});

/**
 * GET /api/schedule/configs/active
 * Get the active scheduling configuration.
 */
export const getActiveConfig = asyncHandler(async (_req: Request, res: Response) => {
  const repo = AppDataSource.getRepository(SchedulingConfig);
  const active = await repo.findOne({ where: { isActive: true } });
  res.json({ data: active });
});

/**
 * POST /api/schedule/configs
 * Create a new scheduling configuration.
 */
export const createConfig = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, rules, examPriorityOrder, firstChoicePriority, tieBreaker } = req.body as {
    name: string;
    description?: string;
    rules?: Record<string, unknown>;
    examPriorityOrder?: string[];
    firstChoicePriority?: Record<string, string[]>;
    tieBreaker?: string;
  };

  const repo = AppDataSource.getRepository(SchedulingConfig);

  // Check for duplicate name
  const existing = await repo.findOne({ where: { name } });
  if (existing) {
    throw AppError.conflict('A configuration with this name already exists');
  }

  const config = repo.create({
    id: genUuid(),
    name,
    description: description ?? null,
    rules: (rules as any) ?? undefined,
    examPriorityOrder: examPriorityOrder ?? null,
    firstChoicePriority: firstChoicePriority ?? null,
    tieBreaker: (tieBreaker as any) ?? null,
    isActive: false,
  });
  await repo.save(config);

  res.status(201).json({ data: config });
});

/**
 * PUT /api/schedule/configs/:id
 * Update a scheduling configuration.
 */
export const updateConfig = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, rules, examPriorityOrder, firstChoicePriority, tieBreaker } = req.body as {
    name?: string;
    description?: string;
    rules?: Record<string, unknown>;
    examPriorityOrder?: string[];
    firstChoicePriority?: Record<string, string[]>;
    tieBreaker?: string;
  };

  const repo = AppDataSource.getRepository(SchedulingConfig);
  const config = await repo.findOne({ where: { id } });
  if (!config) throw AppError.notFound('Configuration not found');

  if (name !== undefined) config.name = name;
  if (description !== undefined) config.description = description;
  if (rules !== undefined) config.rules = rules as any;
  if (examPriorityOrder !== undefined) config.examPriorityOrder = examPriorityOrder;
  if (firstChoicePriority !== undefined) config.firstChoicePriority = firstChoicePriority;
  if (tieBreaker !== undefined) config.tieBreaker = tieBreaker as any;

  await repo.save(config);
  res.json({ data: config });
});

/**
 * POST /api/schedule/configs/:id/activate
 * Set a configuration as active.
 */
export const activateConfig = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const repo = AppDataSource.getRepository(SchedulingConfig);

  // Deactivate all others
  await repo.update({ isActive: true }, { isActive: false });

  const config = await repo.findOne({ where: { id } });
  if (!config) throw AppError.notFound('Configuration not found');

  config.isActive = true;
  await repo.save(config);

  res.json({ data: config });
});

/**
 * DELETE /api/schedule/configs/:id
 * Delete a scheduling configuration.
 */
export const deleteConfig = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const repo = AppDataSource.getRepository(SchedulingConfig);

  const config = await repo.findOne({ where: { id } });
  if (!config) throw AppError.notFound('Configuration not found');

  if (config.isActive) {
    throw AppError.badRequest('Cannot delete the active configuration');
  }

  await repo.remove(config);
  res.json({ success: true });
});
