import { Request, Response } from 'express';
import { AppDataSource } from '../config/data-source';
import { CareerGroup } from '../entities/CareerGroup';
import { AppError, asyncHandler } from '../utils/errors';
import { genUuid } from '../utils/ids';
import { logActivity } from '../services/activity-log';

export const listCareerGroups = asyncHandler(async (_req: Request, res: Response) => {
  const groups = await AppDataSource.getRepository(CareerGroup).find({
    order: { name: 'ASC' },
  });
  res.json({ data: groups });
});

export const createCareerGroup = asyncHandler(async (req: Request, res: Response) => {
  const repo = AppDataSource.getRepository(CareerGroup);
  const clash = await repo.findOne({ where: { name: req.body.name } });
  if (clash) throw AppError.conflict('A career group with this name already exists');

  const group = repo.create({
    id: genUuid(),
    name: req.body.name,
    description: req.body.description ?? null,
    subjects: req.body.subjects ?? [],
  });
  await repo.save(group);
  await logActivity({
    action: 'career-group.created',
    userId: req.user?.id ?? null,
    entityType: 'career-group',
    entityId: group.id,
    details: { name: group.name },
  });
  res.status(201).json({ data: group });
});
