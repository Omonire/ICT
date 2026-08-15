import { Router } from 'express';
import {
  generateSheet,
  listSheets,
  sheetById,
  sheetHtml,
  sheetPdf,
} from '../controllers/attendance.controller';

const router = Router();

router.get('/', listSheets);
router.get('/:id/pdf', sheetById);
router.post('/:sessionId/:hallId/generate', generateSheet);
router.get('/:sessionId/:hallId/pdf', sheetPdf);
router.get('/:sessionId/:hallId/html', sheetHtml);

export default router;
