import { Router } from 'express';
import { getAnalytics } from '../controllers/analytics.controller';

const router = Router();

router.get('/', getAnalytics);

export default router;
