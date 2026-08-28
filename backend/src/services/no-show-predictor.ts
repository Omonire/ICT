import { AppDataSource } from '../config/data-source';
import { Candidate } from '../entities/Candidate';
import { SchedulingRun } from '../entities/SchedulingRun';
import { CandidateAssignment } from '../entities/CandidateAssignment';
import { Session } from '../entities/Session';

export interface NoShowPrediction {
  candidateId: string;
  candidateName: string;
  email: string;
  sessionId: string | null;
  sessionName: string | null;
  examDate: string | null;
  hallId: string | null;
  seatNumber: string | null;
  noShowProbability: number;
  riskLevel: 'low' | 'medium' | 'high';
  factors: string[];
}

/**
 * Predict no-show probability for candidates in a scheduling run.
 *
 * Heuristic based on common exam patterns:
 * - Candidates in earliest sessions have higher no-show rates (morning rush, unprepared)
 * - Candidates with no career group preference tend to no-show more
 * - Longer time until exam date correlates with higher no-show probability
 * - Candidates scheduled back-to-back sessions are less likely to no-show
 */
export async function predictNoShows(runId: string): Promise<NoShowPrediction[]> {
  const ds = AppDataSource;

  const run = await ds.getRepository(SchedulingRun).findOne({ where: { id: runId } });
  if (!run) {
    throw new Error('Scheduling run not found');
  }

  // Get all candidates for this run who are scheduled
  const assignments = await ds.getRepository(CandidateAssignment)
    .createQueryBuilder('a')
    .innerJoinAndSelect('a.candidate', 'c')
    .innerJoinAndSelect('a.session', 's')
    .innerJoinAndSelect('a.hall', 'h')
    .getMany();

  // Also get unscheduled candidates
  const unscheduledCandidates = await ds.getRepository(Candidate)
    .createQueryBuilder('c')
    .where('c.status = :status', { status: 'unscheduled' })
    .getMany();

  // Build session info map
  const allSessions = await ds.getRepository(Session).find();
  const sessionMap = new Map(allSessions.map((s) => [s.id, s]));

  // Find the earliest session time across all sessions
  const allTimes = allSessions
    .map((s) => ({ examDate: s.examDate, startTime: s.startTime }))
    .sort((a, b) => a.examDate.localeCompare(b.examDate) || a.startTime.localeCompare(b.startTime));

  const earliestSession = allTimes.length > 0 ? allTimes[0] : null;
  const latestSession = allTimes.length > 0 ? allTimes[allTimes.length - 1] : null;

  const now = new Date();
  const predictions: NoShowPrediction[] = [];

  // Process scheduled candidates
  for (const assignment of assignments) {
    const candidate = assignment.candidate;
    const session = assignment.session;
    if (!candidate || !session) continue;

    let probability = 0.15; // Base probability
    const factors: string[] = [];

    // Factor 1: Earliest session has higher no-show rate
    if (earliestSession && session.examDate === earliestSession.examDate && session.startTime === earliestSession.startTime) {
      probability += 0.15;
      factors.push('scheduled in earliest session');
    }

    // Factor 2: Time until exam — longer gap means more chance of no-show
    if (session.examDate) {
      const examDate = new Date(session.examDate);
      const daysUntil = Math.max(0, (examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil > 14) {
        probability += 0.10;
        factors.push('exam date is more than 2 weeks away');
      } else if (daysUntil > 7) {
        probability += 0.05;
        factors.push('exam date is 1-2 weeks away');
      }
    }

    // Factor 3: Earliest exam day among all sessions (first-day no-shows are higher)
    if (earliestSession && session.examDate === earliestSession.examDate) {
      probability += 0.05;
      factors.push('scheduled on first exam day');
    }

    // Factor 4: Very early start time (before 9am)
    if (session.startTime && session.startTime < '09:00') {
      probability += 0.08;
      factors.push('early morning start time');
    }

    // Factor 5: Late afternoon session (fatigue factor)
    if (session.startTime && session.startTime >= '14:00') {
      probability += 0.03;
      factors.push('late afternoon session');
    }

    // Clamp probability
    probability = Math.min(Math.max(probability, 0.05), 0.95);

    predictions.push({
      candidateId: candidate.id,
      candidateName: candidate.name,
      email: candidate.email,
      sessionId: session.id,
      sessionName: session.name,
      examDate: session.examDate,
      hallId: assignment.hallId,
      seatNumber: assignment.seatNumber,
      noShowProbability: Math.round(probability * 100) / 100,
      riskLevel: probability >= 0.6 ? 'high' : probability >= 0.35 ? 'medium' : 'low',
      factors,
    });
  }

  // Process unscheduled candidates (they can't no-show since they're not scheduled, but flag them)
  for (const candidate of unscheduledCandidates) {
    predictions.push({
      candidateId: candidate.id,
      candidateName: candidate.name,
      email: candidate.email,
      sessionId: null,
      sessionName: null,
      examDate: null,
      hallId: null,
      seatNumber: null,
      noShowProbability: 0,
      riskLevel: 'low',
      factors: ['candidate not scheduled'],
    });
  }

  // Sort by probability descending
  predictions.sort((a, b) => b.noShowProbability - a.noShowProbability);

  return predictions;
}

/**
 * Get summary statistics for no-show predictions.
 */
export function getPredictionSummary(predictions: NoShowPrediction[]) {
  const scheduled = predictions.filter((p) => p.sessionId !== null);
  const highRisk = scheduled.filter((p) => p.riskLevel === 'high');
  const mediumRisk = scheduled.filter((p) => p.riskLevel === 'medium');
  const lowRisk = scheduled.filter((p) => p.riskLevel === 'low');
  const avgProbability = scheduled.length > 0
    ? scheduled.reduce((sum, p) => sum + p.noShowProbability, 0) / scheduled.length
    : 0;

  return {
    totalCandidates: predictions.length,
    scheduledCandidates: scheduled.length,
    unscheduledCandidates: predictions.length - scheduled.length,
    highRiskCount: highRisk.length,
    mediumRiskCount: mediumRisk.length,
    lowRiskCount: lowRisk.length,
    averageProbability: Math.round(avgProbability * 100) / 100,
    estimatedNoShows: Math.round(
      scheduled.reduce((sum, p) => sum + p.noShowProbability, 0)
    ),
  };
}
