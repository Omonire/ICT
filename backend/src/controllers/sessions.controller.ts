import { Request, Response } from 'express';
import { AppDataSource } from '../config/data-source';
import { Session } from '../entities/Session';
import { AppError, asyncHandler } from '../utils/errors';
import { genUuid } from '../utils/ids';
import { logActivity } from '../services/activity-log';

export const listSessions = asyncHandler(async (_req: Request, res: Response) => {
  const sessions = await AppDataSource.getRepository(Session).find({
    order: { examDate: 'ASC', startTime: 'ASC' },
  });
  res.json({ data: sessions });
});

export const getSession = asyncHandler(async (req: Request, res: Response) => {
  const session = await AppDataSource.getRepository(Session).findOne({
    where: { id: req.params.id },
  });
  if (!session) throw AppError.notFound('Session not found');
  res.json({ data: session });
});

export const createSession = asyncHandler(async (req: Request, res: Response) => {
  const repo = AppDataSource.getRepository(Session);
  const clash = await repo.findOne({
    where: { examDate: req.body.examDate, name: req.body.name },
  });
  if (clash) throw AppError.conflict('A session with this name and date already exists');

  const session = repo.create({
    id: genUuid(),
    name: req.body.name,
    examDate: req.body.examDate,
    startTime: req.body.startTime,
    endTime: req.body.endTime,
  });
  await repo.save(session);
  await logActivity({
    action: 'session.created',
    userId: req.user?.id ?? null,
    entityType: 'session',
    entityId: session.id,
    details: { name: session.name, examDate: session.examDate },
  });
  res.status(201).json({ data: session });
});

export const deleteSession = asyncHandler(async (req: Request, res: Response) => {
  const repo = AppDataSource.getRepository(Session);
  const session = await repo.findOne({ where: { id: req.params.id } });
  if (!session) throw AppError.notFound('Session not found');
  await repo.delete(session.id);
  await logActivity({
    action: 'session.deleted',
    userId: req.user?.id ?? null,
    entityType: 'session',
    entityId: session.id,
  });
  res.json({ success: true });
});
