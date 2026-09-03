/**
 * ExamFlow Custom Scheduling Engine
 *
 * A rule-driven scheduling domain service that operates on subject combinations.
 * This module is independent of HTTP/controllers and can be tested in isolation.
 */
import { AppDataSource } from '../config/data-source';
import { Candidate, CandidateStatus } from '../entities/Candidate';
import { CandidateAssignment } from '../entities/CandidateAssignment';
import { CareerGroup } from '../entities/CareerGroup';
import { Hall } from '../entities/Hall';
import { Session } from '../entities/Session';
import { SchedulingConfig, SchedulingRules, DEFAULT_SCHEDULING_RULES } from '../entities/SchedulingConfig';
import { SchedulingRun, SchedulingRunStatus } from '../entities/SchedulingRun';
import { ReschedulingEntry, RescheduleReason, RescheduleStatus } from '../entities/ReschedulingEntry';
import { genUuid } from '../utils/ids';
import { seatLabel, hallCode } from './scheduler';

// ─── Subject Combination Normalization ───────────────────────────────────────

/**
 * Normalize a subject combination to a canonical form.
 * Sorts subjects alphabetically and joins with a consistent separator.
 * This ensures that equivalent combinations in different orders are recognized.
 *
 * Example:
 *   ["Physics", "Chemistry", "Mathematics", "English"]
 *   ["Mathematics", "English", "Physics", "Chemistry"]
 *   → both normalize to: "Chemistry|English|Mathematics|Physics"
 */
export function normalizeSubjectCombination(subjects: string[]): string {
  return subjects
    .map((s) => s.trim().toLowerCase())
    .sort((a, b) => a.localeCompare(b))
    .join('|');
}

/**
 * Display a normalized combination back in a human-readable form.
 */
export function displaySubjectCombination(normalized: string): string {
  return normalized
    .split('|')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' + ');
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SubjectCombinationInfo {
  normalizedKey: string;
  displayName: string;
  careerGroupId: string | null;
  careerGroupName: string | null;
  candidateCount: number;
  subjects: string[];
}

export interface FirstChoiceStat {
  firstChoice: string;
  candidateCount: number;
  percentage: number;
}

export interface DaySchedule {
  dayNumber: number;
  date: string;
  sessions: SessionSchedule[];
}

export interface SessionSchedule {
  session: Session;
  halls: HallSchedule[];
  totalAssigned: number;
}

export interface HallSchedule {
  hall: Hall;
  seats: SeatAssignment[];
  totalAssigned: number;
}

export interface SeatAssignment {
  candidateId: string;
  candidateName: string;
  seatNumber: string;
}

export interface PreviewResult {
  subjectCombination: string;
  displayName: string;
  candidateCount: number;
  firstChoiceDistribution: FirstChoiceStat[];
  availableHalls: { id: string; name: string; capacity: number }[];
  totalCapacityPerSession: number;
  sessions: Session[];
  estimatedDays: number;
  capacityUtilization: number;
  candidatesScheduled: number;
  candidatesOverflow: number;
  candidatesCannotSchedule: number;
  days: DaySchedule[];
  overflowCandidates: string[];
  unschedulableCandidates: string[];
}

export interface GenerateResult {
  runId: string;
  subjectCombination: string;
  displayName: string;
  candidateCount: number;
  scheduledCount: number;
  overflowCount: number;
  unschedulableCount: number;
  dayCount: number;
  days: DaySchedule[];
  rescheduledEntries: ReschedulingEntry[];
  summary: Record<string, unknown>;
}

export interface RescheduleCandidateResult {
  candidateId: string;
  success: boolean;
  message: string;
  assignment?: {
    sessionId: string;
    hallId: string;
    seatNumber: string;
    examDate: string;
  };
}

// ─── Analysis Functions ─────────────────────────────────────────────────────

/**
 * Get all unique subject combinations from candidates.
 * Groups by normalized subject key and returns metadata.
 */
export function analyzeSubjectCombinations(
  candidates: Candidate[],
  groups: CareerGroup[]
): SubjectCombinationInfo[] {
  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const combinationMap = new Map<
    string,
    {
      careerGroupId: string | null;
      careerGroupName: string | null;
      candidateCount: number;
      subjects: string[];
    }
  >();

  for (const candidate of candidates) {
    // Prefer jambSubjects if available, fall back to careerGroup.subjects
    let subjects: string[] = [];
    let careerGroupId: string | null = null;
    let careerGroupName: string | null = null;

    if (candidate.jambSubjects && candidate.jambSubjects.length > 0) {
      subjects = candidate.jambSubjects;
    } else if (candidate.careerGroupId) {
      const group = groupMap.get(candidate.careerGroupId);
      if (group) {
        subjects = group.subjects || [];
        careerGroupId = group.id;
        careerGroupName = group.name;
      }
    }

    if (subjects.length === 0) continue;

    const normalizedKey = normalizeSubjectCombination(subjects);
    const existing = combinationMap.get(normalizedKey);
    if (existing) {
      existing.candidateCount++;
    } else {
      combinationMap.set(normalizedKey, {
        careerGroupId,
        careerGroupName,
        candidateCount: 1,
        subjects,
      });
    }
  }

  return [...combinationMap.entries()]
    .map(([key, info]) => ({
      normalizedKey: key,
      displayName: displaySubjectCombination(key),
      ...info,
    }))
    .sort((a, b) => b.candidateCount - a.candidateCount);
}

