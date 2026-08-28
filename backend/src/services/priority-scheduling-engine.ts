/**
 * ExamFlow Priority Scheduling Engine
 *
 * A priority-driven scheduling domain service that respects admin-defined
 * exam priority, first-choice priority, and tie-breaker rules.
 *
 * Scheduling flow:
 *   Exam Priority → First Choice Priority → Tie Breaker → Candidate Queue →
 *   Available Date → Available Session → Available Hall → Capacity → Assignment
 *
 * This module is independent of HTTP/controllers and can be tested in isolation.
 */
import { AppDataSource } from '../config/data-source';
import { AppError } from '../utils/errors';
import { Candidate, CandidateStatus } from '../entities/Candidate';
import { CandidateAssignment } from '../entities/CandidateAssignment';
import { CareerGroup } from '../entities/CareerGroup';
import { Hall } from '../entities/Hall';
import { Session } from '../entities/Session';
import { SchedulingConfig, SchedulingRules, DEFAULT_SCHEDULING_RULES, TieBreakerRule } from '../entities/SchedulingConfig';
import { SchedulingRun, SchedulingRunStatus } from '../entities/SchedulingRun';
import { ScheduleConflict, ConflictType, ConflictStatus } from '../entities/ScheduleConflict';
import { ScheduleHistory } from '../entities/ScheduleHistory';
import { ReschedulingEntry, RescheduleReason, RescheduleStatus } from '../entities/ReschedulingEntry';
import { genUuid } from '../utils/ids';
import { seatLabel } from './scheduler';
import { normalizeSubjectCombination, displaySubjectCombination } from './scheduling-engine';
import { logActivity } from './activity-log';
import type { Repository } from 'typeorm';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface PriorityCandidate {
  candidate: Candidate;
  normalizedCombination: string;
  firstChoice: string;
}

export interface AssignmentDraft {
  candidateId: string;
  sessionId: string;
  hallId: string;
  seatNumber: string;
  examDate: string;
}

export interface ConflictDraft {
  candidateId: string;
  conflictType: string;
  description: string;
  assignedSessionId: string | null;
  assignedHallId: string | null;
  assignedExamDate: string | null;
  assignedSeatNumber: string | null;
}

export interface PrioritySchedulingResult {
  assignments: AssignmentDraft[];
  conflicts: ConflictDraft[];
  overflow: Candidate[];
  needsAttention: Array<{
    candidateId: string;
    candidateName: string;
    subjectCombination: string;
    firstChoice: string;
    reason: string;
    conflictType: string;
  }>;
  days: Array<{
    dayNumber: number;
    date: string;
    sessions: Array<{
      session: Session;
      halls: Array<{
        hall: Hall;
        seatCount: number;
        capacity: number;
      }>;
      totalAssigned: number;
    }>;
    totalAssigned: number;
  }>;
  examPriorityOrder: string[];
  firstChoicePriority: Record<string, string[]>;
}

export interface PublishResult {
  historyId: string;
  runId: string;
  name: string;
  publishedAt: Date;
}

// ─── Candidate Sorting ─────────────────────────────────────────────────────

/**
 * Apply tie-breaker rule to sort candidates with same exam + first-choice.
 */
