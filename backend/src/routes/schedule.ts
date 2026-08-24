import { Router } from 'express';
import {
  approve,
  capacity,
  clear,
  confirm,
  generate,
  getStatus,
  preview,
} from '../controllers/schedule.controller';
import { requireRole } from '../middleware/role';
import { validateBody } from '../middleware/validate';
import { scheduleApproveSchema, scheduleGenerateSchema } from '../schemas';

const router = Router();

router.get('/capacity', capacity);
router.get('/status', getStatus);
router.get('/preview', preview);
router.post('/generate', requireRole('superadmin', 'admin', 'operator'), validateBody(scheduleGenerateSchema), generate);
router.post('/approve', requireRole('superadmin', 'admin', 'operator'), validateBody(scheduleApproveSchema), approve);
router.post('/confirm', requireRole('superadmin', 'admin', 'operator'), confirm);
router.post('/clear', requireRole('superadmin', 'admin'), clear);

export default router;
