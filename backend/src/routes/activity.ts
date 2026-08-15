import { Router } from 'express';
import { listActivity } from '../controllers/activity.controller';

const router = Router();

router.get('/', listActivity);

export default router;
