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
