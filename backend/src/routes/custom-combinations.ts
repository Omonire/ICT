import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/data-source';
import { CustomCombination } from '../entities/CustomCombination';
import { asyncHandler, AppError } from '../utils/errors';
import { requireRole } from '../middleware/role';
import { logActivity } from '../services/activity-log';
import { normalizeSubjectCombination } from '../services/scheduling-engine';

const router = Router();

// List all custom combinations
router.get('/', requireRole('superadmin', 'admin', 'operator'), asyncHandler(async (_req: Request, res: Response) => {
  const repo = AppDataSource.getRepository(CustomCombination);
  const combos = await repo.find({ order: { createdAt: 'DESC' } });
  res.json({ data: combos });
}));

// Create a custom combination
router.post('/', requireRole('superadmin', 'admin', 'operator'), asyncHandler(async (req: Request, res: Response) => {
  const { subjects, careerGroupId, firstChoice } = req.body as {
    subjects: string[];
    careerGroupId?: string;
    firstChoice?: string;
  };

  if (!subjects || subjects.length < 2) {
    throw AppError.badRequest('At least 2 subjects are required');
  }

  const normalized = normalizeSubjectCombination(subjects);
  const displayName = subjects
    .map((s) => s.trim())
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join(' + ');

  // Check for duplicate
  const repo = AppDataSource.getRepository(CustomCombination);
  const existing = await repo.findOne({ where: { id: normalized } });
  if (existing) {
    throw AppError.badRequest('This combination already exists');
  }

  // Count matching candidates
  const candidateRepo = AppDataSource.getRepository((await import('../entities/Candidate')).Candidate);
  const count = await candidateRepo
    .createQueryBuilder('c')
    .where("c.jamb_subjects IS NOT NULL AND jsonb_array_length(c.jamb_subjects) > 0")
    .andWhere(`LOWER(TRIM(c.jamb_subjects::text)) LIKE LOWER(:pattern)`, { pattern: `%${normalized}%` })
    .getCount();

  const combo = repo.create({
    id: normalized,
    displayName,
    subjects: subjects.map((s) => s.trim().toLowerCase()),
    careerGroupId: careerGroupId || null,
    firstChoice: firstChoice || null,
    candidateCount: count,
    createdBy: req.user?.email || 'unknown',
  });

  await repo.save(combo);

  await logActivity({
    action: 'custom_combination.created',
    userId: req.user?.id ?? null,
    entityType: 'custom_combination',
    entityId: normalized,
    details: { displayName, subjects, candidateCount: count },
  });

  res.status(201).json({ data: combo });
}));

// Delete a custom combination
router.delete('/:id', requireRole('superadmin', 'admin', 'operator'), asyncHandler(async (req: Request, res: Response) => {
  const repo = AppDataSource.getRepository(CustomCombination);
  const combo = await repo.findOne({ where: { id: req.params.id } });
  if (!combo) throw AppError.notFound('Combination not found');

  await repo.remove(combo);

  await logActivity({
    action: 'custom_combination.deleted',
    userId: req.user?.id ?? null,
    entityType: 'custom_combination',
    entityId: req.params.id,
  });

  res.json({ data: { deleted: true } });
}));

export default router;
