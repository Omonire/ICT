import { Router } from 'express';
import {
  createCareerGroup,
  listCareerGroups,
} from '../controllers/career-groups.controller';
import { requireRole } from '../middleware/role';
import { validateBody } from '../middleware/validate';
import { careerGroupCreateSchema } from '../schemas';

const router = Router();

router.get('/', listCareerGroups);
router.post('/', requireRole('superadmin', 'admin'), validateBody(careerGroupCreateSchema), createCareerGroup);

export default router;
