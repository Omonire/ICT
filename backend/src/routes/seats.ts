import { Router } from 'express';
import { listSeats } from '../controllers/halls.controller';

const router = Router();

router.get('/:hallId', listSeats);

export default router;
