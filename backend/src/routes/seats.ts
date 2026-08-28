import { Router, Request, Response, NextFunction } from 'express';
import { listSeats } from '../controllers/halls.controller';

const router = Router();

// Support both /api/seats/:hallId and /api/seats?hallId=xxx
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  const hallId = req.query.hallId as string | undefined;
  if (hallId) {
    (req.params as Record<string, string>).hallId = hallId;
    return listSeats(req, res, next);
  }
  next();
});
router.get('/:hallId', listSeats);

export default router;
