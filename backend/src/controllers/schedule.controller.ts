import { Request, Response } from 'express';
import { AppDataSource } from '../config/data-source';
import { Candidate, CandidateStatus } from '../entities/Candidate';
import { CandidateAssignment } from '../entities/CandidateAssignment';
import { Hall } from '../entities/Hall';
import { Seat } from '../entities/Seat';
import { ScheduleMeta, ScheduleState } from '../entities/ScheduleMeta';
import { AppError, asyncHandler } from '../utils/errors';
import { generateSchedule } from '../services/scheduler';
import { logActivity } from '../services/activity-log';

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
            const rows = await qr.query(`SELECT id, exam_date FROM session WHERE id = ANY($1::varchar[])`, [sessIds.slice(i, i + BATCH)]);
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
           FROM candidate_assignments a JOIN session s ON s.id = a.session_id
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
