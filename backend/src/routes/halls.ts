import { Router } from 'express';
import {
  createHall,
  getHall,
  listHalls,
  updateHall,
} from '../controllers/halls.controller';
import { requireRole } from '../middleware/role';
import { validateBody } from '../middleware/validate';
import { hallCreateSchema, hallUpdateSchema } from '../schemas';

const router = Router();

router.get('/', listHalls);
router.post('/', requireRole('superadmin', 'admin'), validateBody(hallCreateSchema), createHall);
router.get('/:id', getHall);
router.put('/:id', requireRole('superadmin', 'admin'), validateBody(hallUpdateSchema), updateHall);

export default router;
