import { Request, Response } from 'express';
import { AppDataSource } from '../config/data-source';
import { CandidateAssignment } from '../entities/CandidateAssignment';
import { AppError, asyncHandler } from '../utils/errors';
import { buildAttendanceSheet, buildSheetHtml, buildSheetPdf } from '../services/attendance';
import { logActivity } from '../services/activity-log';

export const listSheets = asyncHandler(async (_req: Request, res: Response) => {
  const rows = await AppDataSource.getRepository(CandidateAssignment)
    .createQueryBuilder('a')
    .select('a.sessionId', 'sessionId')
    .addSelect('s.name', 'sessionName')
    .addSelect('s.examDate', 'examDate')
    .addSelect('s.startTime', 'startTime')
    .addSelect('s.endTime', 'endTime')
    .addSelect('a.hallId', 'hallId')
    .addSelect('h.name', 'hallName')
    .addSelect('h.capacity', 'capacity')
    .addSelect('COUNT(*)', 'candidates')
    .innerJoin('a.session', 's')
    .innerJoin('a.hall', 'h')
    .groupBy('a.sessionId, s.name, s.examDate, s.startTime, s.endTime, a.hallId, h.name, h.capacity')
    .orderBy('s.examDate', 'ASC')
    .addOrderBy('s.startTime', 'ASC')
    .addOrderBy('h.name', 'ASC')
    .getRawMany();

  res.json({
    data: rows.map((r) => ({
      sessionId: r.sessionId,
      sessionName: r.sessionName,
      examDate: r.examDate,
      startTime: r.startTime,
      endTime: r.endTime,
      hallId: r.hallId,
      hallName: r.hallName,
      capacity: Number(r.capacity),
      candidates: Number(r.candidates),
    })),
  });
});

export const generateSheet = asyncHandler(async (req: Request, res: Response) => {
  const sheet = await buildAttendanceSheet(req.params.sessionId, req.params.hallId);
  await logActivity({
    action: 'attendance.generated',
    userId: req.user?.id ?? null,
    entityType: 'attendance-sheet',
    details: { sessionId: sheet.session.id, hallId: sheet.hall.id, total: sheet.total },
  });
  res.json({ data: sheet });
});

export const sheetPdf = asyncHandler(async (req: Request, res: Response) => {
  const sheet = await buildAttendanceSheet(req.params.sessionId, req.params.hallId);
  const buffer = await buildSheetPdf(sheet);
  await logActivity({
    action: 'attendance.pdf',
    userId: req.user?.id ?? null,
    entityType: 'attendance-sheet',
    details: { sessionId: sheet.session.id, hallId: sheet.hall.id },
  });
  const safeName = `${sheet.hall.name.replace(/\s+/g, '-')}-${sheet.session.examDate}-${sheet.session.name}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="attendance-${safeName}"`);
  res.send(buffer);
});

export const sheetHtml = asyncHandler(async (req: Request, res: Response) => {
  const sheet = await buildAttendanceSheet(req.params.sessionId, req.params.hallId);
  res.setHeader('Content-Type', 'text/html');
  res.send(buildSheetHtml(sheet));
});

export const sheetById = asyncHandler(async (req: Request, res: Response) => {
  const parts = String(req.params.id).split('_');
  if (parts.length < 2) throw AppError.badRequest('Invalid sheet id — expected sessionId_hallId');
  const sheet = await buildAttendanceSheet(parts[0], parts[1]);
  const buffer = await buildSheetPdf(sheet);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="attendance-${sheet.hall.name}.pdf"`);
  res.send(buffer);
});
