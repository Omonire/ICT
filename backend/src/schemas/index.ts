import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).max(120).optional(),
  role: z.enum(['superadmin', 'admin', 'operator', 'viewer']).default('operator'),
});

export const candidateCreateSchema = z.object({
  name: z.string().min(2).max(160),
  email: z.string().email(),
  matricNo: z.string().max(40).optional().nullable(),
  careerGroupId: z.string().uuid(),
});

export const candidateUpdateSchema = candidateCreateSchema.partial();

export const hallCreateSchema = z.object({
  name: z.string().min(2).max(40),
  capacity: z.number().int().min(10).max(1000000),
  status: z.enum(['active', 'disabled']).default('active'),
});

export const hallUpdateSchema = hallCreateSchema.partial();

export const sessionCreateSchema = z.object({
  name: z.string().min(2).max(40),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'examDate must be YYYY-MM-DD'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'startTime must be HH:mm'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'endTime must be HH:mm'),
});

export const sessionUpdateSchema = sessionCreateSchema.partial();

export const careerGroupCreateSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(255).optional().nullable(),
  subjects: z.array(z.string()).optional(),
});

export const importCandidateRow = z.object({
  name: z.string().min(2, 'Name is required (min 2 chars)'),
  email: z.string().email('Invalid email'),
  matricNo: z.string().optional().nullable(),
  careerGroup: z.string().min(1, 'Career group is required'),
  jambSubjects: z.array(z.string()).optional().nullable(),
  firstChoice: z.string().optional().nullable(),
});

export const scheduleGenerateSchema = z.object({
  sessionIds: z.array(z.string().uuid()).min(1, 'Select at least one session'),
  candidateIds: z.array(z.string()).optional(),
  strict: z.boolean().optional().default(false),
});

export const scheduleApproveSchema = z.object({
  mode: z.enum(['auto', 'manual']),
  candidateIds: z.array(z.string()).optional(),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).optional().default(25),
  search: z.string().max(200).optional(),
  status: z.string().max(30).optional(),
  careerGroupId: z.string().uuid().optional(),
  hallId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  sortBy: z.string().max(40).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const seedForSessionSchema = z.object({
  sessionId: z.string().min(1, 'Session is required'),
  count: z.number().int().min(1).max(5000).default(50),
});

// ─── Scheduling Engine Schemas ──────────────────────────────────────────────

export const schedulingPreviewSchema = z.object({
  subjectCombination: z.string().min(1).optional(),
  subjectCombinations: z.array(z.string().min(1)).optional(),
  sessionIds: z.array(z.string().uuid()).min(1, 'Select at least one session'),
  configId: z.string().uuid().optional(),
}).refine((d) => d.subjectCombination || (d.subjectCombinations && d.subjectCombinations.length > 0), {
  message: 'Select at least one subject combination',
});

export const schedulingGenerateSchema = z.object({
  subjectCombination: z.string().min(1).optional(),
  subjectCombinations: z.array(z.string().min(1)).optional(),
  sessionIds: z.array(z.string().uuid()).min(1, 'Select at least one session'),
  configId: z.string().uuid().optional(),
}).refine((d) => d.subjectCombination || (d.subjectCombinations && d.subjectCombinations.length > 0), {
  message: 'Select at least one subject combination',
});

export const schedulingRegenerateDaySchema = z.object({
  runId: z.string().uuid(),
  dayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dayDate must be YYYY-MM-DD'),
});

export const schedulingRegenerateSessionSchema = z.object({
  runId: z.string().uuid(),
  sessionId: z.string().uuid(),
});

export const rescheduleCandidateSchema = z.object({
  entryId: z.string().uuid(),
  targetSessionId: z.string().uuid(),
  targetHallId: z.string().uuid(),
});

export const rescheduleBulkSchema = z.object({
  entryIds: z.array(z.string().uuid()).min(1, 'Select at least one entry'),
  targetSessionId: z.string().uuid(),
  targetHallId: z.string().uuid(),
});

export const schedulingConfigCreateSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(255).optional().nullable(),
  rules: z.object({
    allowHallReuse: z.boolean().optional(),
    allowSameDayHallReuse: z.boolean().optional(),
    seatSpacingEnabled: z.boolean().optional(),
    seatSpacingGap: z.number().int().min(0).optional(),
    maxCandidatesPerHall: z.number().int().min(1).optional().nullable(),
    sessionsPerDay: z.number().int().min(1).optional().nullable(),
    availableDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable(),
    automaticOverflow: z.boolean().optional(),
    overflowStrategy: z.enum(['sequential', 'balanced']).optional(),
    minBreakBetweenSessions: z.number().int().min(0).optional(),
  }).optional(),
  examPriorityOrder: z.array(z.string()).optional().nullable(),
  firstChoicePriority: z.record(z.string(), z.array(z.string())).optional().nullable(),
  tieBreaker: z.enum(['name_asc', 'name_desc', 'id_asc', 'id_desc', 'random']).optional().nullable(),
});

export const schedulingConfigUpdateSchema = schedulingConfigCreateSchema.partial();

// ─── Priority Management Schemas ──────────────────────────────────────────

export const updateExamPrioritySchema = z.object({
  examPriorityOrder: z.array(z.string()).min(1, 'At least one combination required'),
});

export const updateFirstChoicePrioritySchema = z.object({
  normalizedKey: z.string().min(1, 'Normalized key is required'),
  priority: z.array(z.string()).min(1, 'At least one programme required'),
});

export const updateTieBreakerSchema = z.object({
  tieBreaker: z.enum(['name_asc', 'name_desc', 'id_asc', 'id_desc', 'random']),
});

// ─── Publishing Schemas ───────────────────────────────────────────────────

export const publishScheduleSchema = z.object({
  runId: z.string().uuid(),
  name: z.string().min(1).max(160),
  description: z.string().max(500).optional().nullable(),
});

// ─── Schedule Duplication Schema ──────────────────────────────────────────

export const duplicateScheduleSchema = z.object({
  runId: z.string().uuid(),
  mode: z.enum(['keep_assignments', 'recalculate']),
  name: z.string().min(1).max(160).optional(),
});

// ─── Conflict Resolution Schema ───────────────────────────────────────────

export const resolveConflictSchema = z.object({
  conflictId: z.string().uuid(),
  status: z.enum(['resolved', 'ignored']),
  resolutionNotes: z.string().max(500).optional().nullable(),
});
