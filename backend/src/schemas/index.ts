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
