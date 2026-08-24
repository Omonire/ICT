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

  const assignmentRepo = AppDataSource.getRepository(CandidateAssignment);
  const candidateRepo = AppDataSource.getRepository(Candidate);

  if (mode === 'manual') {
    if (!candidateIds || candidateIds.length === 0) {
      throw AppError.badRequest('Select at least one candidate to approve');
    }

    const allAssignments = await assignmentRepo.find();
    const toRemove = allAssignments.filter((a) => !candidateIds.includes(a.candidateId));
    const toKeep = allAssignments.filter((a) => candidateIds.includes(a.candidateId));

    const ds = AppDataSource;
    const qr = ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      for (const a of toRemove) {
        await qr.query(
          `UPDATE candidates SET status = $1, assigned_hall_id = NULL, assigned_seat_number = NULL, assigned_session_id = NULL, assigned_exam_date = NULL WHERE id = $2`,
          [CandidateStatus.UNSCHEDULED, a.candidateId]
        );
        await qr.query(
          `UPDATE seats SET status = $1, candidate_id = NULL WHERE hall_id = $2 AND seat_number = $3`,
          ['available', a.hallId, a.seatNumber]
        );
        await qr.query(`DELETE FROM candidate_assignments WHERE id = $1`, [a.id]);
      }

      for (const a of toKeep) {
        const candidate = await qr.manager.findOne(Candidate, { where: { id: a.candidateId } });
        if (candidate) {
          candidate.status = CandidateStatus.SCHEDULED;
          candidate.assignedHallId = a.hallId;
          candidate.assignedSeatNumber = a.seatNumber;
          candidate.assignedSessionId = a.sessionId;
          await qr.manager.save(candidate);
        }
        await qr.query(
          `UPDATE seats SET status = $1, candidate_id = $2 WHERE hall_id = $3 AND seat_number = $4`,
          ['occupied', a.candidateId, a.hallId, a.seatNumber]
        );
      }

      meta.status = ScheduleState.CONFIRMED;
      meta.confirmedAt = new Date();
      meta.confirmedBy = req.user?.id ?? null;
      await qr.manager.save(meta);
      await qr.commitTransaction();
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    await logActivity({
      action: 'schedule.approved',
      userId: req.user?.id ?? null,
      entityType: 'schedule',
      details: { mode, approved: toKeep.length, removed: toRemove.length },
    });

    res.json({ data: { status: ScheduleState.CONFIRMED, assignmentCount: toKeep.length, removedCount: toRemove.length } });
  } else {
    const count = await assignmentRepo.count();
    if (count === 0) throw AppError.badRequest('The draft schedule has no assignments to approve');

    const allAssignments = await assignmentRepo.find();
    for (const a of allAssignments) {
      const candidate = await candidateRepo.findOne({ where: { id: a.candidateId } });
      if (candidate) {
        candidate.status = CandidateStatus.SCHEDULED;
        candidate.assignedHallId = a.hallId;
        candidate.assignedSeatNumber = a.seatNumber;
        candidate.assignedSessionId = a.sessionId;
        await candidateRepo.save(candidate);
      }
      await AppDataSource.query(
        `UPDATE seats SET status = $1, candidate_id = $2 WHERE hall_id = $3 AND seat_number = $4`,
        ['occupied', a.candidateId, a.hallId, a.seatNumber]
      );
    }

    meta.status = ScheduleState.CONFIRMED;
    meta.confirmedAt = new Date();
    meta.confirmedBy = req.user?.id ?? null;
    await AppDataSource.getRepository(ScheduleMeta).save(meta);

    await logActivity({
      action: 'schedule.approved',
      userId: req.user?.id ?? null,
      entityType: 'schedule',
      details: { mode: 'auto', approved: count },
    });

    res.json({ data: { status: ScheduleState.CONFIRMED, assignmentCount: count, removedCount: 0 } });
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
