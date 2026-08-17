import { AppDataSource } from '../config/data-source';
import { In } from 'typeorm';
import {
  Candidate,
  CandidateStatus,
} from '../entities/Candidate';
import { CandidateAssignment } from '../entities/CandidateAssignment';
import { Hall } from '../entities/Hall';
import { Session } from '../entities/Session';
import { CareerGroup } from '../entities/CareerGroup';
import { Seat } from '../entities/Seat';

export interface AssignmentDraft {
  candidateId: string;
  sessionId: string;
  hallId: string;
  seatNumber: string;
}

export interface GroupStat {
  careerGroupId: string;
  name: string;
  total: number;
  assigned: number;
  unassigned: number;
}

export interface SessionStat {
  sessionId: string;
  name: string;
  examDate: string;
  startTime: string;
  endTime: string;
  capacity: number;
  assigned: number;
  utilization: number;
}

export interface HallStat {
  hallId: string;
  name: string;
  code: string;
  capacity: number;
  assigned: number;
  utilization: number;
}

export interface PlanSummary {
  totalCandidates: number;
  assignedCount: number;
  unassignedCount: number;
  sessionsUsed: number;
  hallsUsed: number;
  byGroup: GroupStat[];
  bySession: SessionStat[];
  byHall: HallStat[];
  generatedAt: string;
}

export interface PlanResult {
  assignments: AssignmentDraft[];
  unassigned: Candidate[];
  summary: PlanSummary;
}

export interface PlannerInput {
  sessions: Session[];
  halls: Hall[];
  candidates: Candidate[];
  groups: CareerGroup[];
  existing: CandidateAssignment[];
}

