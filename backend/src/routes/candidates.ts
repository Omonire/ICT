import { Router } from 'express';
import multer from 'multer';
import {
  createCandidate,
  deleteCandidate,
  getCandidate,
  importConfirm,
  importPreview,
  listCandidates,
  updateCandidate,
} from '../controllers/candidates.controller';
import { requireRole } from '../middleware/role';
import { validateBody, validateQuery } from '../middleware/validate';
import { candidateCreateSchema, candidateUpdateSchema, listQuerySchema } from '../schemas';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.get('/', validateQuery(listQuerySchema), listCandidates);
router.post('/', requireRole('superadmin', 'admin', 'operator'), validateBody(candidateCreateSchema), createCandidate);
router.post(
  '/import/preview',
  requireRole('superadmin', 'admin', 'operator'),
  upload.single('file'),
  importPreview
);
router.post('/import/confirm', requireRole('superadmin', 'admin', 'operator'), importConfirm);
router.get('/:id', getCandidate);
router.put('/:id', requireRole('superadmin', 'admin', 'operator'), validateBody(candidateUpdateSchema), updateCandidate);
router.delete('/:id', requireRole('superadmin', 'admin'), deleteCandidate);

export default router;
