import { Router } from 'express';
import { scheduleReportPdf, attendanceSheetPdf } from '../controllers/pdf.controller';
import { requireRole } from '../middleware/role';

const router = Router();

router.get('/schedule/reports/:runId/pdf', requireRole('superadmin', 'admin', 'operator'), scheduleReportPdf);
router.get('/attendance-sheets/:sessionId/:hallId/pdf', requireRole('superadmin', 'admin', 'operator'), attendanceSheetPdf);

export default router;
