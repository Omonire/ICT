import { Request, Response } from 'express';
import { AppDataSource } from '../config/data-source';
import { ScheduleConflict, ConflictStatus, ConflictType } from '../entities/ScheduleConflict';
import { Candidate } from '../entities/Candidate';
import { Session } from '../entities/Session';
import { Hall } from '../entities/Hall';
import { CandidateAssignment } from '../entities/CandidateAssignment';
import { SchedulingRun } from '../entities/SchedulingRun';
import { AppError, asyncHandler } from '../utils/errors';
import { broadcast } from '../services/websocket';

interface ConflictResolutionSuggestion {
  conflictId: string;
  candidateId: string;
  candidateName: string;
  currentAssignment: {
    sessionId: string | null;
    sessionName: string | null;
    examDate: string | null;
    hallId: string | null;
    hallName: string | null;
    seatNumber: string | null;
  } | null;
  suggestedMove: {
    sessionId: string;
    sessionName: string;
    examDate: string;
    hallId: string;
    hallName: string;
    seatNumber: string;
  } | null;
  reason: string;
}

/**
 * POST /api/schedule/auto-resolve-conflicts
 * Analyzes all open conflicts for a scheduling run and suggests resolutions.
 */
export const autoResolveConflicts = asyncHandler(async (req: Request, res: Response) => {
  const { runId } = req.body as { runId: string };

  if (!runId) {
    throw AppError.badRequest('runId is required');
  }

  const ds = AppDataSource;

  const run = await ds.getRepository(SchedulingRun).findOne({ where: { id: runId } });
  if (!run) {
    throw AppError.notFound('Scheduling run not found');
  }

  const openConflicts = await ds.getRepository(ScheduleConflict).find({
    where: { schedulingRunId: runId, status: ConflictStatus.OPEN },
    relations: ['candidate'],
  });

  if (openConflicts.length === 0) {
    return res.json({ data: { suggestions: [], resolvedCount: 0 } });
  }

  const suggestions: ConflictResolutionSuggestion[] = [];

  for (const conflict of openConflicts) {
    const candidate = conflict.candidate;
    if (!candidate) continue;

    // Get current assignment for this candidate
    const currentAssignment = await ds.getRepository(CandidateAssignment).findOne({
      where: { candidateId: candidate.id },
      relations: ['session', 'hall'],
    });

    // Get the candidate's current exam date to avoid same-day rescheduling
    const currentExamDate = candidate.assignedExamDate;

    // Find sessions on DIFFERENT days that have available seats
    const availableSeats = await ds.query(`
      SELECT
        s.id AS "sessionId",
        s.name AS "sessionName",
        s.exam_date AS "examDate",
        h.id AS "hallId",
        h.name AS "hallName",
        se.seat_number AS "seatNumber"
      FROM seats se
      JOIN halls h ON h.id = se.hall_id
      JOIN sessions s ON 1=1
      WHERE se.status = 'available'
        AND h.status = 'active'
        ${currentExamDate ? 'AND s.exam_date != $1' : ''}
        AND s.id NOT IN (
          SELECT ca.session_id
          FROM candidate_assignments ca
          WHERE ca.candidate_id = $2
        )
      ORDER BY s.exam_date ASC, s.start_time ASC
      LIMIT 1
    `, currentExamDate ? [currentExamDate, candidate.id] : [candidate.id]);

    const suggestion: ConflictResolutionSuggestion = {
      conflictId: conflict.id,
      candidateId: candidate.id,
      candidateName: candidate.name,
      currentAssignment: currentAssignment
        ? {
            sessionId: currentAssignment.sessionId,
            sessionName: currentAssignment.session?.name ?? null,
            examDate: currentAssignment.session?.examDate ?? null,
            hallId: currentAssignment.hallId,
            hallName: currentAssignment.hall?.name ?? null,
            seatNumber: currentAssignment.seatNumber,
          }
        : null,
      suggestedMove: availableSeats.length > 0
        ? {
            sessionId: availableSeats[0].sessionId,
            sessionName: availableSeats[0].sessionName,
            examDate: availableSeats[0].examDate,
            hallId: availableSeats[0].hallId,
            hallName: availableSeats[0].hallName,
            seatNumber: availableSeats[0].seatNumber,
          }
        : null,
      reason: getConflictReason(conflict.conflictType, conflict.description),
    };

    suggestions.push(suggestion);
  }

  const resolvedCount = suggestions.filter((s) => s.suggestedMove !== null).length;

  res.json({
    data: {
      runId,
      totalConflicts: openConflicts.length,
      resolvedCount,
      unresolvedCount: openConflicts.length - resolvedCount,
      suggestions,
    },
  });
});

