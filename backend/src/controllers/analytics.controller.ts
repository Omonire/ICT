import { Request, Response } from 'express';
import { AppDataSource } from '../config/data-source';
import { Candidate, CandidateStatus } from '../entities/Candidate';
import { CandidateAssignment } from '../entities/CandidateAssignment';
import { CareerGroup } from '../entities/CareerGroup';
import { Hall } from '../entities/Hall';
import { Session } from '../entities/Session';
import { ScheduleMeta } from '../entities/ScheduleMeta';
import { asyncHandler } from '../utils/errors';

export const getAnalytics = asyncHandler(async (_req: Request, res: Response) => {
  const ds = AppDataSource;
  const candidateRepo = ds.getRepository(Candidate);

  const [total, scheduled, unscheduled, completed] = await Promise.all([
    candidateRepo.count(),
    candidateRepo.count({ where: { status: CandidateStatus.SCHEDULED } }),
    candidateRepo.count({ where: { status: CandidateStatus.UNSCHEDULED } }),
    candidateRepo.count({ where: { status: CandidateStatus.COMPLETED } }),
  ]);

  const groups = await ds.getRepository(CareerGroup).find({ order: { name: 'ASC' } });
  const candidates = await candidateRepo.find({ select: ['careerGroupId', 'status'] });
  const byGroup = groups.map((g) => {
    const rows = candidates.filter((c) => c.careerGroupId === g.id);
    return {
      id: g.id,
      name: g.name,
      total: rows.length,
      scheduled: rows.filter((c) => c.status === CandidateStatus.SCHEDULED).length,
      unscheduled: rows.filter((c) => c.status === CandidateStatus.UNSCHEDULED).length,
      completed: rows.filter((c) => c.status === CandidateStatus.COMPLETED).length,
    };
  });

  const halls = await ds.getRepository(Hall).find({ order: { name: 'ASC' } });
  const assignments = await ds.getRepository(CandidateAssignment).find({
    relations: { session: true, hall: true },
  });

  const byHall = halls.map((h) => {
    const count = assignments.filter((a) => a.hallId === h.id).length;
    return {
      id: h.id,
      name: h.name,
      capacity: h.capacity,
      assigned: count,
      utilization: h.capacity > 0 ? Math.round((count / h.capacity) * 100) : 0,
    };
  });

  const sessions = await ds.getRepository(Session).find({
    order: { examDate: 'ASC', startTime: 'ASC' },
  });
  const totalActiveCapacity = halls
    .filter((h) => h.status === 'active')
    .reduce((sum, h) => sum + h.capacity, 0);

  const bySession = sessions.map((s) => {
    const count = assignments.filter((a) => a.sessionId === s.id).length;
    return {
      id: s.id,
      name: s.name,
      examDate: s.examDate,
      startTime: s.startTime,
      endTime: s.endTime,
      assigned: count,
      capacity: totalActiveCapacity,
      utilization: totalActiveCapacity > 0 ? Math.round((count / totalActiveCapacity) * 100) : 0,
    };
  });

  const meta = await ds.getRepository(ScheduleMeta).findOne({ where: { id: 'schedule' } });

  res.json({
    data: {
      candidates: { total, scheduled, unscheduled, completed },
      scheduledPct: total > 0 ? Math.round((scheduled / total) * 100) : 0,
      completedPct: total > 0 ? Math.round((completed / total) * 100) : 0,
      utilizationPct:
        totalActiveCapacity > 0
          ? Math.round((assignments.length / totalActiveCapacity) * 100)
          : 0,
      scheduleStatus: meta?.status ?? 'none',
      byGroup,
      byHall,
      bySession,
    },
  });
});
