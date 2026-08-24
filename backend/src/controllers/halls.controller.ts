import { Request, Response } from 'express';
import { AppDataSource } from '../config/data-source';
import { Hall } from '../entities/Hall';
import { Seat } from '../entities/Seat';
import { CandidateAssignment } from '../entities/CandidateAssignment';
import { AppError, asyncHandler } from '../utils/errors';
import { genUuid } from '../utils/ids';
import { logActivity } from '../services/activity-log';
import { seatLabel } from '../services/scheduler';

export async function ensureHallSeats(hall: Hall): Promise<void> {
  const repo = AppDataSource.getRepository(Seat);
  const existing = await repo.count({ where: { hallId: hall.id } });
  const rows: Seat[] = [];
  for (let n = existing + 1; n <= hall.capacity; n++) {
    rows.push(
      repo.create({
        id: genUuid(),
        hallId: hall.id,
        seatNumber: seatLabel(hall.name, n),
        status: 'available',
      })
    );
  }
  if (rows.length > 0) await repo.save(rows);
}

export const listHalls = asyncHandler(async (_req: Request, res: Response) => {
  const halls = await AppDataSource.getRepository(Hall).find({ order: { name: 'ASC' } });
  const stats = new Map<string, { seats: number; occupied: number }>();
  try {
    const seatRepo = AppDataSource.getRepository(Seat);
    const hallIds = halls.map((h) => h.id);
    if (hallIds.length) {
      const counts = await seatRepo
        .createQueryBuilder('s')
        .select('s.hallId', 'hallId')
        .addSelect('COUNT(*)', 'seats')
        .addSelect("SUM(CASE WHEN s.status = 'occupied' THEN 1 ELSE 0 END)", 'occupied')
        .where('s.hallId IN (:...ids)', { ids: hallIds })
        .groupBy('s.hallId')
        .getRawMany();
      for (const row of counts) {
        stats.set(row.hallId, { seats: Number(row.seats), occupied: Number(row.occupied ?? 0) });
      }
    }
  } catch (err) {
    console.error('[listHalls] seat stats query failed:', err);
  }
  res.json({
    data: halls.map((h) => ({
      ...h,
      seatsTotal: stats.get(h.id)?.seats ?? 0,
      seatsOccupied: stats.get(h.id)?.occupied ?? 0,
    })),
  });
});

export const getHall = asyncHandler(async (req: Request, res: Response) => {
  const hall = await AppDataSource.getRepository(Hall).findOne({ where: { id: req.params.id } });
  if (!hall) throw AppError.notFound('Hall not found');
  await ensureHallSeats(hall);
  res.json({ data: hall });
});

export const createHall = asyncHandler(async (req: Request, res: Response) => {
  const repo = AppDataSource.getRepository(Hall);
  const clash = await repo.findOne({ where: { name: req.body.name } });
  if (clash) throw AppError.conflict('A hall with this name already exists');

  const hall = repo.create({
    id: genUuid(),
    name: req.body.name,
    capacity: req.body.capacity,
    status: req.body.status ?? 'active',
  });
  await repo.save(hall);
  await ensureHallSeats(hall);
  await logActivity({
    action: 'hall.created',
    userId: req.user?.id ?? null,
    entityType: 'hall',
    entityId: hall.id,
    details: { name: hall.name, capacity: hall.capacity },
  });
  res.status(201).json({ data: hall });
});

export const updateHall = asyncHandler(async (req: Request, res: Response) => {
  const repo = AppDataSource.getRepository(Hall);
  const hall = await repo.findOne({ where: { id: req.params.id } });
  if (!hall) throw AppError.notFound('Hall not found');

  if (req.body.name !== undefined) hall.name = req.body.name;
  if (req.body.status !== undefined) hall.status = req.body.status;
  if (req.body.capacity !== undefined) {
    hall.capacity = req.body.capacity;
    await ensureHallSeats(hall);
  }
  await repo.save(hall);
  await logActivity({
    action: 'hall.updated',
    userId: req.user?.id ?? null,
    entityType: 'hall',
    entityId: hall.id,
    details: { name: hall.name },
  });
  res.json({ data: hall });
});

export const listSeats = asyncHandler(async (req: Request, res: Response) => {
  const repo = AppDataSource.getRepository(Seat);
  const hall = await AppDataSource.getRepository(Hall).findOne({ where: { id: req.params.hallId } });
  if (!hall) throw AppError.notFound('Hall not found');
  await ensureHallSeats(hall);

  const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
  const seats = await repo.find({ where: { hallId: hall.id }, order: { seatNumber: 'ASC' } });

  let occupancy = new Map<string, { candidateId: string; status: string }>();
  if (sessionId) {
    const assignmentRows = await AppDataSource.getRepository(CandidateAssignment).find({
      where: { sessionId, hallId: hall.id },
    });
    occupancy = new Map(
      assignmentRows.map((a) => [
        a.seatNumber,
        { candidateId: a.candidateId, status: 'occupied' },
      ])
    );
  } else {
    occupancy = new Map(
      seats
        .filter((s) => s.status === 'occupied' && s.candidateId)
        .map((s) => [s.seatNumber, { candidateId: s.candidateId!, status: 'occupied' }])
    );
  }

  res.json({
    data: {
      hall,
      seats: seats.map((s) => ({
        id: s.id,
        seatNumber: s.seatNumber,
        status: occupancy.get(s.seatNumber)?.status ?? 'available',
        candidateId: occupancy.get(s.seatNumber)?.candidateId ?? null,
      })),
    },
  });
});
