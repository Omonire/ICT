import { Router } from 'express';
import {
  clear,
  confirm,
  generate,
  getStatus,
  preview,
} from '../controllers/schedule.controller';
import { requireRole } from '../middleware/role';
import { validateBody } from '../middleware/validate';
import { scheduleGenerateSchema } from '../schemas';

const router = Router();

router.get('/status', getStatus);
router.get('/preview', preview);
router.post('/generate', requireRole('admin', 'operator'), validateBody(scheduleGenerateSchema), generate);
router.post('/confirm', requireRole('admin', 'operator'), confirm);
router.post('/clear', requireRole('admin'), clear);

export default router;