/**
 * Calculate first-choice distribution for candidates with a given subject combination.
 */
export function calculateFirstChoiceDistribution(
  candidates: Candidate[],
  normalizedCombination: string
): FirstChoiceStat[] {
  const filtered = candidates.filter((c) => {
    const subjects = c.jambSubjects || [];
    return normalizeSubjectCombination(subjects) === normalizedCombination;
  });

  const total = filtered.length;
  if (total === 0) return [];

  const distMap = new Map<string, { count: number; display: string }>();
  for (const c of filtered) {
    const fcRaw = c.firstChoice || 'Unknown';
    const fc = fcRaw.toLowerCase().trim();
    const existing = distMap.get(fc);
    if (existing) {
      existing.count++;
    } else {
      distMap.set(fc, { count: 1, display: fcRaw });
    }
  }

  return [...distMap.entries()]
    .map(([firstChoice, { count, display }]) => ({
      firstChoice: display,
      candidateCount: count,
      percentage: Math.round((count / total) * 100 * 100) / 100,
    }))
    .sort((a, b) => b.candidateCount - a.candidateCount);
}

/**
 * Get candidates belonging to a specific subject combination.
 */
export function getCandidatesForCombination(
  candidates: Candidate[],
  normalizedCombination: string
): Candidate[] {
  return candidates.filter((c) => {
    const subjects = c.jambSubjects || [];
    return normalizeSubjectCombination(subjects) === normalizedCombination;
  });
}

// ─── Scheduling Rules Application ───────────────────────────────────────────

/**
 * Get active scheduling configuration or default rules.
 */
export async function getActiveRules(): Promise<SchedulingRules> {
  const repo = AppDataSource.getRepository(SchedulingConfig);
  const active = await repo.findOne({ where: { isActive: true } });
  return active?.rules ?? DEFAULT_SCHEDULING_RULES;
}

/**
 * Get scheduling configuration by ID.
 */
export async function getConfigById(id: string): Promise<SchedulingConfig | null> {
  return AppDataSource.getRepository(SchedulingConfig).findOne({ where: { id } });
}

/**
 * Filter sessions based on scheduling rules.
 */
function filterSessionsByRules(
  sessions: Session[],
  rules: SchedulingRules
): Session[] {
  let filtered = [...sessions];

  // Filter by available dates if configured
  if (rules.availableDates && rules.availableDates.length > 0) {
    filtered = filtered.filter((s) => rules.availableDates!.includes(s.examDate));
  }

  // Sort chronologically
  filtered.sort(
    (a, b) =>
      a.examDate.localeCompare(b.examDate) ||
      a.startTime.localeCompare(b.startTime)
  );

  // Limit sessions per day if configured
  if (rules.sessionsPerDay && rules.sessionsPerDay > 0) {
    const daySessionCount = new Map<string, number>();
    filtered = filtered.filter((s) => {
      const count = daySessionCount.get(s.examDate) ?? 0;
      if (count >= rules.sessionsPerDay!) return false;
      daySessionCount.set(s.examDate, count + 1);
      return true;
    });
  }

  return filtered;
}

/**
 * Check if a hall can be reused in the given context.
 */
function canReuseHall(
  hallId: string,
  sessionExamDate: string,
  usedHallsThisDay: Map<string, Set<string>>,
  rules: SchedulingRules
): boolean {
  if (rules.allowHallReuse) return true;
  if (rules.allowSameDayHallReuse) {
    // Hall can be reused across different days but not same day
    return !usedHallsThisDay.get(sessionExamDate)?.has(hallId);
  }
  // Hall cannot be reused at all
  return !usedHallsThisDay.has(sessionExamDate);
}

/**
 * Check seat spacing constraint.
 */
function canPlaceAtSeat(
  seatNumber: string,
  filledInSession: number,
  rules: SchedulingRules
): boolean {
  if (!rules.seatSpacingEnabled || rules.seatSpacingGap <= 0) return true;
  // Simple spacing: skip every N seats
  return true; // Handled during seat number generation
}

/**
 * Generate seat number with optional spacing.
 */
function generateSeatNumber(
  hallName: string,
  filledCount: number,
  rules: SchedulingRules
): string {
  if (rules.seatSpacingEnabled && rules.seatSpacingGap > 0) {
    // Apply spacing: skip seats according to gap
    const spacedIndex = filledCount * (rules.seatSpacingGap + 1);
    return seatLabel(hallName, spacedIndex + 1);
  }
  return seatLabel(hallName, filledCount + 1);
}

