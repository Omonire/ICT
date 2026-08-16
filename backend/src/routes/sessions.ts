import { Router } from 'express';
import {
  createSession,
  deleteSession,
  getSession,
  listSessions,
} from '../controllers/sessions.controller';
import { requireRole } from '../middleware/role';
import { validateBody } from '../middleware/validate';
import { sessionCreateSchema } from '../schemas';

const router = Router();

router.get('/', listSessions);
router.post('/', requireRole('superadmin', 'admin', 'operator'), validateBody(sessionCreateSchema), createSession);
router.get('/:id', getSession);
router.delete('/:id', requireRole('superadmin', 'admin'), deleteSession);

export default router;
