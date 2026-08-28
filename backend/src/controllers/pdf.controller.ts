import { Request, Response } from 'express';
import { asyncHandler } from '../utils/errors';
import { generateScheduleReport, generateAttendanceSheet } from '../services/pdf-reports';
import { logActivity } from '../services/activity-log';

/**
 * GET /api/schedule/reports/:runId/pdf
 * Generate and stream the schedule report PDF.
 */
export const scheduleReportPdf = asyncHandler(async (req: Request, res: Response) => {
  const { runId } = req.params;

  const buffer = await generateScheduleReport(runId);

  await logActivity({
    action: 'schedule.report.pdf',
    userId: req.user?.id ?? null,
    entityType: 'scheduling_run',
    entityId: runId,
    details: { bufferSize: buffer.length },
  });

  const safeName = `schedule-report-${runId.slice(0, 8)}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  res.send(buffer);
});

/**
 * GET /api/attendance-sheets/:sessionId/:hallId/pdf
 * Generate and stream the attendance sheet PDF.
 */
export const attendanceSheetPdf = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId, hallId } = req.params;

  const buffer = await generateAttendanceSheet(sessionId, hallId);

  await logActivity({
    action: 'attendance.sheet.pdf',
    userId: req.user?.id ?? null,
    entityType: 'attendance-sheet',
    details: { sessionId, hallId, bufferSize: buffer.length },
  });

  const safeName = `attendance-${sessionId.slice(0, 8)}-${hallId.slice(0, 8)}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  res.send(buffer);
});