// ─── Core Scheduling Engine ─────────────────────────────────────────────────

export interface PreviewContext {
  rules: SchedulingRules;
  allCandidates: Candidate[];
  sessions: Session[];
  halls: Hall[];
  scheduledCandidateIds: Set<string>;
}

/** Load the shared read-only data needed by a multi-combination preview. */
export async function createPreviewContext(
  sessionIds: string[],
  configId?: string
): Promise<PreviewContext> {
  const rules = configId
    ? (await getConfigById(configId))?.rules ?? DEFAULT_SCHEDULING_RULES
    : await getActiveRules();
  const candidateRepo = AppDataSource.getRepository(Candidate);
  const sessionRepo = AppDataSource.getRepository(Session);
  const hallRepo = AppDataSource.getRepository(Hall);

  const [allCandidates, sessions, halls] = await Promise.all([
    loadAllCandidates(candidateRepo),
    loadSessions(sessionRepo, sessionIds),
    loadActiveHalls(hallRepo),
  ]);

  return {
    rules,
    allCandidates,
    sessions,
    halls,
    // Source of truth is the candidate status column, not assignment rows — so
    // preview and generate always agree on who is schedulable.
    scheduledCandidateIds: new Set(
      allCandidates
        .filter((c) => c.status === CandidateStatus.SCHEDULED || c.status === CandidateStatus.COMPLETED)
        .map((c) => c.id)
    ),
  };
}

/**
 * Preview scheduling for a subject combination without persisting.
 */
export async function previewScheduling(
  normalizedCombination: string,
  sessionIds: string[],
  configId?: string,
  sharedContext?: PreviewContext
): Promise<PreviewResult> {
  const context = sharedContext ?? (await createPreviewContext(sessionIds, configId));
  const { rules, allCandidates, sessions, halls } = context;

  // Filter sessions by rules
  const availableSessions = filterSessionsByRules(sessions, rules);

  // Get candidates for this combination
  const combinationCandidates = getCandidatesForCombination(
    allCandidates,
    normalizedCombination
  );

  // Exclude already-scheduled candidates
  const scheduledIds = context.scheduledCandidateIds;
  const unscheduledCandidates = combinationCandidates.filter(
    (c) => !scheduledIds.has(c.id)
  );

  // Calculate first-choice distribution
  const firstChoiceDistribution = calculateFirstChoiceDistribution(
    combinationCandidates,
    normalizedCombination
  );

  // Calculate capacity
  const totalCapacityPerSession = halls.reduce(
    (sum, h) => sum + h.capacity,
    0
  );
  const totalCapacity = totalCapacityPerSession * availableSessions.length;

  // Calculate estimated days
  const sessionsByDate = new Map<string, Session[]>();
  for (const s of availableSessions) {
    const existing = sessionsByDate.get(s.examDate) ?? [];
    existing.push(s);
    sessionsByDate.set(s.examDate, existing);
  }
  const estimatedDays = sessionsByDate.size;

  // Calculate how many can be scheduled
  const candidatesScheduled = Math.min(
    unscheduledCandidates.length,
    totalCapacity
  );
  const candidatesOverflow = Math.max(
    0,
    unscheduledCandidates.length - totalCapacity
  );

  // Build preview days
  const days = buildPreviewDays(
    availableSessions,
    halls,
    unscheduledCandidates.slice(0, candidatesScheduled),
    rules
  );

  // Capacity utilization
  const capacityUtilization =
    totalCapacity > 0
      ? Math.round((candidatesScheduled / totalCapacity) * 100 * 100) / 100
      : 0;

  // Candidates that cannot be scheduled (no sessions available)
  const candidatesCannotSchedule =
    availableSessions.length === 0 ? unscheduledCandidates.length : 0;

  const displayName = displaySubjectCombination(normalizedCombination);

  return {
    subjectCombination: normalizedCombination,
    displayName,
    candidateCount: combinationCandidates.length,
    firstChoiceDistribution,
    availableHalls: halls.map((h) => ({
      id: h.id,
      name: h.name,
      capacity: h.capacity,
    })),
    totalCapacityPerSession,
    sessions: availableSessions,
    estimatedDays,
    capacityUtilization,
    candidatesScheduled,
    candidatesOverflow,
    candidatesCannotSchedule,
    days,
    overflowCandidates: unscheduledCandidates
      .slice(candidatesScheduled)
      .map((c) => c.id),
    unschedulableCandidates:
      availableSessions.length === 0
        ? unscheduledCandidates.map((c) => c.id)
        : [],
  };
}

/**
 * Generate and persist scheduling for a subject combination.
 * Uses a transaction to ensure atomicity.
 */