/**
 * POST /api/schedule/apply-conflict-resolution
 * Apply a suggested resolution: move candidate to new seat and mark conflict resolved.
 */
export const applyConflictResolution = asyncHandler(async (req: Request, res: Response) => {
  const { conflictId, targetSessionId, targetHallId, targetSeatNumber } = req.body as {
    conflictId: string;
    targetSessionId: string;
    targetHallId: string;
    targetSeatNumber: string;
  };

  if (!conflictId || !targetSessionId || !targetHallId || !targetSeatNumber) {
    throw AppError.badRequest('conflictId, targetSessionId, targetHallId, and targetSeatNumber are required');
  }

  const ds = AppDataSource;
  const qr = ds.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();

  try {
    const conflict = await qr.manager.findOne(ScheduleConflict, {
      where: { id: conflictId },
      relations: ['candidate'],
    });
    if (!conflict) throw AppError.notFound('Conflict not found');

    const candidate = conflict.candidate;
    if (!candidate) throw AppError.badRequest('Conflict has no associated candidate');

    // Verify seat is available
    const seat = await qr.query(
      `SELECT id, status FROM seats WHERE hall_id = $1 AND seat_number = $2`,
      [targetHallId, targetSeatNumber]
    );
    if (!seat?.length || seat[0].status !== 'available') {
      throw AppError.badRequest('Target seat is not available');
    }

    // Get target session info for exam date
    const session = await qr.manager.findOne(Session, { where: { id: targetSessionId } });
    if (!session) throw AppError.notFound('Target session not found');

    // Free old seat if candidate has one
    if (candidate.assignedHallId && candidate.assignedSeatNumber) {
      await qr.query(
        `UPDATE seats SET status = 'available', candidate_id = NULL WHERE hall_id = $1 AND seat_number = $2`,
        [candidate.assignedHallId, candidate.assignedSeatNumber]
      );
    }

    // Delete old assignment
    await qr.query(
      `DELETE FROM candidate_assignments WHERE candidate_id = $1`,
      [candidate.id]
    );

    // Create new assignment
    const { genUuid } = await import('../utils/ids');
    const newAssignmentId = genUuid();
    await qr.query(
      `INSERT INTO candidate_assignments (id, candidate_id, session_id, hall_id, seat_number, assigned_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [newAssignmentId, candidate.id, targetSessionId, targetHallId, targetSeatNumber]
    );

    // Occupy new seat
    await qr.query(
      `UPDATE seats SET status = 'occupied', candidate_id = $1 WHERE hall_id = $2 AND seat_number = $3`,
      [candidate.id, targetHallId, targetSeatNumber]
    );

    // Update candidate record
    await qr.query(
      `UPDATE candidates
       SET status = 'scheduled',
           assigned_session_id = $1,
           assigned_hall_id = $2,
           assigned_seat_number = $3,
           assigned_exam_date = $4
       WHERE id = $5`,
      [targetSessionId, targetHallId, targetSeatNumber, session.examDate, candidate.id]
    );

    // Mark conflict as resolved
    conflict.status = ConflictStatus.RESOLVED;
    conflict.resolvedAt = new Date();
    conflict.resolvedBy = req.user?.id ?? null;
    conflict.resolutionNotes = `Auto-resolved: moved to session ${targetSessionId}, hall ${targetHallId}, seat ${targetSeatNumber}`;
    await qr.manager.save(conflict);

    await qr.commitTransaction();

    broadcast('conflict.resolved', {
      conflictId,
      candidateId: candidate.id,
      sessionId: targetSessionId,
      hallId: targetHallId,
      seatNumber: targetSeatNumber,
    });

    res.json({
      data: {
        conflictId,
        candidateId: candidate.id,
        assignment: {
          sessionId: targetSessionId,
          hallId: targetHallId,
          seatNumber: targetSeatNumber,
          examDate: session.examDate,
        },
      },
    });
  } catch (err) {
    await qr.rollbackTransaction();
    throw err;
  } finally {
    await qr.release();
  }
});

function getConflictReason(conflictType: string, description: string): string {
  switch (conflictType) {
    case ConflictType.DAILY_SESSION_LIMIT:
      return 'Candidate already has an exam on this day';
    case ConflictType.CAPACITY_EXCEEDED:
      return 'Target session hall is at full capacity';
    case ConflictType.HALL_UNAVAILABLE:
      return 'Assigned hall is not available for this session';
    case ConflictType.CANDIDATE_SESSION:
      return 'Candidate has a scheduling overlap';
    default:
      return description || 'Unknown conflict type';
  }
}
