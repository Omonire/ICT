import { Request, Response } from 'express';
import { Like } from 'typeorm';
import { AppDataSource } from '../config/data-source';
import { ActivityLog } from '../entities/ActivityLog';
import { asyncHandler } from '../utils/errors';
import { parsePagination, paginate, queryString } from '../utils/pagination';

export const listActivity = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, offset } = parsePagination(req, 30);
  const action = queryString(req.query.action);

  const repo = AppDataSource.getRepository(ActivityLog);
  const qb = repo
    .createQueryBuilder('l')
    .leftJoinAndSelect('l.user', 'u')
    .orderBy('l.timestamp', 'DESC');

  if (action) qb.where('l.action = :action', { action });

  const total = await qb.getCount();
  const rows = await qb.skip(offset).take(limit).getMany();

  res.json({
    ...paginate(
      rows.map((r) => ({
        id: r.id,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        details: r.details,
        timestamp: r.timestamp,
        user: r.user
          ? { id: r.user.id, email: r.user.email, name: r.user.name, role: r.user.role }
          : null,
      })),
      total,
      page,
      limit
    ),
  });
});