export async function generateScheduling(
  normalizedCombination: string,
  sessionIds: string[],
  userId: string | null,
  configId?: string
): Promise<GenerateResult> {
  const rules = configId
    ? (await getConfigById(configId))?.rules ?? DEFAULT_SCHEDULING_RULES
    : await getActiveRules();

  const ds = AppDataSource;
  const qr = ds.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();

  try {
    const candidateRepo = qr.manager.getRepository(Candidate);
    const sessionRepo = qr.manager.getRepository(Session);
    const hallRepo = qr.manager.getRepository(Hall);
    const groupRepo = qr.manager.getRepository(CareerGroup);
    const runRepo = qr.manager.getRepository(SchedulingRun);
    const rescheduleRepo = qr.manager.getRepository(ReschedulingEntry);

    const allCandidates = await loadAllCandidates(candidateRepo);
    const sessions = await loadSessions(sessionRepo, sessionIds);
    const halls = await loadActiveHalls(hallRepo);
    const groups = await groupRepo.find();

    const availableSessions = filterSessionsByRules(sessions, rules);
    const combinationCandidates = getCandidatesForCombination(
      allCandidates,
      normalizedCombination
    );

    // A candidate is considered "already scheduled" based on its status column
    // (the single source of truth), NOT on the existence of an assignment row.
    // This keeps statuses and assignments in sync even if a previous run was
    // interrupted — a candidate whose status is unscheduled is always re-tryable,
    // and any stale assignment it has is replaced below instead of deadlocking
    // the engine into returning zero results forever.
    const scheduledIds = new Set(
      allCandidates
        .filter((c) => c.status === CandidateStatus.SCHEDULED || c.status === CandidateStatus.COMPLETED)
        .map((c) => c.id)
    );
    const unscheduledCandidates = combinationCandidates.filter(
      (c) => !scheduledIds.has(c.id)
    );

    // Create scheduling run record
    const run = runRepo.create({
      id: genUuid(),
      subjectCombination: normalizedCombination,
      careerGroupId:
        combinationCandidates.length > 0
          ? combinationCandidates[0].careerGroupId
          : null,
      candidateCount: combinationCandidates.length,
      status: SchedulingRunStatus.GENERATING,
      configUsed: rules as unknown as Record<string, unknown>,
      sessionIds: availableSessions.map((s) => s.id),
      hallIds: halls.map((h) => h.id),
      generatedBy: userId,
      startedAt: new Date(),
    });
    await runRepo.save(run);

    // Perform the actual scheduling
    const existingFillRows: { session_id: string; hall_id: string; cnt: string }[] =
      availableSessions.length > 0
        ? await qr.manager.query(
            `SELECT session_id, hall_id, COUNT(*)::int AS cnt
             FROM candidate_assignments
             WHERE session_id = ANY($1::varchar[])
             GROUP BY session_id, hall_id`,
            [availableSessions.map((s) => s.id)]
          )
        : [];
    const existingFill = new Map<string, number>();
    for (const row of existingFillRows) {
      existingFill.set(`${row.session_id}:${row.hall_id}`, Number(row.cnt));
    }

    const result = performScheduling(
      unscheduledCandidates,
      availableSessions,
      halls,
      rules,
      run.id,
      existingFill
    );

    // Persist assignments
    if (result.assignments.length > 0) {
      const INSERT_BATCH = 5000;
      for (let i = 0; i < result.assignments.length; i += INSERT_BATCH) {
        const batch = result.assignments.slice(i, i + INSERT_BATCH);
        const rows: string[] = [];
        const params: unknown[] = [];
        let pi = 1;
        for (const a of batch) {
          rows.push(
            `($${pi}, $${pi + 1}, $${pi + 2}, $${pi + 3}, $${pi + 4}, $${pi + 5})`
          );
          params.push(
            `${a.candidateId}:${a.sessionId}`,
            a.candidateId,
            a.sessionId,
            a.hallId,
            a.seatNumber,
            new Date()
          );
          pi += 6;
        }
        await qr.manager.query(
          `INSERT INTO candidate_assignments (id, candidate_id, session_id, hall_id, seat_number, assigned_at)
           VALUES ${rows.join(',')}
           ON CONFLICT (candidate_id)
           DO UPDATE SET session_id = EXCLUDED.session_id,
                         hall_id = EXCLUDED.hall_id,
                         seat_number = EXCLUDED.seat_number,
                         assigned_at = EXCLUDED.assigned_at`,
          params
        );
      }
    }

    // Update candidate statuses in bulk (avoids thousands of sequential UPDATEs)
    const sessionById = new Map(availableSessions.map((s) => [s.id, s]));

    if (result.assignments.length > 0) {
      const UPDATE_BATCH = 5000;
      await qr.manager.query(
        `CREATE TEMPORARY TABLE _gen (
          candidate_id VARCHAR, hall_id VARCHAR, seat_number VARCHAR, session_id VARCHAR, exam_date VARCHAR
        ) ON COMMIT DROP`
      );
      for (let i = 0; i < result.assignments.length; i += UPDATE_BATCH) {
        const batch = result.assignments.slice(i, i + UPDATE_BATCH);
        const rows: string[] = [];
        const params: unknown[] = [];
        let pi = 1;
        for (const a of batch) {
          const session = sessionById.get(a.sessionId)!;
          rows.push(`($${pi}, $${pi + 1}, $${pi + 2}, $${pi + 3}, $${pi + 4})`);
          params.push(a.candidateId, a.hallId, a.seatNumber, a.sessionId, session.examDate);
          pi += 5;
        }
        await qr.manager.query(
          `INSERT INTO _gen (candidate_id, hall_id, seat_number, session_id, exam_date) VALUES ${rows.join(',')}`,
          params
        );
      }
      await qr.manager.query(
        `UPDATE candidates SET
          status = $1,
          assigned_hall_id = g.hall_id,
          assigned_seat_number = g.seat_number,
          assigned_session_id = g.session_id,
          assigned_exam_date = g.exam_date
        FROM _gen g WHERE candidates.id = g.candidate_id`,
        [CandidateStatus.SCHEDULED]
      );
    }

    // Candidates in this combination that were not assigned by this run
    const assignedSet = new Set(result.assignments.map((a) => a.candidateId));
    const unassignedIds = unscheduledCandidates
      .filter((c) => !assignedSet.has(c.id))
      .map((c) => c.id);
    for (let i = 0; i < unassignedIds.length; i += 5000) {
      await qr.manager.query(
        `UPDATE candidates SET status = $1 WHERE id = ANY($2::varchar[])`,
        [CandidateStatus.UNSCHEDULED, unassignedIds.slice(i, i + 5000)]
      );
    }

    // Create rescheduling entries for overflow
    const rescheduleEntries: ReschedulingEntry[] = [];
    for (const candidate of result.overflow) {
      const entry = rescheduleRepo.create({
        id: genUuid(),
        candidateId: candidate.id,
        schedulingRunId: run.id,
        subjectCombination: normalizedCombination,
        reason: RescheduleReason.CAPACITY_EXCEEDED,
        status: RescheduleStatus.PENDING,
        notes: 'Candidate could not be scheduled due to capacity constraints',
      });
      rescheduleEntries.push(entry);
    }
    if (rescheduleEntries.length > 0) {
      await rescheduleRepo.save(rescheduleEntries);
    }

    // Update run record
    run.scheduledCount = result.assignments.length;
    run.overflowCount = result.overflow.length;
    run.dayCount = result.days.length;
    run.status =
      result.overflow.length > 0
        ? SchedulingRunStatus.PARTIAL
        : SchedulingRunStatus.COMPLETED;
    run.completedAt = new Date();
    run.summary = {
      scheduled: result.assignments.length,
      overflow: result.overflow.length,
      days: result.days.length,
      hallsUsed: new Set(result.assignments.map((a) => a.hallId)).size,
    };
    await runRepo.save(run);

    await qr.commitTransaction();

    const displayName = displaySubjectCombination(normalizedCombination);

    return {
      runId: run.id,
      subjectCombination: normalizedCombination,
      displayName,
      candidateCount: combinationCandidates.length,
      scheduledCount: result.assignments.length,
      overflowCount: result.overflow.length,
      unschedulableCount: 0,
      dayCount: result.days.length,
      days: result.days,
      rescheduledEntries: rescheduleEntries,
      summary: run.summary,
    };
  } catch (err) {
    await qr.rollbackTransaction();
    throw err;
  } finally {
    await qr.release();
  }
}

