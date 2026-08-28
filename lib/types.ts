export type Role = 'superadmin' | 'admin' | 'operator' | 'viewer';

export interface User {
  id: string;
  email: string;
  role: Role;
  name: string | null;
  createdAt: string;
}

export interface CareerGroup {
  id: string;
  name: string;
  description: string | null;
  subjects: string[];
  candidateCount: number;
}

export type CandidateStatus = 'unscheduled' | 'scheduled' | 'completed';

export interface Candidate {
  id: string;
  name: string;
  email: string;
  matricNo: string | null;
  careerGroupId: string;
  careerGroup?: CareerGroup;
  status: CandidateStatus;
  assignedHallId: string | null;
  assignedSeatNumber: string | null;
  assignedSessionId: string | null;
  assignedExamDate: string | null;
  assignedHall?: Hall | null;
  assignedSession?: Session | null;
  createdAt: string;
}

export interface Hall {
  id: string;
  name: string;
  capacity: number;
  status: 'active' | 'disabled';
  createdAt: string;
  seatsTotal?: number;
  seatsOccupied?: number;
}

export interface Seat {
  id: string;
  seatNumber: string;
  status: 'available' | 'occupied' | 'reserved';
  candidateId: string | null;
}

export interface Session {
  id: string;
  name: string;
  examDate: string;
  startTime: string;
  endTime: string;
  createdAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface CandidateQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: CandidateStatus | '';
  careerGroupId?: string;
  hallId?: string;
  sessionId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ImportErrorRow {
  row: number;
  field?: string;
  message: string;
  raw: Record<string, string>;
}

export interface ImportPreview {
  importId: string;
  fileName: string;
  totalRows: number;
  validCount: number;
  duplicateCount: number;
  errorCount: number;
  errors: ImportErrorRow[];
  duplicates: string[];
  preview: Array<{ id: string; name: string; email: string; careerGroup: string }>;
  columns: string[];
  missingColumns: string[];
}

export interface ImportCommit {
  imported: number;
  skipped: number;
  errors: Array<{ email: string; reason: string }>;
  startedAt: string;
  finishedAt: string;
}

export interface GroupStat {
  careerGroupId: string;
  name: string;
  total: number;
  assigned: number;
  unassigned: number;
}

export interface SessionStat {
  sessionId: string;
  name: string;
  examDate: string;
  startTime: string;
  endTime: string;
  capacity: number;
  assigned: number;
  utilization: number;
}

export interface HallStat {
  hallId: string;
  name: string;
  code: string;
  capacity: number;
  assigned: number;
  utilization: number;
}

export interface PlanSummary {
  totalCandidates: number;
  assignedCount: number;
  unassignedCount: number;
  sessionsUsed: number;
  hallsUsed: number;
  byGroup: GroupStat[];
  bySession: SessionStat[];
  byHall: HallStat[];
  generatedAt: string;
}

export type ScheduleState = 'none' | 'draft' | 'confirmed';

export interface ScheduleCapacity {
  totalCandidates: number;
  totalCapacity: number;
  capacityPerSession: number;
  activeHallCount: number;
  selectedSessionCount: number;
  halls: Array<{ id: string; name: string; capacity: number }>;
}

export interface ScheduleStatus {
  status: ScheduleState;
  sessionIds: string[];
  generatedAt: string | null;
  confirmedAt: string | null;
  summary: PlanSummary | null;
  assignmentCount: number;
}

export interface SchedulePreviewGroup {
  session: { id: string; name: string; examDate: string; startTime: string; endTime: string };
  hall: { id: string; name: string; capacity: number };
  candidates: Array<{ candidateId: string; name: string; seatNumber: string; status: string }>;
}

export interface SchedulePreview {
  status: ScheduleState;
  summary: PlanSummary | null;
  generatedAt: string | null;
  confirmedAt: string | null;
  totalCapacity: number;
  groups: SchedulePreviewGroup[];
}

export interface CustomSubjectCombination {
  normalizedKey: string;
  displayName: string;
  careerGroupId: string | null;
  careerGroupName: string | null;
  subjects: string[];
  candidateCount: number;
}

export interface SavedCombination {
  id: string;
  displayName: string;
  subjects: string[];
  careerGroupId: string | null;
  firstChoice: string | null;
  candidateCount: number;
  createdBy: string;
  createdAt: string;
}

export interface CustomFirstChoiceStat {
  firstChoice: string;
  candidateCount: number;
  percentage: number;
}

export interface CustomSchedulingRules {
  allowHallReuse: boolean;
  allowSameDayHallReuse: boolean;
  seatSpacingEnabled: boolean;
  seatSpacingGap: number;
  maxCandidatesPerHall: number | null;
  sessionsPerDay: number | null;
  availableDates: string[] | null;
  automaticOverflow: boolean;
  overflowStrategy: 'sequential' | 'balanced';
  minBreakBetweenSessions: number;
}

export interface CustomSchedulingConfig {
  id: string;
  name: string;
  description: string | null;
  rules: CustomSchedulingRules;
  isActive: boolean;
  examPriorityOrder: string[] | null;
  firstChoicePriority: Record<string, string[]> | null;
  tieBreaker: TieBreakerRule | null;
}

export type TieBreakerRule = 'name_asc' | 'name_desc' | 'id_asc' | 'id_desc' | 'random';

export interface CustomCombinationAnalysis {
  subjectCombination: string;
  candidateCount: number;
  firstChoiceDistribution: CustomFirstChoiceStat[];
  statusBreakdown: {
    unscheduled: number;
    scheduled: number;
    completed: number;
  };
}

export interface ReschedulingQueueItem {
  id: string;
  candidateId: string;
  candidate?: { name?: string | null };
  subjectCombination: string;
  reason: string;
  status: string;
  notes: string | null;
}

export interface CustomSeatAssignment {
  candidateId: string;
  candidateName: string;
  seatNumber: string;
}

export interface CustomHallSchedule {
  hall: Hall;
  seats: CustomSeatAssignment[];
  totalAssigned: number;
}

export interface CustomSessionSchedule {
  session: Session;
  halls: CustomHallSchedule[];
  totalAssigned: number;
}

export interface CustomDaySchedule {
  dayNumber: number;
  date: string;
  sessions: CustomSessionSchedule[];
}

export interface CustomSchedulingPreview {
  subjectCombination: string;
  displayName: string;
  candidateCount: number;
  firstChoiceDistribution: CustomFirstChoiceStat[];
  availableHalls: Array<{ id: string; name: string; capacity: number }>;
  totalCapacityPerSession: number;
  sessions: Session[];
  estimatedDays: number;
  capacityUtilization: number;
  candidatesScheduled: number;
  candidatesOverflow: number;
  candidatesCannotSchedule: number;
  days: CustomDaySchedule[];
  overflowCandidates: string[];
  unschedulableCandidates: string[];
}

export interface CustomScheduleResult {
  runId: string;
  subjectCombination: string;
  displayName: string;
  candidateCount: number;
  scheduledCount: number;
  overflowCount: number;
  unschedulableCount: number;
  dayCount: number;
  days: CustomDaySchedule[];
  summary: Record<string, unknown>;
}

export interface ReschedulingEntry {
  id: string;
  candidateId: string;
  candidate?: { id: string; name: string; email: string };
  schedulingRunId: string | null;
  subjectCombination: string;
  reason: string;
  status: string;
  targetSessionId: string | null;
  targetHallId: string | null;
  targetSeatNumber: string | null;
  targetExamDate: string | null;
  assignedAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface RescheduleCandidateResult {
  candidateId: string;
  success: boolean;
  message: string;
  assignment?: {
    sessionId: string;
    hallId: string;
    seatNumber: string;
    examDate: string;
  };
}

export interface SchedulingRun {
  id: string;
  subjectCombination: string;
  careerGroupId: string | null;
  candidateCount: number;
  scheduledCount: number;
  overflowCount: number;
  conflictCount: number;
  dayCount: number;
  status: string;
  configUsed: Record<string, unknown> | null;
  summary: Record<string, unknown> | null;
  sessionIds: string[] | null;
  hallIds: string[] | null;
  generatedBy: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
  isPublished: boolean;
  createdAt: string;
}

// ─── Schedule Conflict ─────────────────────────────────────────────────────

export interface ScheduleConflict {
  id: string;
  schedulingRunId: string | null;
  candidateId: string;
  candidate?: { id: string; name: string; email: string };
  subjectCombination: string | null;
  firstChoice: string | null;
  conflictType: string;
  description: string;
  assignedSessionId: string | null;
  assignedHallId: string | null;
  assignedExamDate: string | null;
  assignedSeatNumber: string | null;
  status: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  createdAt: string;
}

// ─── Schedule History ──────────────────────────────────────────────────────

export interface ScheduleHistory {
  id: string;
  schedulingRunId: string;
  name: string;
  description: string | null;
  subjectCombination: string | null;
  candidateCount: number;
  scheduledCount: number;
  overflowCount: number;
  conflictCount: number;
  dayCount: number;
  snapshot: Record<string, unknown> | null;
  configSnapshot: Record<string, unknown> | null;
  publishedBy: string | null;
  publishedAt: string;
  createdAt: string;
}

// ─── Priority Config ───────────────────────────────────────────────────────

export interface PriorityConfig {
  id: string | null;
  name: string;
  examPriorityOrder: string[];
  firstChoicePriority: Record<string, string[]>;
  tieBreaker: TieBreakerRule | null;
  rules: CustomSchedulingRules | null;
}

// ─── Priority Scheduling Result ────────────────────────────────────────────

export interface NeedsAttentionItem {
  candidateId: string;
  candidateName: string;
  subjectCombination: string;
  firstChoice: string;
  reason: string;
  conflictType: string;
}

export interface PrioritySchedulingResult {
  runId: string;
  status: string;
  candidateCount: number;
  scheduledCount: number;
  overflowCount: number;
  conflictCount: number;
  dayCount: number;
  days: CustomDaySchedule[];
  needsAttention: NeedsAttentionItem[];
  examPriorityOrder: string[];
  firstChoicePriority: Record<string, string[]>;
  summary: Record<string, unknown>;
}

export interface AttendanceSheetRow {
  index: number;
  candidateId: string;
  name: string;
  careerGroup: string;
  seatNumber: string;
}

export interface AttendanceSheet {
  session: Session;
  hall: Hall;
  rows: AttendanceSheetRow[];
  total: number;
  generatedAt: string;
}

export interface SheetListing {
  sessionId: string;
  sessionName: string;
  examDate: string;
  startTime: string;
  endTime: string;
  hallId: string;
  hallName: string;
  capacity: number;
  candidates: number;
}

export interface AnalyticsGroupStat {
  id: string;
  name: string;
  total: number;
  scheduled: number;
  unscheduled: number;
  completed: number;
}

export interface AnalyticsHallStat {
  id: string;
  name: string;
  capacity: number;
  assigned: number;
  utilization: number;
}

export interface AnalyticsSessionStat {
  id: string;
  name: string;
  examDate: string;
  startTime: string;
  endTime: string;
  assigned: number;
  capacity: number;
  utilization: number;
}

export interface Analytics {
  candidates: { total: number; scheduled: number; unscheduled: number; completed: number };
  scheduledPct: number;
  completedPct: number;
  utilizationPct: number;
  scheduleStatus: ScheduleState;
  byGroup: AnalyticsGroupStat[];
  byHall: AnalyticsHallStat[];
  bySession: AnalyticsSessionStat[];
}

export interface ActivityEntry {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown> | null;
  timestamp: string;
  user: { id: string; email: string; name: string | null; role: Role } | null;
}

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}
