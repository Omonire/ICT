import { Request, Response } from 'express';
import { AppDataSource } from '../config/data-source';
import { Candidate, CandidateStatus } from '../entities/Candidate';
import { CareerGroup } from '../entities/CareerGroup';
import { AppError, asyncHandler } from '../utils/errors';
import { parsePagination, paginate, queryString } from '../utils/pagination';
import { nextCandidateId } from '../utils/ids';
import { logActivity } from '../services/activity-log';
import { commitImport, parseCandidateCsv } from '../services/csv-import';

export const listCandidates = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, offset } = parsePagination(req, 25);
  const search = queryString(req.query.search);
  const status = queryString(req.query.status);
  const careerGroupId = queryString(req.query.careerGroupId);
  const hallId = queryString(req.query.hallId);
  const sessionId = queryString(req.query.sessionId);
  const sortBy = queryString(req.query.sortBy) ?? 'id';
  const sortOrder = (queryString(req.query.sortOrder) ?? 'asc') === 'desc' ? 'DESC' : 'ASC';

  const repo = AppDataSource.getRepository(Candidate);
  const qb = repo
    .createQueryBuilder('c')
    .leftJoinAndSelect('c.careerGroup', 'cg')
    .leftJoinAndSelect('c.assignedHall', 'ah')
    .leftJoinAndSelect('c.assignedSession', 'asn');

  if (search) {
    qb.andWhere(
      '(c.id LIKE :s OR LOWER(c.name) LIKE :s2 OR LOWER(c.email) LIKE :s3 OR LOWER(c.matricNo) LIKE :s4)',
      { s: `%${search}%`, s2: `%${search.toLowerCase()}%`, s3: `%${search.toLowerCase()}%`, s4: `%${search.toLowerCase()}%` }
    );
  }
  if (status) qb.andWhere('c.status = :status', { status });
  if (careerGroupId) qb.andWhere('c.careerGroupId = :cg', { cg: careerGroupId });
  if (hallId) qb.andWhere('c.assignedHallId = :h', { h: hallId });
  if (sessionId) qb.andWhere('c.assignedSessionId = :s', { s: sessionId });

  const sortable = new Set(['id', 'name', 'email', 'matricNo', 'status', 'createdAt', 'assignedSeatNumber', 'assignedExamDate']);
  const column = sortable.has(sortBy) ? sortBy : 'id';
  qb.orderBy(`c.${column}`, sortOrder);

  const total = await qb.getCount();
  const rows = await qb.skip(offset).take(limit).getMany();

  res.json(paginate(rows, total, page, limit));
});

export const getCandidate = asyncHandler(async (req: Request, res: Response) => {
  const repo = AppDataSource.getRepository(Candidate);
  const candidate = await repo.findOne({
    where: { id: req.params.id },
    relations: { careerGroup: true, assignedHall: true, assignedSession: true },
  });
  if (!candidate) throw AppError.notFound('Candidate not found');
  res.json({ data: candidate });
});

export const createCandidate = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, matricNo, careerGroupId } = req.body;
  const repo = AppDataSource.getRepository(Candidate);
  const group = await AppDataSource.getRepository(CareerGroup).findOne({
    where: { id: careerGroupId },
  });
  if (!group) throw AppError.notFound('Career group not found');

  const existing = await repo.findOne({ where: { email: email.toLowerCase() } });
  if (existing) throw AppError.conflict('A candidate with this email already exists');

  const all = await repo.find({ select: ['id'] });
  const candidate = repo.create({
    id: nextCandidateId(all.map((c) => c.id)),
    name,
    email: email.toLowerCase(),
    matricNo: matricNo ?? null,
    careerGroupId: group.id,
    status: CandidateStatus.UNSCHEDULED,
  });
  await repo.save(candidate);
  group.candidateCount += 1;
  await AppDataSource.getRepository(CareerGroup).save(group);

  await logActivity({
    action: 'candidate.created',
    userId: req.user?.id ?? null,
    entityType: 'candidate',
    entityId: candidate.id,
    details: { name: candidate.name },
  });
  res.status(201).json({ data: candidate });
});

export const updateCandidate = asyncHandler(async (req: Request, res: Response) => {
  const repo = AppDataSource.getRepository(Candidate);
  const candidate = await repo.findOne({ where: { id: req.params.id } });
  if (!candidate) throw AppError.notFound('Candidate not found');

  const { name, email, matricNo, careerGroupId, status } = req.body;
  if (careerGroupId) {
    const group = await AppDataSource.getRepository(CareerGroup).findOne({ where: { id: careerGroupId } });
    if (!group) throw AppError.notFound('Career group not found');
    candidate.careerGroupId = group.id;
  }
  if (name !== undefined) candidate.name = name;
  if (email !== undefined) {
    const clash = await repo.findOne({ where: { email: email.toLowerCase() } });
    if (clash && clash.id !== candidate.id) throw AppError.conflict('Email already in use');
    candidate.email = email.toLowerCase();
  }
  if (matricNo !== undefined) candidate.matricNo = matricNo ?? null;
  if (status !== undefined && ['scheduled', 'unscheduled', 'completed'].includes(status)) {
    candidate.status = status;
  }

  await repo.save(candidate);
  await logActivity({
    action: 'candidate.updated',
    userId: req.user?.id ?? null,
    entityType: 'candidate',
    entityId: candidate.id,
  });
  res.json({ data: candidate });
});

export const deleteCandidate = asyncHandler(async (req: Request, res: Response) => {
  const repo = AppDataSource.getRepository(Candidate);
  const candidate = await repo.findOne({ where: { id: req.params.id }, relations: { careerGroup: true } });
  if (!candidate) throw AppError.notFound('Candidate not found');

  if (candidate.careerGroup) {
    candidate.careerGroup.candidateCount = Math.max(0, candidate.careerGroup.candidateCount - 1);
    await AppDataSource.getRepository(CareerGroup).save(candidate.careerGroup);
  }
  await repo.delete(candidate.id);
  await logActivity({
    action: 'candidate.deleted',
    userId: req.user?.id ?? null,
    entityType: 'candidate',
    entityId: candidate.id,
  });
  res.json({ success: true });
});

export const importPreview = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) throw AppError.badRequest('Attach a CSV file to import');
  const result = parseCandidateCsv(file.buffer, file.originalname);
  await logActivity({
    action: 'import.preview',
    userId: req.user?.id ?? null,
    entityType: 'candidate',
    details: { fileName: file.originalname, totalRows: result.totalRows, validCount: result.validCount, errorCount: result.errorCount },
  });
  res.json({ data: result });
});

export const importConfirm = asyncHandler(async (req: Request, res: Response) => {
  const { importId } = req.body as { importId: string };
  const result = await commitImport(importId);
  await logActivity({
    action: 'import.confirmed',
    userId: req.user?.id ?? null,
    entityType: 'candidate',
    details: { imported: result.imported, skipped: result.skipped },
  });
  res.json({ data: result });
});