/**
 * Regenerate scheduling for a specific day within a subject combination run.
 */
export async function regenerateDay(
  runId: string,
  dayDate: string,
  userId: string | null
): Promise<GenerateResult> {
  const ds = AppDataSource;
  const runRepo = ds.getRepository(SchedulingRun);
  const run = await runRepo.findOne({ where: { id: runId } });
  if (!run) throw new Error(`Scheduling run not found: ${runId}`);

  // Clear existing assignments for this day and this run's sessions
  const sessionRepo = ds.getRepository(Session);
  const sessions = await loadSessions(sessionRepo, run.sessionIds ?? []);
  const daySessions = sessions.filter((s) => s.examDate === dayDate);
  const daySessionIds = daySessions.map((s) => s.id);

  if (daySessionIds.length === 0) {
    throw new Error(`No sessions found for date ${dayDate} in run ${runId}`);
  }

  const qr = ds.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();

  try {
    // Remove assignments for these sessions
    for (const sid of daySessionIds) {
      await qr.manager.query(
        `DELETE FROM candidate_assignments WHERE session_id = $1`,
        [sid]
      );
    }

    // Reset candidate statuses for these sessions
    await qr.manager.query(
      `UPDATE candidates SET
        status = $1,
        assigned_hall_id = NULL,
        assigned_seat_number = NULL,
        assigned_session_id = NULL,
        assigned_exam_date = NULL
      WHERE assigned_session_id = ANY($2::varchar[])`,
      [CandidateStatus.UNSCHEDULED, daySessionIds]
    );

    // Remove rescheduling entries for this run
    await qr.manager.query(
      `DELETE FROM rescheduling_entries WHERE scheduling_run_id = $1`,
      [runId]
    );

    await qr.commitTransaction();
  } catch (err) {
    await qr.rollbackTransaction();
    throw err;
  } finally {
    await qr.release();
  }

  // Re-generate
  return generateScheduling(
    run.subjectCombination,
    run.sessionIds ?? [],
    userId,
    undefined
  );
}