function applyTieBreaker(candidates: PriorityCandidate[], rule: TieBreakerRule | null): PriorityCandidate[] {
  const sorted = [...candidates];
  switch (rule) {
    case 'name_asc':
      return sorted.sort((a, b) => a.candidate.name.localeCompare(b.candidate.name));
    case 'name_desc':
      return sorted.sort((a, b) => b.candidate.name.localeCompare(a.candidate.name));
    case 'id_asc':
      return sorted.sort((a, b) => a.candidate.id.localeCompare(b.candidate.id));
    case 'id_desc':
      return sorted.sort((a, b) => b.candidate.id.localeCompare(a.candidate.id));
    case 'random':
      // Fisher-Yates shuffle for deterministic randomness (seeded by id hash)
      for (let i = sorted.length - 1; i > 0; i--) {
        const j = Math.abs(hashCode(sorted[i].candidate.id)) % (i + 1);
        [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
      }
      return sorted;
    default:
      // No tie-breaker: maintain original order (stable)
      return sorted;
  }
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash;
}

/**
 * Sort candidates according to admin-defined priority:
 * 1. Exam combination priority (admin order)
 * 2. First-choice programme priority (admin order within exam)
 * 3. Tie-breaker (admin-selected)
 */
export function sortCandidatesByPriority(
  candidates: PriorityCandidate[],
  examPriorityOrder: string[] | null,
  firstChoicePriority: Record<string, string[]> | null,
  tieBreaker: TieBreakerRule | null
): PriorityCandidate[] {
  // Group by normalized combination
  const byCombo = new Map<string, PriorityCandidate[]>();
  for (const pc of candidates) {
    const list = byCombo.get(pc.normalizedCombination) ?? [];
    list.push(pc);
    byCombo.set(pc.normalizedCombination, list);
  }

  // Determine exam processing order
  const comboKeys = [...byCombo.keys()];
  let orderedCombos: string[];
  if (examPriorityOrder && examPriorityOrder.length > 0) {
    // Use admin-defined order, appending any combos not in the admin list at the end
    const adminSet = new Set(examPriorityOrder);
    const adminOrdered = examPriorityOrder.filter((k) => byCombo.has(k));
    const remaining = comboKeys.filter((k) => !adminSet.has(k));
    orderedCombos = [...adminOrdered, ...remaining];
  } else {
    // Default: sort by candidate count descending
    orderedCombos = comboKeys.sort((a, b) => (byCombo.get(b)?.length ?? 0) - (byCombo.get(a)?.length ?? 0));
  }

  const result: PriorityCandidate[] = [];

  for (const comboKey of orderedCombos) {
    const comboCandidates = byCombo.get(comboKey) ?? [];

    // Group by first choice within this combo (case-insensitive)
    const byFirstChoice = new Map<string, PriorityCandidate[]>();
    const fcDisplayMap = new Map<string, string>(); // lowercase -> original display name
    for (const pc of comboCandidates) {
      const fcRaw = pc.firstChoice || 'Unknown';
      const fc = fcRaw.toLowerCase().trim();
      fcDisplayMap.set(fc, fcRaw);
      const list = byFirstChoice.get(fc) ?? [];
      list.push(pc);
      byFirstChoice.set(fc, list);
    }

    // Determine first-choice order (case-insensitive matching)
    const fcKeys = [...byFirstChoice.keys()];
    let orderedFCs: string[];
    if (firstChoicePriority && firstChoicePriority[comboKey]) {
      const adminFCOrder = firstChoicePriority[comboKey].map((k) => k.toLowerCase().trim());
      const adminFCSet = new Set(adminFCOrder);
      const adminOrdered = adminFCOrder.filter((k) => byFirstChoice.has(k));
      const remaining = fcKeys.filter((k) => !adminFCSet.has(k));
      orderedFCs = [...adminOrdered, ...remaining];
    } else {
      // Default: sort by count descending
      orderedFCs = fcKeys.sort((a, b) => (byFirstChoice.get(b)?.length ?? 0) - (byFirstChoice.get(a)?.length ?? 0));
    }

    for (const fc of orderedFCs) {
      const fcCandidates = byFirstChoice.get(fc) ?? [];
      result.push(...applyTieBreaker(fcCandidates, tieBreaker));
    }
  }

  return result;
}

// ─── Session/Hall Capacity Tracking ────────────────────────────────────────

interface SlotCapacity {
  sessionId: string;
  hallId: string;
  capacity: number;
  filled: number;
}

interface DayCapacity {
  date: string;
  totalCapacity: number;
  totalFilled: number;
  slots: SlotCapacity[];
}

// ─── Core Scheduling Algorithm ─────────────────────────────────────────────

/**
 * Perform priority-aware scheduling.
 * Returns assignments, conflicts, overflow, and needs-attention items.
 */
export function performPriorityScheduling(
  sortedCandidates: PriorityCandidate[],
  sessions: Session[],
  halls: Hall[],
  rules: SchedulingRules,
): PrioritySchedulingResult {
  const assignments: AssignmentDraft[] = [];
  const conflicts: ConflictDraft[] = [];
  const overflow: Candidate[] = [];
  const needsAttention: Array<{
    candidateId: string;
    candidateName: string;
    subjectCombination: string;
    firstChoice: string;
    reason: string;
    conflictType: string;
  }> = [];

  // Sort sessions chronologically
  const sortedSessions = [...sessions].sort(
    (a, b) => a.examDate.localeCompare(b.examDate) || a.startTime.localeCompare(b.startTime)
  );

  // Sort halls by capacity (largest first)
  const sortedHalls = [...halls].sort((a, b) => b.capacity - a.capacity);

  // Build day capacity map
  const dayMap = new Map<string, DayCapacity>();
  for (const session of sortedSessions) {
    if (!dayMap.has(session.examDate)) {
      dayMap.set(session.examDate, {
        date: session.examDate,
        totalCapacity: 0,
        totalFilled: 0,
        slots: [],
      });
    }
    const day = dayMap.get(session.examDate)!;
    for (const hall of sortedHalls) {
      const effectiveCapacity = rules.maxCandidatesPerHall
        ? Math.min(hall.capacity, rules.maxCandidatesPerHall)
        : hall.capacity;
      day.slots.push({
        sessionId: session.id,
        hallId: hall.id,
        capacity: effectiveCapacity,
        filled: 0,
      });
      day.totalCapacity += effectiveCapacity;
    }
  }

  // Track per-candidate daily session assignments (enforce one session per day)
  const candidateDaySessions = new Map<string, Set<string>>(); // candidateId → Set<examDate>

  // Track assignments per (sessionId, hallId) for conflict detection
  const assignmentsByKey = new Map<string, AssignmentDraft[]>(); // "sessionId:hallId" → assignments

  // Process candidates in priority order
  for (const pc of sortedCandidates) {
    const candidate = pc.candidate;
    let placed = false;

    // Check daily session restriction
    const assignedDays = candidateDaySessions.get(candidate.id) ?? new Set();

    // Try each day in order
    for (const [, day] of dayMap) {
      if (placed) break;

      // Check if candidate already has a session on this day
      if (assignedDays.has(day.date)) continue;

      // Try each slot in this day
      for (const slot of day.slots) {
        if (slot.filled >= slot.capacity) continue;

        // Check hall reuse rules
        if (!rules.allowHallReuse) {
          // Check if this hall was already used on this day by any candidate
          const hallUsedOnDay = day.slots.some(
            (s) => s.hallId === slot.hallId && s.filled > 0 && s.sessionId !== slot.sessionId
          );
          if (hallUsedOnDay && !rules.allowSameDayHallReuse) continue;
        }

        // Place candidate
        const seatNum = generateSeatNumber(
          sortedHalls.find((h) => h.id === slot.hallId)?.name ?? 'Hall',
          slot.filled,
          rules
        );

        const assignment: AssignmentDraft = {
          candidateId: candidate.id,
          sessionId: slot.sessionId,
          hallId: slot.hallId,
          seatNumber: seatNum,
          examDate: day.date,
        };

        assignments.push(assignment);
        slot.filled++;
        day.totalFilled++;
        placed = true;

        // Track daily session
        assignedDays.add(day.date);
        candidateDaySessions.set(candidate.id, assignedDays);

        // Track for conflict detection
        const key = `${slot.sessionId}:${slot.hallId}`;
        const list = assignmentsByKey.get(key) ?? [];
        list.push(assignment);
        assignmentsByKey.set(key, list);

        break;
      }
    }

    if (!placed) {
      // Candidate couldn't be placed - add to overflow
      overflow.push(candidate);

      // Determine reason for needs attention
      let reason = 'No available capacity';
      let conflictType = ConflictType.CAPACITY_EXCEEDED;

      // Check if it's because all days are full
      const allDaysFull = [...dayMap.values()].every((d) => d.totalFilled >= d.totalCapacity);
      if (allDaysFull) {
        reason = 'All sessions at full capacity';
        conflictType = ConflictType.CAPACITY_EXCEEDED;
      }

      // Check if candidate has sessions on all available days
      const availableDays = sortedSessions.map((s) => s.examDate);
      const candidateDays = [...(candidateDaySessions.get(candidate.id) ?? [])];
      const allDaysUsed = availableDays.every((d) => candidateDays.includes(d));
      if (allDaysUsed) {
        reason = 'Candidate already assigned to all available days';
        conflictType = ConflictType.DAILY_SESSION_LIMIT;
      }

      needsAttention.push({
        candidateId: candidate.id,
        candidateName: candidate.name,
        subjectCombination: displaySubjectCombination(pc.normalizedCombination),
        firstChoice: pc.firstChoice || 'Unknown',
        reason,
        conflictType,
      });
    }
  }

  // Detect conflicts: same candidate in multiple sessions on same day
  const candidateSessions = new Map<string, Array<{ sessionId: string; examDate: string; hallId: string; seatNumber: string }>>();
  for (const a of assignments) {
    const list = candidateSessions.get(a.candidateId) ?? [];
    list.push({ sessionId: a.sessionId, examDate: a.examDate, hallId: a.hallId, seatNumber: a.seatNumber });
    candidateSessions.set(a.candidateId, list);
  }

  for (const [candidateId, sessions] of candidateSessions) {
    const daySessionMap = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const list = daySessionMap.get(s.examDate) ?? [];
      list.push(s);
      daySessionMap.set(s.examDate, list);
    }
    for (const [, daySessions] of daySessionMap) {
      if (daySessions.length > 1) {
        // This is a conflict - candidate assigned to multiple sessions on same day
        for (const s of daySessions) {
          conflicts.push({
            candidateId,
            conflictType: ConflictType.DAILY_SESSION_LIMIT,
            description: `Candidate assigned to ${daySessions.length} sessions on ${s.examDate}`,
            assignedSessionId: s.sessionId,
            assignedHallId: s.hallId,
            assignedExamDate: s.examDate,
            assignedSeatNumber: s.seatNumber,
          });
        }
      }
    }
  }

  // Build day schedule output
  const dayOutput = buildDayOutput(sortedSessions, sortedHalls, assignments);

  return {
    assignments,
    conflicts,
    overflow,
    needsAttention,
    days: dayOutput,
    examPriorityOrder: [],
    firstChoicePriority: {},
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function generateSeatNumber(hallName: string, filledCount: number, rules: SchedulingRules): string {
  if (rules.seatSpacingEnabled && rules.seatSpacingGap > 0) {
    const spacedIndex = filledCount * (rules.seatSpacingGap + 1);
    return seatLabel(hallName, spacedIndex + 1);
  }
  return seatLabel(hallName, filledCount + 1);
}

function buildDayOutput(
  sessions: Session[],
  halls: Hall[],
  assignments: AssignmentDraft[]
): PrioritySchedulingResult['days'] {
  const sessionMap = new Map(sessions.map((s) => [s.id, s]));
  const hallMap = new Map(halls.map((h) => [h.id, h]));

  const days = new Map<string, {
    dayNumber: number;
    date: string;
    sessions: Array<{
      session: Session;
      halls: Array<{ hall: Hall; seatCount: number; capacity: number }>;
      totalAssigned: number;
    }>;
    totalAssigned: number;
  }>();

  for (const a of assignments) {
    const session = sessionMap.get(a.sessionId);
    const hall = hallMap.get(a.hallId);
    if (!session || !hall) continue;

    if (!days.has(a.examDate)) {
      days.set(a.examDate, {
        dayNumber: days.size + 1,
        date: a.examDate,
        sessions: [],
        totalAssigned: 0,
      });
    }
    const day = days.get(a.examDate)!;
    day.totalAssigned++;

    let sessEntry = day.sessions.find((s) => s.session.id === a.sessionId);
    if (!sessEntry) {
      sessEntry = { session, halls: [], totalAssigned: 0 };
      day.sessions.push(sessEntry);
    }
    sessEntry.totalAssigned++;

    let hallEntry = sessEntry.halls.find((h) => h.hall.id === a.hallId);
    if (!hallEntry) {
      hallEntry = { hall, seatCount: 0, capacity: hall.capacity };
      sessEntry.halls.push(hallEntry);
    }
    hallEntry.seatCount++;
  }

  return [...days.values()];
}

// ─── Data Loaders ──────────────────────────────────────────────────────────

async function loadAllCandidates(repo: Repository<Candidate>): Promise<Candidate[]> {
  const CHUNK = 5000;
  let all: Candidate[] = [];
  let offset = 0;
  while (true) {
    const batch = await repo.find({ skip: offset, take: CHUNK });
    if (batch.length === 0) break;
    all = all.concat(batch);
    if (batch.length < CHUNK) break;
    offset += CHUNK;
  }
  return all;
}

async function loadActiveHalls(repo: Repository<Hall>): Promise<Hall[]> {
  const halls = await repo.find();
  return halls.filter((h) => h.status === 'active');
}

async function loadSessionsByIds(repo: Repository<Session>, ids: string[]): Promise<Session[]> {
  if (ids.length === 0) return repo.find();
  const CHUNK = 5000;
  let all: Session[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const batch = await repo.find({ where: chunk.map((id) => ({ id })) });
    all = all.concat(batch);
  }
  return all;
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Run priority-aware scheduling for a given config.
 * This is the main entry point for the scheduling engine.
 */
export async function runPriorityScheduling(
  configId: string | null,
  sessionIds: string[],
  userId: string | null
): Promise<{
  run: SchedulingRun;
  result: PrioritySchedulingResult;
}> {
  const ds = AppDataSource;
  const configRepo = ds.getRepository(SchedulingConfig);
  const candidateRepo = ds.getRepository(Candidate);
  const hallRepo = ds.getRepository(Hall);
  const sessionRepo = ds.getRepository(Session);
  const groupRepo = ds.getRepository(CareerGroup);
  const runRepo = ds.getRepository(SchedulingRun);
  const assignmentRepo = ds.getRepository(CandidateAssignment);
  const conflictRepo = ds.getRepository(ScheduleConflict);
  const rescheduleRepo = ds.getRepository(ReschedulingEntry);

  // Load config
  let config: SchedulingConfig | null = null;
  if (configId) {
    config = await configRepo.findOne({ where: { id: configId } });
  } else {
    config = await configRepo.findOne({ where: { isActive: true } });
  }
  const rules = config?.rules ?? DEFAULT_SCHEDULING_RULES;
  const examPriorityOrder = config?.examPriorityOrder ?? null;
  const firstChoicePriority = config?.firstChoicePriority ?? null;
  const tieBreaker = config?.tieBreaker ?? null;

  // Load data
  const allCandidates = await loadAllCandidates(candidateRepo);
  const halls = await loadActiveHalls(hallRepo);
  const sessions = await loadSessionsByIds(sessionRepo, sessionIds);
  const groups = await groupRepo.find();
  const groupMap = new Map(groups.map((g) => [g.id, g]));

  // Filter sessions by rules (available dates, sessions per day)
  let availableSessions = filterSessionsByRules(sessions, rules);

  // Build priority candidate list
  const priorityCandidates: PriorityCandidate[] = [];
  for (const candidate of allCandidates) {
    let subjects: string[] = [];
    if (candidate.jambSubjects && candidate.jambSubjects.length > 0) {
      subjects = candidate.jambSubjects;
    } else if (candidate.careerGroupId) {
      const group = groupMap.get(candidate.careerGroupId);
      if (group) subjects = group.subjects || [];
    }
    if (subjects.length === 0) continue;

    // Exclude already-scheduled candidates
    if (candidate.status === CandidateStatus.SCHEDULED || candidate.status === CandidateStatus.COMPLETED) {
      continue;
    }

    const normalizedCombination = normalizeSubjectCombination(subjects);
    priorityCandidates.push({
      candidate,
      normalizedCombination,
      firstChoice: candidate.firstChoice || 'Unknown',
    });
  }

  // Sort by priority
  const sorted = sortCandidatesByPriority(priorityCandidates, examPriorityOrder, firstChoicePriority, tieBreaker);

  // Create scheduling run record
  const run = runRepo.create({
    id: genUuid(),
    subjectCombination: 'priority-based',
    careerGroupId: null,
    candidateCount: priorityCandidates.length,
    status: SchedulingRunStatus.GENERATING,
    configUsed: {
      rules,
      examPriorityOrder,
      firstChoicePriority,
      tieBreaker,
    } as unknown as Record<string, unknown>,
    sessionIds: availableSessions.map((s) => s.id),
    hallIds: halls.map((h) => h.id),
    generatedBy: userId,
    startedAt: new Date(),
  });
  await runRepo.save(run);

  // Perform scheduling
  const result = performPriorityScheduling(sorted, availableSessions, halls, rules);

  // Persist assignments
  if (result.assignments.length > 0) {
    const INSERT_BATCH = 5000;
    for (let i = 0; i < result.assignments.length; i += INSERT_BATCH) {
      const batch = result.assignments.slice(i, i + INSERT_BATCH);
      const rows: string[] = [];
      const params: unknown[] = [];
      let pi = 1;
      for (const a of batch) {
        rows.push(`($${pi}, $${pi + 1}, $${pi + 2}, $${pi + 3}, $${pi + 4}, $${pi + 5})`);
        params.push(`${a.candidateId}:${a.sessionId}`, a.candidateId, a.sessionId, a.hallId, a.seatNumber, new Date());
        pi += 6;
      }
      await ds.query(
        `INSERT INTO candidate_assignments (id, candidate_id, session_id, hall_id, seat_number, assigned_at)
         VALUES ${rows.join(',')} ON CONFLICT DO NOTHING`,
        params
      );
    }
  }

  // Update candidate statuses
  const sessionById = new Map(availableSessions.map((s) => [s.id, s]));
  const assignmentByCandidate = new Map(result.assignments.map((a) => [a.candidateId, a]));

  for (const pc of sorted) {
    const assignment = assignmentByCandidate.get(pc.candidate.id);
    if (assignment) {
      const session = sessionById.get(assignment.sessionId);
      await ds.query(
        `UPDATE candidates SET
          status = $1,
          assigned_hall_id = $2,
          assigned_seat_number = $3,
          assigned_session_id = $4,
          assigned_exam_date = $5
        WHERE id = $6`,
        [CandidateStatus.SCHEDULED, assignment.hallId, assignment.seatNumber, assignment.sessionId, assignment.examDate, pc.candidate.id]
      );
    } else {
      await ds.query(
        `UPDATE candidates SET status = $1 WHERE id = $2`,
        [CandidateStatus.UNSCHEDULED, pc.candidate.id]
      );
    }
  }

  // Persist conflicts
  if (result.conflicts.length > 0) {
    for (const c of result.conflicts) {
      const conflict = conflictRepo.create({
        id: genUuid(),
        schedulingRunId: run.id,
        candidateId: c.candidateId,
        subjectCombination: null,
        firstChoice: null,
        conflictType: c.conflictType,
        description: c.description,
        assignedSessionId: c.assignedSessionId,
        assignedHallId: c.assignedHallId,
        assignedExamDate: c.assignedExamDate,
        assignedSeatNumber: c.assignedSeatNumber,
        status: ConflictStatus.OPEN,
      });
      await conflictRepo.save(conflict);
    }
  }

  // Persist overflow as rescheduling entries
  const rescheduleEntries: ReschedulingEntry[] = [];
  for (const candidate of result.overflow) {
    const entry = rescheduleRepo.create({
      id: genUuid(),
      candidateId: candidate.id,
      schedulingRunId: run.id,
      subjectCombination: 'priority-based',
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
  run.conflictCount = result.conflicts.length;
  run.dayCount = result.days.length;
  run.status = result.overflow.length > 0 ? SchedulingRunStatus.PARTIAL : SchedulingRunStatus.COMPLETED;
  run.completedAt = new Date();
  run.summary = {
    scheduled: result.assignments.length,
    overflow: result.overflow.length,
    conflicts: result.conflicts.length,
    days: result.days.length,
    hallsUsed: new Set(result.assignments.map((a) => a.hallId)).size,
    needsAttention: result.needsAttention.length,
  };
  await runRepo.save(run);

  result.examPriorityOrder = examPriorityOrder ?? [];
  result.firstChoicePriority = firstChoicePriority ?? {};

  return { run, result };
}

function filterSessionsByRules(sessions: Session[], rules: SchedulingRules): Session[] {
  let filtered = [...sessions];
  if (rules.availableDates && rules.availableDates.length > 0) {
    filtered = filtered.filter((s) => rules.availableDates!.includes(s.examDate));
  }
  filtered.sort((a, b) => a.examDate.localeCompare(b.examDate) || a.startTime.localeCompare(b.startTime));
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

// ─── Publishing ────────────────────────────────────────────────────────────

/**
 * Publish a scheduling run as an immutable historical record.
 * Conflicts do NOT prevent publishing.
 */
export async function publishSchedule(
  runId: string,
  name: string,
  description: string | null,
  userId: string | null
): Promise<PublishResult> {
  const ds = AppDataSource;
  const runRepo = ds.getRepository(SchedulingRun);
  const historyRepo = ds.getRepository(ScheduleHistory);

  const run = await runRepo.findOne({ where: { id: runId } });
  if (!run) throw AppError.notFound('Scheduling run not found');
  if (run.isPublished) throw AppError.badRequest('This schedule has already been published');

  // Capture snapshot of current assignments
  const assignments = await ds.query(
    `SELECT a.candidate_id, a.session_id, a.hall_id, a.seat_number, s.exam_date, c.name as candidate_name
     FROM candidate_assignments a
     JOIN sessions s ON s.id = a.session_id
     JOIN candidates c ON c.id = a.candidate_id
     WHERE a.session_id = ANY($1::varchar[])`,
    [run.sessionIds ?? []]
  );

  const snapshot = { assignments, generatedAt: run.completedAt, configUsed: run.configUsed };

  const history = historyRepo.create({
    id: genUuid(),
    schedulingRunId: run.id,
    name,
    description: description ?? null,
    subjectCombination: run.subjectCombination,
    candidateCount: run.candidateCount,
    scheduledCount: run.scheduledCount,
    overflowCount: run.overflowCount,
    conflictCount: run.conflictCount,
    dayCount: run.dayCount,
    snapshot,
    configSnapshot: run.configUsed,
    publishedBy: userId,
    publishedAt: new Date(),
  });
  await historyRepo.save(history);

  // Mark run as published
  run.isPublished = true;
  run.publishedAt = new Date();
  run.publishedBy = userId;
  run.status = SchedulingRunStatus.PUBLISHED;
  await runRepo.save(run);

  await logActivity({
    action: 'schedule.published',
    userId,
    entityType: 'schedule_history',
    entityId: history.id,
    details: { name, runId, scheduledCount: run.scheduledCount },
  });

  return {
    historyId: history.id,
    runId: run.id,
    name,
    publishedAt: history.publishedAt,
  };
}

/**
 * Duplicate an existing scheduling run.
 * Admin chooses whether to keep assignments or recalculate.
 */
export async function duplicateSchedule(
  sourceRunId: string,
  mode: 'keep_assignments' | 'recalculate',
  newName: string | undefined,
  userId: string | null
): Promise<{ newRun: SchedulingRun }> {
  const ds = AppDataSource;
  const runRepo = ds.getRepository(SchedulingRun);

  const sourceRun = await runRepo.findOne({ where: { id: sourceRunId } });
  if (!sourceRun) throw AppError.notFound('Source scheduling run not found');

  if (mode === 'keep_assignments') {
    // Create a new run with the same configuration, copy assignments
    const newRun = runRepo.create({
      id: genUuid(),
      subjectCombination: sourceRun.subjectCombination,
      careerGroupId: sourceRun.careerGroupId,
      candidateCount: sourceRun.candidateCount,
      scheduledCount: sourceRun.scheduledCount,
      overflowCount: sourceRun.overflowCount,
      dayCount: sourceRun.dayCount,
      status: SchedulingRunStatus.COMPLETED,
      configUsed: sourceRun.configUsed,
      summary: sourceRun.summary,
      sessionIds: sourceRun.sessionIds,
      hallIds: sourceRun.hallIds,
      generatedBy: userId,
      startedAt: new Date(),
      completedAt: new Date(),
    });
    await runRepo.save(newRun);

    // Copy assignments from source run
    if (sourceRun.sessionIds && sourceRun.sessionIds.length > 0) {
      const assignments = await ds.query(
        `SELECT candidate_id, session_id, hall_id, seat_number
         FROM candidate_assignments
         WHERE session_id = ANY($1::varchar[])`,
        [sourceRun.sessionIds]
      );

      if (assignments.length > 0) {
        const INSERT_BATCH = 5000;
        for (let i = 0; i < assignments.length; i += INSERT_BATCH) {
          const batch = assignments.slice(i, i + INSERT_BATCH);
          const rows: string[] = [];
          const params: unknown[] = [];
          let pi = 1;
          for (const a of batch) {
            rows.push(`($${pi}, $${pi + 1}, $${pi + 2}, $${pi + 3}, $${pi + 4}, $${pi + 5})`);
            params.push(`${a.candidate_id}:${a.session_id}`, a.candidate_id, a.session_id, a.hall_id, a.seat_number, new Date());
            pi += 6;
          }
          await ds.query(
            `INSERT INTO candidate_assignments (id, candidate_id, session_id, hall_id, seat_number, assigned_at)
             VALUES ${rows.join(',')} ON CONFLICT DO NOTHING`,
            params
          );
        }
      }
    }

    await logActivity({
      action: 'schedule.duplicated',
      userId,
      entityType: 'scheduling_run',
      entityId: newRun.id,
      details: { sourceRunId, mode: 'keep_assignments', name: newName },
    });

    return { newRun };
  } else {
    // Recalculate: create a new run and re-run the scheduling engine
    const newRun = runRepo.create({
      id: genUuid(),
      subjectCombination: sourceRun.subjectCombination,
      careerGroupId: sourceRun.careerGroupId,
      candidateCount: 0,
      scheduledCount: 0,
      overflowCount: 0,
      dayCount: 0,
      status: SchedulingRunStatus.GENERATING,
      configUsed: sourceRun.configUsed,
      sessionIds: sourceRun.sessionIds,
      hallIds: sourceRun.hallIds,
      generatedBy: userId,
      startedAt: new Date(),
    });
    await runRepo.save(newRun);

    // Re-run scheduling with same config
    const result = await runPriorityScheduling(
      null, // Use active config
      sourceRun.sessionIds ?? [],
      userId
    );

    await logActivity({
      action: 'schedule.duplicated',
      userId,
      entityType: 'scheduling_run',
      entityId: newRun.id,
      details: { sourceRunId, mode: 'recalculate', name: newName, scheduledCount: result.result.assignments.length },
    });

    return { newRun: result.run };
  }
}
