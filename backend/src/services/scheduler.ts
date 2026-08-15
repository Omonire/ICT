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
  // "Hall A" -> "A"
  const single = words[words.length - 1];
  if (single.length === 1) return single.toUpperCase();
  return words.map((w) => w[0].toUpperCase()).join('');
}

export function seatLabel(hallName: string, n: number): string {
  return `${hallCode(hallName)}-${String(n).padStart(3, '0')}`;
}

/**
 * ExamFlow scheduling engine.
 *
 * Algorithm:
 *  1. Candidates are grouped by career line (largest group first so the densest
 *     groups get the most contiguous seats).
 *  2. Sessions are processed in chronological order (exam_date, start_time).
 *  3. For each candidate, the first session with spare hall capacity is chosen.
 *     Within that session the first hall with a free seat is used (halls are
 *     ordered by capacity, descending, so seats pack tightly).
 *  4. A candidate that no session/hall can absorb is reported as overflow and
 *     left unassigned — it is never dropped silently.
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
      a.examDate.localeCompare(b.examDate) || a.startTime.localeCompare(b.startTime)
  );

  const sortedCandidates = [...candidates].sort((a, b) =>
    a.id.localeCompare(b.id)
  );

  const used = new Map<string, Map<string, number>>();
  const seats = new Set<string>();
  const seenCandidates = new Set<string>();
  const assignmentMap = new Map<string, AssignmentDraft>();

  for (const a of existing) {
    const perHall = used.get(a.sessionId) ?? new Map<string, number>();
    perHall.set(a.hallId, (perHall.get(a.hallId) ?? 0) + 1);
    used.set(a.sessionId, perHall);
    seats.add(`${a.sessionId}:${a.hallId}:${a.seatNumber}`);
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

  const assignments: AssignmentDraft[] = [];
  const unassigned: Candidate[] = [];

  // Group candidates by career line so career groups fill capacity together.
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const byGroup = new Map<string, Candidate[]>();
  for (const c of sortedCandidates) {
    if (assignmentMap.has(c.id)) continue;
    const bucket = byGroup.get(c.careerGroupId) ?? [];
    bucket.push(c);
    byGroup.set(c.careerGroupId, bucket);
  }
  const orderedGroups = [...byGroup.entries()].sort((a, b) => {
    const size = b[1].length - a[1].length;
    return size !== 0 ? size : (groupName.get(a[0]) ?? '').localeCompare(groupName.get(b[0]) ?? '');
  });

  outer: for (const [, bucket] of orderedGroups) {
    for (const candidate of bucket) {
      for (const session of sortedSessions) {
        const perHall = used.get(session.id) ?? new Map<string, number>();
        for (const hall of activeHalls) {
          const occupied = perHall.get(hall.id) ?? 0;
          if (occupied >= hall.capacity) continue;
          const seatNumber = seatLabel(hall.name, occupied + 1);
          const key = `${session.id}:${hall.id}:${seatNumber}`;
          if (seats.has(key)) continue;
          perHall.set(hall.id, occupied + 1);
          used.set(session.id, perHall);
          seats.add(key);
          assignments.push({
            candidateId: candidate.id,
            sessionId: session.id,
            hallId: hall.id,
            seatNumber,
          });
          continue outer;
        }
      }
      unassigned.push(candidate);
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
      (c) => c.careerGroupId === g.id && assignedIds.has(c.id)
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
 * Full generate + persist transaction.
 */
export async function generateSchedule(opts: GenerateOptions): Promise<PlanResult> {
  const ds = AppDataSource;
  const sessionRepo = ds.getRepository(Session);
  const hallRepo = ds.getRepository(Hall);
  const candidateRepo = ds.getRepository(Candidate);
  const assignmentRepo = ds.getRepository(CandidateAssignment);
  const groupRepo = ds.getRepository(CareerGroup);

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

  const result = buildPlan({
    sessions,
    halls,
    candidates: available,
    groups,
    existing,
  });

  if (opts.strict && result.unassigned.length > 0) {
    throw new Error(
      `Schedule overflow: ${result.unassigned.length} candidate(s) could not be placed within the selected sessions.`
    );
  }

  const qr = ds.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    await qr.manager.delete(CandidateAssignment, { sessionId: In(sessionIds) });

    for (const a of result.assignments) {
      await qr.manager.save(
        qr.manager.create(CandidateAssignment, {
          id: a.candidateId + ':' + a.sessionId,
          candidateId: a.candidateId,
          sessionId: a.sessionId,
          hallId: a.hallId,
          seatNumber: a.seatNumber,
        })
      );
    }

    const candidateById = new Map(candidates.map((c) => [c.id, c]));
    const sessionById = new Map(sessions.map((s) => [s.id, s]));
    const hallById = new Map(halls.map((h) => [h.id, h]));

    for (const c of candidates) {
      const a = result.assignments.find((x) => x.candidateId === c.id);
      c.status = a ? CandidateStatus.SCHEDULED : CandidateStatus.UNSCHEDULED;
      c.assignedHallId = a?.hallId ?? null;
      c.assignedSeatNumber = a?.seatNumber ?? null;
      c.assignedSessionId = a?.sessionId ?? null;
      c.assignedExamDate = a ? sessionById.get(a.sessionId)!.examDate : null;
      await qr.manager.save(c);
    }

    // Refresh seat inventory status for display purposes (latest session only).
    const allHalls = await qr.manager.find(Hall);
    for (const hall of allHalls) {
      await qr.manager.update(Seat, { hallId: hall.id }, { status: 'available', candidateId: null });
    }
    const latestByHall = new Map<string, { session: Session; seats: string[] }>();
    for (const a of result.assignments) {
      const cur = latestByHall.get(a.hallId);
      const session = sessionById.get(a.sessionId)!;
      if (!cur || session.examDate > cur.session.examDate) {
        latestByHall.set(a.hallId, { session, seats: [a.seatNumber] });
      } else if (session.examDate === cur.session.examDate) {
        cur.seats.push(a.seatNumber);
      }
    }
    for (const [hallId, { seats }] of latestByHall) {
      const seatRows = await qr.manager.find(Seat, {
        where: { hallId, seatNumber: In(seats) },
      });
      for (const seat of seatRows) {
        const assign = result.assignments.find(
          (a) => a.hallId === hallId && a.seatNumber === seat.seatNumber
        );
        seat.status = 'occupied';
        seat.candidateId = assign?.candidateId ?? null;
        await qr.manager.save(seat);
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
  halls: Hall[]
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