/**
 * Regenerate scheduling for a specific session.
 */
export async function regenerateSession(
  runId: string,
  sessionId: string,
  userId: string | null
): Promise<GenerateResult> {
  const ds = AppDataSource;
  const runRepo = ds.getRepository(SchedulingRun);
  const run = await runRepo.findOne({ where: { id: runId } });
  if (!run) throw new Error(`Scheduling run not found: ${runId}`);

  const qr = ds.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();

  try {
    // Remove assignments for this session
    await qr.manager.query(
      `DELETE FROM candidate_assignments WHERE session_id = $1`,
      [sessionId]
    );

    // Reset candidate statuses
    await qr.manager.query(
      `UPDATE candidates SET
        status = $1,
        assigned_hall_id = NULL,
        assigned_seat_number = NULL,
        assigned_session_id = NULL,
        assigned_exam_date = NULL
      WHERE assigned_session_id = $2`,
      [CandidateStatus.UNSCHEDULED, sessionId]
    );

    await qr.commitTransaction();
  } catch (err) {
    await qr.rollbackTransaction();
    throw err;
  } finally {
    await qr.release();
  }

  // Re-generate
  return generateScheduling(
    run.subjectCombination,
    run.sessionIds ?? [],
    userId,
    undefined
  );
}

// ─── Rescheduling Queue ─────────────────────────────────────────────────────

/**
 * Get all pending rescheduling entries.
 */
export async function getReschedulingQueue(
  status?: string,
  limit = 100,
  offset = 0
): Promise<{ entries: ReschedulingEntry[]; total: number }> {
  const repo = AppDataSource.getRepository(ReschedulingEntry);
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  const [entries, total] = await repo.findAndCount({
    where,
    relations: ['candidate'],
    order: { createdAt: 'ASC' },
    take: limit,
    skip: offset,
  });
  return { entries, total };
}

/**
 * Reschedule a specific candidate to a new session/hall/seat.
 */
