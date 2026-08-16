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
  const ds = AppDataSource;
  const sessionId = req.params.id;

  const session = await ds.getRepository(Session).findOne({ where: { id: sessionId } });
  if (!session) throw AppError.notFound('Session not found');

  const qr = ds.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    await qr.query('PRAGMA foreign_keys = OFF');
    await qr.query(`UPDATE candidates SET assigned_session_id = NULL, assigned_hall_id = NULL, assigned_seat_number = NULL, assigned_exam_date = NULL, status = 'unscheduled' WHERE assigned_session_id = ?`, [sessionId]);
    await qr.query(`UPDATE seats SET status = 'available', candidate_id = NULL WHERE candidate_id IN (SELECT candidate_id FROM candidate_assignments WHERE session_id = ?)`, [sessionId]);
    await qr.query(`DELETE FROM candidate_assignments WHERE session_id = ?`, [sessionId]);
    await qr.query(`DELETE FROM sessions WHERE id = ?`, [sessionId]);
    await qr.query('PRAGMA foreign_keys = ON');
    await qr.commitTransaction();
  } catch (err) {
    await qr.rollbackTransaction();
    throw err;
  } finally {
    await qr.release();
  }

  await logActivity({
    action: 'session.deleted',
    userId: req.user?.id ?? null,
    entityType: 'session',
    entityId: sessionId,
  });
  res.json({ success: true });
});
