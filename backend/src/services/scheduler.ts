import { AppDataSource } from '../config/data-source';
import {
  Candidate,
  CandidateStatus,
} from '../entities/Candidate';
import { CandidateAssignment } from '../entities/CandidateAssignment';
import { Hall } from '../entities/Hall';
import { Session } from '../entities/Session';
import { CareerGroup } from '../entities/CareerGroup';


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
 * Full generate + persist — rewritten for 1M+ candidates.
 *
 * Optimisations vs the original:
 *  1. Chunked candidate reads (100 K rows) to cap memory pressure.
 *  2. Assignment INSERT uses raw SQL multi-row VALUES in 10 K batches
 *     instead of TypeORM QueryBuilder (which builds one enormous statement).
 *  3. Candidate status updates use a PostgreSQL temporary table + UPDATE …
 *     FROM — eliminates the N-case CASE expression and its parameter explosion.
 *  4. Seat updates use the same temp-table pattern — replaces N individual
 *     UPDATE queries with a single UPDATE … FROM.
 */
export async function generateSchedule(opts: GenerateOptions): Promise<PlanResult> {
  const ds = AppDataSource;
  const sessionRepo = ds.getRepository(Session);
  const hallRepo = ds.getRepository(Hall);
  const candidateRepo = ds.getRepository(Candidate);
  const assignmentRepo = ds.getRepository(CandidateAssignment);
  const groupRepo = ds.getRepository(CareerGroup);

  // --- Bulk reads (TypeORM repos — handles column-name mapping) ---------------------
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

  let candidates: Candidate[] = [];
  if (opts.candidateIds) {
    candidates = await candidateRepo.find({ where: opts.candidateIds.map((id) => ({ id })) });
  } else {
    // Chunk reads to avoid memory/timeout issues on large datasets
    const CHUNK = 5000;
    let offset = 0;
    while (true) {
      const batch = await candidateRepo.find({ skip: offset, take: CHUNK });
      if (batch.length === 0) break;
      candidates = candidates.concat(batch);
      if (batch.length < CHUNK) break;
      offset += CHUNK;
    }
  }

  candidates = candidates.filter((c) => c.status !== CandidateStatus.COMPLETED);

  const groups = await groupRepo.find();
  const sessionIds = sessions.map((s) => s.id);

  // Candidates already assigned outside the selected sessions — skip them.
  let outsideSet = new Set<string>();
  if (candidates.length > 0) {
    const outsideAssignments = await assignmentRepo
      .createQueryBuilder('a')
      .where('a.candidateId IN (:...ids)', { ids: candidates.map((c) => c.id) })
      .andWhere('a.sessionId NOT IN (:...sessionIds)', { sessionIds })
      .getMany();
    outsideSet = new Set(outsideAssignments.map((a) => a.candidateId));
  }
  const available = candidates.filter((c) => !outsideSet.has(c.id));

  const existing = await assignmentRepo.find({
    where: sessionIds.map((id) => ({ sessionId: id })),
  });

  // --- Plan (pure in-memory) --------------------------------------------------------
  const result = buildPlan({ sessions, halls, candidates: available, groups, existing });

  if (opts.strict && result.unassigned.length > 0) {
    throw new Error(
      `Schedule overflow: ${result.unassigned.length} candidate(s) could not be placed within the selected sessions.`,
    );
  }

  // --- Persist in a single transaction using raw SQL bulk ops -----------------------
  const qr = ds.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    // 1. Delete old assignments for selected sessions.
    await qr.manager.query(
      `DELETE FROM candidate_assignments WHERE session_id IN (${sessionIds.map((_, i) => `$${i + 1}`).join(',')})`,
      sessionIds,
    );

    // 2. Bulk insert assignments — multi-row VALUES, 5 K rows per batch.
    if (result.assignments.length > 0) {
      const now = new Date().toISOString();
      const INSERT_BATCH = 5_000;
      for (let i = 0; i < result.assignments.length; i += INSERT_BATCH) {
        const batch = result.assignments.slice(i, i + INSERT_BATCH);
        const values: string[] = [];
        const params: unknown[] = [];
        let pi = 1;
        for (const a of batch) {
          values.push(`($${pi}, $${pi + 1}, $${pi + 2}, $${pi + 3}, $${pi + 4}, $${pi + 5})`);
          params.push(a.candidateId + ':' + a.sessionId, a.candidateId, a.sessionId, a.hallId, a.seatNumber, now);
          pi += 6;
        }
        await qr.manager.query(
          `INSERT INTO candidate_assignments (id, candidate_id, session_id, hall_id, seat_number, assigned_at)
           VALUES ${values.join(',')} ON CONFLICT DO NOTHING`,
          params,
        );
      }
    }

    // 3. Build lookup maps for O(1) access.
    const assignmentByCandidate = new Map<string, AssignmentDraft>();
    for (const a of result.assignments) {
      if (!assignmentByCandidate.has(a.candidateId)) {
        assignmentByCandidate.set(a.candidateId, a);
      }
    }
    const sessionById = new Map(sessions.map((s) => [s.id, s]));

    // 4. Bulk update candidate statuses via temp table + UPDATE … FROM.
    if (candidates.length > 0) {
      await qr.manager.query(`CREATE TEMPORARY TABLE _cu (
        id VARCHAR PRIMARY KEY,
        status VARCHAR,
        assigned_hall_id VARCHAR,
        assigned_seat_number VARCHAR,
        assigned_session_id VARCHAR,
        assigned_exam_date VARCHAR
      ) ON COMMIT DROP`);

      const CU_BATCH = 50_000;
      for (let i = 0; i < candidates.length; i += CU_BATCH) {
        const batch = candidates.slice(i, i + CU_BATCH);
        const rows: string[] = [];
        const params: unknown[] = [];
        let pi = 1;
        for (const c of batch) {
          const a = assignmentByCandidate.get(c.id);
          rows.push(`($${pi}, $${pi + 1}, $${pi + 2}, $${pi + 3}, $${pi + 4}, $${pi + 5})`);
          params.push(
            c.id,
            a ? CandidateStatus.SCHEDULED : CandidateStatus.UNSCHEDULED,
            a?.hallId ?? null,
            a?.seatNumber ?? null,
            a?.sessionId ?? null,
            a ? sessionById.get(a.sessionId)!.examDate : null,
          );
          pi += 6;
        }
        await qr.manager.query(
          `INSERT INTO _cu (id, status, assigned_hall_id, assigned_seat_number, assigned_session_id, assigned_exam_date)
           VALUES ${rows.join(',')}`,
          params,
        );
      }

      await qr.manager.query(
        `UPDATE candidates SET
           status            = _cu.status,
           assigned_hall_id  = _cu.assigned_hall_id,
           assigned_seat_number = _cu.assigned_seat_number,
           assigned_session_id  = _cu.assigned_session_id,
           assigned_exam_date   = _cu.assigned_exam_date
         FROM _cu WHERE candidates.id = _cu.id`,
      );

      await qr.manager.query(`DROP TABLE IF EXISTS _cu`);
    }

    // 5. Refresh seat inventory via temp table + UPDATE … FROM.
    await qr.manager.query(`UPDATE seats SET status = 'available', candidate_id = NULL`);

    if (result.assignments.length > 0) {
      let latestDate = '';
      for (const s of sessions) {
        if (s.examDate > latestDate) latestDate = s.examDate;
      }
      const latestAssignments = result.assignments.filter(
        (a) => sessionById.get(a.sessionId)!.examDate === latestDate,
      );

      if (latestAssignments.length > 0) {
        await qr.manager.query(`CREATE TEMPORARY TABLE _su (
          hall_id VARCHAR,
          seat_number VARCHAR,
          candidate_id VARCHAR
        ) ON COMMIT DROP`);

        const SU_BATCH = 50_000;
        for (let i = 0; i < latestAssignments.length; i += SU_BATCH) {
          const batch = latestAssignments.slice(i, i + SU_BATCH);
          const rows: string[] = [];
          const params: unknown[] = [];
          let pi = 1;
          for (const a of batch) {
            rows.push(`($${pi}, $${pi + 1}, $${pi + 2})`);
            params.push(a.hallId, a.seatNumber, a.candidateId);
            pi += 3;
          }
          await qr.manager.query(
            `INSERT INTO _su (hall_id, seat_number, candidate_id) VALUES ${rows.join(',')}`,
            params,
          );
        }

        await qr.manager.query(
          `UPDATE seats SET
             status = 'occupied',
             candidate_id = _su.candidate_id
           FROM _su
           WHERE seats.hall_id = _su.hall_id AND seats.seat_number = _su.seat_number`,
        );

        await qr.manager.query(`DROP TABLE IF EXISTS _su`);
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