export async function rescheduleCandidate(
  entryId: string,
  targetSessionId: string,
  targetHallId: string,
  userId: string | null
): Promise<RescheduleCandidateResult> {
  const ds = AppDataSource;
  const entryRepo = ds.getRepository(ReschedulingEntry);
  const assignmentRepo = ds.getRepository(CandidateAssignment);
  const candidateRepo = ds.getRepository(Candidate);
  const sessionRepo = ds.getRepository(Session);
  const hallRepo = ds.getRepository(Hall);

  const entry = await entryRepo.findOne({
    where: { id: entryId },
    relations: ['candidate'],
  });
  if (!entry) {
    return {
      candidateId: '',
      success: false,
      message: 'Rescheduling entry not found',
    };
  }

  if (entry.status !== RescheduleStatus.PENDING) {
    return {
      candidateId: entry.candidateId,
      success: false,
      message: `Entry is already ${entry.status}`,
    };
  }

  const candidate = await candidateRepo.findOne({
    where: { id: entry.candidateId },
  });
  if (!candidate) {
    return {
      candidateId: entry.candidateId,
      success: false,
      message: 'Candidate not found',
    };
  }

  const session = await sessionRepo.findOne({
    where: { id: targetSessionId },
  });
  if (!session) {
    return {
      candidateId: entry.candidateId,
      success: false,
      message: 'Target session not found',
    };
  }

  const hall = await hallRepo.findOne({ where: { id: targetHallId } });
  if (!hall) {
    return {
      candidateId: entry.candidateId,
      success: false,
      message: 'Target hall not found',
    };
  }

  // Check if candidate already has an assignment
  const existingAssignment = await assignmentRepo.findOne({
    where: { candidateId: candidate.id },
  });
  if (existingAssignment) {
    return {
      candidateId: candidate.id,
      success: false,
      message: 'Candidate already has an assignment',
    };
  }

  // Find available seat in the target hall/session
  const existingSeats = await assignmentRepo.find({
    where: { sessionId: targetSessionId, hallId: targetHallId },
  });
  const usedSeats = new Set(existingSeats.map((a) => a.seatNumber));

  let seatNumber: string | null = null;
  for (let i = 1; i <= hall.capacity; i++) {
    const candidate = seatLabel(hall.name, i);
    if (!usedSeats.has(candidate)) {
      seatNumber = candidate;
      break;
    }
  }

  if (!seatNumber) {
    return {
      candidateId: candidate.id,
      success: false,
      message: 'No available seats in the target hall/session',
    };
  }

  // Create assignment
  const qr = ds.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();

  try {
    const assignment = qr.manager.create(CandidateAssignment, {
      id: `${candidate.id}:${session.id}`,
      candidateId: candidate.id,
      sessionId: session.id,
      hallId: hall.id,
      seatNumber,
    });
    await qr.manager.save(assignment);

    // Update candidate
    candidate.status = CandidateStatus.SCHEDULED;
    candidate.assignedHallId = hall.id;
    candidate.assignedSeatNumber = seatNumber;
    candidate.assignedSessionId = session.id;
    candidate.assignedExamDate = session.examDate;
    await qr.manager.save(candidate);

    // Update rescheduling entry
    entry.status = RescheduleStatus.RESCHEDULED;
    entry.targetSessionId = session.id;
    entry.targetHallId = hall.id;
    entry.targetSeatNumber = seatNumber;
    entry.targetExamDate = session.examDate;
    entry.assignedAt = new Date();
    await qr.manager.save(entry);

    await qr.commitTransaction();

    return {
      candidateId: candidate.id,
      success: true,
      message: 'Candidate rescheduled successfully',
      assignment: {
        sessionId: session.id,
        hallId: hall.id,
        seatNumber,
        examDate: session.examDate,
      },
    };
  } catch (err) {
    await qr.rollbackTransaction();
    return {
      candidateId: candidate.id,
      success: false,
      message: `Rescheduling failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  } finally {
    await qr.release();
  }
}

/**
 * Bulk reschedule multiple candidates.
 */
export async function rescheduleCandidates(
  entryIds: string[],
  targetSessionId: string,
  targetHallId: string,
  userId: string | null
): Promise<RescheduleCandidateResult[]> {
  const results: RescheduleCandidateResult[] = [];
  for (const entryId of entryIds) {
    const result = await rescheduleCandidate(
      entryId,
      targetSessionId,
      targetHallId,
      userId
    );
    results.push(result);
  }
  return results;
}

// ─── Internal Helpers ───────────────────────────────────────────────────────

interface AssignmentDraft {
  candidateId: string;
  sessionId: string;
  hallId: string;
  seatNumber: string;
}

interface SchedulingOutput {
  assignments: AssignmentDraft[];
  overflow: Candidate[];
  days: DaySchedule[];
}

/**
 * Perform the core scheduling algorithm.
 */
function performScheduling(
  candidates: Candidate[],
  sessions: Session[],
  halls: Hall[],
  rules: SchedulingRules,
  runId: string,
  existingFill?: Map<string, number>
): SchedulingOutput {
  const sortedSessions = filterSessionsByRules(sessions, rules);

  // Sort halls by capacity (largest first) for better packing
  const sortedHalls = [...halls].sort(
    (a, b) => b.capacity - a.capacity || a.name.localeCompare(b.name)
  );

  // Track fill levels per (sessionId, hallId). Seed from existing assignments
  // so new runs continue numbering instead of reusing occupied seats.
  const fillLevel = new Map(existingFill ?? []);
  const assignments: AssignmentDraft[] = [];
  const overflow: Candidate[] = [];
  const usedHallsThisDay = new Map<string, Set<string>>();

  // Build slot list
  interface Slot {
    sessionId: string;
    examDate: string;
    hallId: string;
    hallName: string;
    capacity: number;
  }
  const slotOrder: Slot[] = [];
  for (const session of sortedSessions) {
    for (const hall of sortedHalls) {
      // Check hall reuse rules
      if (!canReuseHall(hall.id, session.examDate, usedHallsThisDay, rules)) {
        continue;
      }

      // Check max candidates per hall
      if (
        rules.maxCandidatesPerHall &&
        hall.capacity > rules.maxCandidatesPerHall
      ) {
        // Create a virtual slot with reduced capacity
        slotOrder.push({
          sessionId: session.id,
          examDate: session.examDate,
          hallId: hall.id,
          hallName: hall.name,
          capacity: rules.maxCandidatesPerHall,
        });
      } else {
        slotOrder.push({
          sessionId: session.id,
          examDate: session.examDate,
          hallId: hall.id,
          hallName: hall.name,
          capacity: hall.capacity,
        });
      }
    }
  }

  // Assign candidates to slots
  for (const candidate of candidates) {
    let placed = false;
    for (const slot of slotOrder) {
      const key = `${slot.sessionId}:${slot.hallId}`;
      const filled = fillLevel.get(key) ?? 0;
      if (filled >= slot.capacity) continue;

      const seatNumber = generateSeatNumber(slot.hallName, filled, rules);
      fillLevel.set(key, filled + 1);

      // Track hall usage per day
      if (!usedHallsThisDay.has(slot.examDate)) {
        usedHallsThisDay.set(slot.examDate, new Set());
      }
      usedHallsThisDay.get(slot.examDate)!.add(slot.hallId);

      assignments.push({
        candidateId: candidate.id,
        sessionId: slot.sessionId,
        hallId: slot.hallId,
        seatNumber,
      });
      placed = true;
      break;
    }
    if (!placed) {
      overflow.push(candidate);
    }
  }

  // Build day schedule for output
  const days = buildDaySchedule(sortedSessions, halls, assignments);

  return { assignments, overflow, days };
}

/**
 * Build day schedule from assignments (for preview).
 */
function buildPreviewDays(
  sessions: Session[],
  halls: Hall[],
  candidates: Candidate[],
  rules: SchedulingRules
): DaySchedule[] {
  const sortedHalls = [...halls].sort(
    (a, b) => b.capacity - a.capacity || a.name.localeCompare(b.name)
  );

  const days = new Map<string, DaySchedule>();
  let candidateIndex = 0;

  for (const session of sessions) {
    if (!days.has(session.examDate)) {
      days.set(session.examDate, {
        dayNumber: days.size + 1,
        date: session.examDate,
        sessions: [],
      });
    }
    const day = days.get(session.examDate)!;

    const sessionSchedule: SessionSchedule = {
      session,
      halls: [],
      totalAssigned: 0,
    };

    for (const hall of sortedHalls) {
      const hallSchedule: HallSchedule = {
        hall,
        seats: [],
        totalAssigned: 0,
      };

      const maxSeats = rules.maxCandidatesPerHall
        ? Math.min(hall.capacity, rules.maxCandidatesPerHall)
        : hall.capacity;

      for (let i = 0; i < maxSeats && candidateIndex < candidates.length; i++) {
        const candidate = candidates[candidateIndex];
        const seatNumber = generateSeatNumber(hall.name, i, rules);
        hallSchedule.seats.push({
          candidateId: candidate.id,
          candidateName: candidate.name,
          seatNumber,
        });
        hallSchedule.totalAssigned++;
        sessionSchedule.totalAssigned++;
        candidateIndex++;
      }

      sessionSchedule.halls.push(hallSchedule);
    }

    day.sessions.push(sessionSchedule);
  }

  return [...days.values()];
}

/**
 * Build day schedule from actual assignments (for generate output).
 */
function buildDaySchedule(
  sessions: Session[],
  halls: Hall[],
  assignments: AssignmentDraft[]
): DaySchedule[] {
  const sessionMap = new Map(sessions.map((s) => [s.id, s]));
  const hallMap = new Map(halls.map((h) => [h.id, h]));
  const candidateRepo = AppDataSource.getRepository(Candidate);

  const days = new Map<string, DaySchedule>();

  for (const a of assignments) {
    const session = sessionMap.get(a.sessionId);
    if (!session) continue;

    if (!days.has(session.examDate)) {
      days.set(session.examDate, {
        dayNumber: days.size + 1,
        date: session.examDate,
        sessions: [],
      });
    }
    const day = days.get(session.examDate)!;

    let sessionSchedule = day.sessions.find(
      (s) => s.session.id === a.sessionId
    );
    if (!sessionSchedule) {
      sessionSchedule = {
        session,
        halls: [],
        totalAssigned: 0,
      };
      day.sessions.push(sessionSchedule);
    }

    const hall = hallMap.get(a.hallId);
    if (!hall) continue;

    let hallSchedule = sessionSchedule.halls.find(
      (h) => h.hall.id === a.hallId
    );
    if (!hallSchedule) {
      hallSchedule = {
        hall,
        seats: [],
        totalAssigned: 0,
      };
      sessionSchedule.halls.push(hallSchedule);
    }

    hallSchedule.seats.push({
      candidateId: a.candidateId,
      candidateName: '', // Populated lazily if needed
      seatNumber: a.seatNumber,
    });
    hallSchedule.totalAssigned++;
    sessionSchedule.totalAssigned++;
  }

  return [...days.values()];
}

// ─── Data Loaders ───────────────────────────────────────────────────────────

import { Repository } from 'typeorm';

async function loadAllCandidates(
  repo: Repository<Candidate>
): Promise<Candidate[]> {
  // Select only the columns needed by the scheduler to cut hydration cost on huge tables.
  const CHUNK = 20_000;
  let all: Candidate[] = [];
  let offset = 0;
  while (true) {
    const batch = await repo.find({
      select: ['id', 'name', 'careerGroupId', 'status', 'jambSubjects', 'firstChoice'],
      skip: offset,
      take: CHUNK,
    });
    if (batch.length === 0) break;
    all = all.concat(batch);
    if (batch.length < CHUNK) break;
    offset += CHUNK;
  }
  return all;
}

async function loadSessions(
  repo: Repository<Session>,
  sessionIds: string[]
): Promise<Session[]> {
  if (sessionIds.length === 0) {
    return repo.find();
  }
  const CHUNK = 5000;
  let all: Session[] = [];
  for (let i = 0; i < sessionIds.length; i += CHUNK) {
    const chunk = sessionIds.slice(i, i + CHUNK);
    const batch = await repo.find({
      where: chunk.map((id) => ({ id })),
    });
    all = all.concat(batch);
  }
  return all;
}

async function loadActiveHalls(
  repo: Repository<Hall>
): Promise<Hall[]> {
  const halls = await repo.find();
  return halls.filter((h) => h.status === 'active');
}