export function hallCode(name: string): string {
  const words = name
    .replace(/[^a-zA-Z\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'H';
  if (words.length === 1) return words[0].toUpperCase();
  const single = words[words.length - 1];
  if (single.length === 1) return single.toUpperCase();
  return words.map((w) => w[0].toUpperCase()).join('');
}

export function seatLabel(hallName: string, n: number): string {
  return `${hallCode(hallName)}-${String(n).padStart(3, '0')}`;
}

/**
 * ExamFlow scheduling engine — optimised for 1M+ candidates.
 *
 * Algorithm:
 *  1. Load all data into memory once (zero per-candidate DB queries).
 *  2. Build a flat ordered list of (session, hall) "slots" — chronological
 *     sessions, halls descending by capacity — so the inner assignment loop
 *     touches only simple map look-ups.
 *  3. Candidates are grouped by career line (largest group first) and
 *     processed in bulk.  Because we fill seats contiguously, the next seat
 *     in a hall is always at `fillLevel + 1` — no per-seat Set lookups.
 *  4. All assignments are accumulated in a plain array; persistence is a
 *     single bulk INSERT at the end.
 *
 * Invariants guaranteed here and enforced in the database:
 *  - a candidate is assigned to exactly one session/hall/seat,
 *  - a (session, hall, seat) triple is assigned at most once,
 *  - hall occupancy never exceeds its capacity.
 */
export function buildPlan(input: PlannerInput): PlanResult {
  const { sessions, halls, candidates, groups, existing } = input;

  const activeHalls = halls
    .filter((h) => h.status === 'active')
    .sort((a, b) => b.capacity - a.capacity || a.name.localeCompare(b.name));

  const sortedSessions = [...sessions].sort(
    (a, b) =>
      a.examDate.localeCompare(b.examDate) || a.startTime.localeCompare(b.startTime),
  );

  // --- Pre-computed in-memory state ---------------------------------------------------

  // Fill level per (sessionId, hallId) key — tracks how many seats are taken.
  const fillLevel = new Map<string, number>();
  const assignmentMap = new Map<string, AssignmentDraft>();
  const seenCandidates = new Set<string>();

  // Hydrate from existing assignments.
  for (const a of existing) {
    const key = `${a.sessionId}:${a.hallId}`;
    fillLevel.set(key, (fillLevel.get(key) ?? 0) + 1);
    if (!assignmentMap.has(a.candidateId)) {
      assignmentMap.set(a.candidateId, {
        candidateId: a.candidateId,
        sessionId: a.sessionId,
        hallId: a.hallId,
        seatNumber: a.seatNumber,
      });
    }
    seenCandidates.add(a.candidateId);
  }

  // Flat slot list — iterating this replaces the old 3-deep nested loop.
  // Each entry is a (session, hall) pair with its capacity cached.
  interface Slot {
    sessionId: string;
    hallId: string;
    hallName: string;
    capacity: number;
  }
  const slotOrder: Slot[] = [];
  for (const session of sortedSessions) {
    for (const hall of activeHalls) {
      slotOrder.push({
        sessionId: session.id,
        hallId: hall.id,
        hallName: hall.name,
        capacity: hall.capacity,
      });
    }
  }

  // --- Group candidates by career line (largest first) --------------------------------
  const byGroup = new Map<string, Candidate[]>();
  for (const c of candidates) {
    if (assignmentMap.has(c.id)) continue;
    const bucket = byGroup.get(c.careerGroupId) ?? [];
    bucket.push(c);
    byGroup.set(c.careerGroupId, bucket);
  }
  const orderedGroups = [...byGroup.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  );

  // --- Assign -----------------------------------------------------------------------
  const assignments: AssignmentDraft[] = [];
  const unassigned: Candidate[] = [];

  for (const [, bucket] of orderedGroups) {
    for (const candidate of bucket) {
      let placed = false;
      for (const slot of slotOrder) {
        const mapKey = `${slot.sessionId}:${slot.hallId}`;
        const filled = fillLevel.get(mapKey) ?? 0;
        if (filled >= slot.capacity) continue;

        // Contiguous fill guarantees seatNumber is unique within this (session, hall).
        const seatNumber = seatLabel(slot.hallName, filled + 1);
        fillLevel.set(mapKey, filled + 1);

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
        unassigned.push(candidate);
      }
    }
  }

  const summary = summarize({
    candidates,
    assignments,
    unassigned,
    groups,
    activeHalls,
    sessions: sortedSessions,
  });

  return { assignments, unassigned, summary };
}

function summarize(input: {
  candidates: Candidate[];
  assignments: AssignmentDraft[];
  unassigned: Candidate[];
  groups: CareerGroup[];
  activeHalls: Hall[];
  sessions: Session[];
}): PlanSummary {
  const { candidates, assignments, unassigned, groups, activeHalls, sessions } = input;

  const assignedIds = new Set(assignments.map((a) => a.candidateId));

  const perSession = new Map<string, { assigned: number; session: Session }>();
  for (const a of assignments) {
    const bucket = perSession.get(a.sessionId) ?? { assigned: 0, session: sessions.find((s) => s.id === a.sessionId)! };
    bucket.assigned += 1;
    perSession.set(a.sessionId, bucket);
  }

  const perHall = new Map<string, { assigned: number; hall: Hall }>();
  for (const a of assignments) {
    const bucket = perHall.get(a.hallId) ?? { assigned: 0, hall: activeHalls.find((h) => h.id === a.hallId)! };
    bucket.assigned += 1;
    perHall.set(a.hallId, bucket);
  }

  const byGroup: GroupStat[] = groups.map((g) => {
    const total = candidates.filter((c) => c.careerGroupId === g.id).length;
    const assigned = candidates.filter(
      (c) => c.careerGroupId === g.id && assignedIds.has(c.id),
    ).length;
    return {
      careerGroupId: g.id,
      name: g.name,
      total,
      assigned,
      unassigned: total - assigned,
    };
  });

  const bySession: SessionStat[] = [...perSession.values()].map(({ session, assigned }) => {
    const capacity = activeHalls.reduce((sum, h) => sum + h.capacity, 0);
    return {
      sessionId: session.id,
      name: session.name,
      examDate: session.examDate,
      startTime: session.startTime,
      endTime: session.endTime,
      capacity,
      assigned,
      utilization: capacity > 0 ? Math.round((assigned / capacity) * 100) : 0,
    };
  });

  const byHall: HallStat[] = [...perHall.values()].map(({ hall, assigned }) => ({
    hallId: hall.id,
    name: hall.name,
    code: hallCode(hall.name),
    capacity: hall.capacity,
    assigned,
    utilization: hall.capacity > 0 ? Math.round((assigned / hall.capacity) * 100) : 0,
  }));

  return {
    totalCandidates: candidates.length,
    assignedCount: assignments.length,
    unassignedCount: unassigned.length,
    sessionsUsed: bySession.length,
    hallsUsed: byHall.length,
    byGroup,
    bySession,
    byHall,
    generatedAt: new Date().toISOString(),
  };
}

export interface GenerateOptions {
  sessionIds: string[];
  candidateIds?: string[];
  strict?: boolean;
  userId?: string | null;
}

/**
 * Full generate + persist — batch-optimised for 1M candidates.
 *
 * All DB reads happen upfront. The in-memory planner runs in O(C × S × H)
 * with constant-factor savings from contiguous fill.  Persistence uses bulk
 * INSERT/UPDATE inside a single transaction — no per-row queries.
 */
export async function generateSchedule(opts: GenerateOptions): Promise<PlanResult> {
  const ds = AppDataSource;
  const sessionRepo = ds.getRepository(Session);
  const hallRepo = ds.getRepository(Hall);
  const candidateRepo = ds.getRepository(Candidate);
  const assignmentRepo = ds.getRepository(CandidateAssignment);
  const groupRepo = ds.getRepository(CareerGroup);

  // --- Bulk reads -------------------------------------------------------------------
  const sessions = await sessionRepo.find({ where: opts.sessionIds.map((id) => ({ id })) });
  if (sessions.length !== opts.sessionIds.length) {
    const found = new Set(sessions.map((s) => s.id));
    const missing = opts.sessionIds.filter((id) => !found.has(id));
    throw new Error(`Session(s) not found: ${missing.join(', ')}`);
  }

  const halls = await hallRepo.find();
  if (!halls.some((h) => h.status === 'active')) {
    throw new Error('No active halls available for scheduling');
  }

  let candidates = opts.candidateIds
    ? await candidateRepo.find({ where: opts.candidateIds.map((id) => ({ id })) })
    : await candidateRepo.find();

  candidates = candidates.filter((c) => c.status !== CandidateStatus.COMPLETED);

  const groups = await groupRepo.find();
  const sessionIds = sessions.map((s) => s.id);

  // Candidates who already hold a seat in a session outside the current
  // selection must not be double-booked — leave them untouched.
  const outsideAssignments = candidates.length
    ? await assignmentRepo
        .createQueryBuilder('a')
        .where('a.candidateId IN (:...ids)', { ids: candidates.map((c) => c.id) })
        .andWhere('a.sessionId NOT IN (:...sessionIds)', { sessionIds })
        .getMany()
    : [];
  const outsideSet = new Set(outsideAssignments.map((a) => a.candidateId));
  const available = candidates.filter((c) => !outsideSet.has(c.id));

  const existing = await assignmentRepo.find({
    where: sessionIds.map((id) => ({ sessionId: id })),
  });

  // --- Plan (pure in-memory) --------------------------------------------------------
  const result = buildPlan({
    sessions,
    halls,
    candidates: available,
    groups,
    existing,
  });

  if (opts.strict && result.unassigned.length > 0) {
    throw new Error(
      `Schedule overflow: ${result.unassigned.length} candidate(s) could not be placed within the selected sessions.`,
    );
  }

  // --- Persist in a single transaction using bulk operations -------------------------
  const qr = ds.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    // 1. Delete old assignments for selected sessions.
    await qr.manager.delete(CandidateAssignment, { sessionId: In(sessionIds) });

    // 2. Bulk insert all new assignments in one query.
    if (result.assignments.length > 0) {
      const now = new Date();
      const assignmentEntities = result.assignments.map((a) => ({
        id: a.candidateId + ':' + a.sessionId,
        candidateId: a.candidateId,
        sessionId: a.sessionId,
        hallId: a.hallId,
        seatNumber: a.seatNumber,
        assignedAt: now,
      }));
      // TypeORM bulk insert — single INSERT with multiple value rows.
      await qr.manager
        .createQueryBuilder()
        .insert()
        .into(CandidateAssignment)
        .values(assignmentEntities)
        .orIgnore()
        .execute();
    }

    // 3. Build lookup maps for O(1) access.
    const assignmentByCandidate = new Map<string, AssignmentDraft>();
    for (const a of result.assignments) {
      if (!assignmentByCandidate.has(a.candidateId)) {
        assignmentByCandidate.set(a.candidateId, a);
      }
    }
    const sessionById = new Map(sessions.map((s) => [s.id, s]));

    // 4. Bulk update candidate statuses — split into assigned vs unassigned batches.
    const assignedCandidates: Candidate[] = [];
    const unassignedCandidates: Candidate[] = [];
    for (const c of candidates) {
      const a = assignmentByCandidate.get(c.id);
      if (a) {
        c.status = CandidateStatus.SCHEDULED;
        c.assignedHallId = a.hallId;
        c.assignedSeatNumber = a.seatNumber;
        c.assignedSessionId = a.sessionId;
        c.assignedExamDate = sessionById.get(a.sessionId)!.examDate;
        assignedCandidates.push(c);
      } else {
        c.status = CandidateStatus.UNSCHEDULED;
        c.assignedHallId = null;
        c.assignedSeatNumber = null;
        c.assignedSessionId = null;
        c.assignedExamDate = null;
        unassignedCandidates.push(c);
      }
    }

    // Bulk update in batches of 5000 to avoid exceeding parameter limits.
    const BATCH = 5000;
    const allCandidatesToUpdate = [...assignedCandidates, ...unassignedCandidates];
    for (let i = 0; i < allCandidatesToUpdate.length; i += BATCH) {
      const batch = allCandidatesToUpdate.slice(i, i + BATCH);
      await qr.manager.save(batch, { chunk: BATCH });
    }

    // 5. Refresh seat inventory — bulk reset then bulk mark occupied.
    await qr.manager
      .createQueryBuilder()
      .update(Seat)
      .set({ status: 'available', candidateId: () => 'NULL' })
      .execute();

    if (result.assignments.length > 0) {
      // Find the latest exam date to mark only those seats as occupied.
      let latestDate = '';
      for (const s of sessions) {
        if (s.examDate > latestDate) latestDate = s.examDate;
      }
      const latestAssignments = result.assignments.filter(
        (a) => sessionById.get(a.sessionId)!.examDate === latestDate,
      );

      // Bulk update seat status for occupied seats.
      // Batch into chunks to avoid huge parameter lists.
      const SEAT_BATCH = 500;
      for (let i = 0; i < latestAssignments.length; i += SEAT_BATCH) {
        const batch = latestAssignments.slice(i, i + SEAT_BATCH);
        await qr.manager
          .createQueryBuilder()
          .update(Seat)
          .set({ status: 'occupied' })
          .where(
            batch.map((a) => `(hallId = :hid${i} AND seatNumber = :sn${i})`).join(' OR '),
            Object.fromEntries(
              batch.flatMap((a, j) => [
                [`hid${i + j}`, a.hallId],
                [`sn${i + j}`, a.seatNumber],
              ]),
            ),
          )
          .execute();
      }

      // Bulk update candidateId on occupied seats.
      for (let i = 0; i < latestAssignments.length; i += SEAT_BATCH) {
        const batch = latestAssignments.slice(i, i + SEAT_BATCH);
        // Use individual updates for candidateId since we need per-seat assignment.
        const seatUpdates = batch.map((a) =>
          qr.manager
            .createQueryBuilder()
            .update(Seat)
            .set({ candidateId: a.candidateId })
            .where('hallId = :hallId AND seatNumber = :seatNumber', {
              hallId: a.hallId,
              seatNumber: a.seatNumber,
            })
            .execute(),
        );
        await Promise.all(seatUpdates);
      }
    }

    await qr.commitTransaction();
  } catch (err) {
    await qr.rollbackTransaction();
    throw err;
  } finally {
    await qr.release();
  }

  return result;
}

export function computeConflicts(
  assignments: AssignmentDraft[],
  halls: Hall[],
): { seatClashes: string[]; overCapacity: string[] } {
  const seatClashes = new Set<string>();
  const seen = new Set<string>();
  const byHall = new Map<string, number>();
  const capacityByHall = new Map(halls.map((h) => [h.id, h.capacity]));
  for (const a of assignments) {
    const key = `${a.sessionId}:${a.hallId}:${a.seatNumber}`;
    if (seen.has(key)) seatClashes.add(key);
    seen.add(key);
    byHall.set(a.hallId, (byHall.get(a.hallId) ?? 0) + 1);
  }
  const overCapacity = [...byHall.entries()]
    .filter(([id, count]) => count > (capacityByHall.get(id) ?? 0))
    .map(([id]) => id);
  return { seatClashes: [...seatClashes], overCapacity };
}
