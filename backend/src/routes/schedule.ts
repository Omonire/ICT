import { Router } from 'express';
import {
  approve,
  capacity,
  clear,
  confirm,
  generate,
  getStatus,
  preview,
  subjectCombinations,
  listSubjects,
  combinationAnalysis,
  previewNew,
  generateNew,
  regenerateDayHandler,
  regenerateSessionHandler,
  reschedulingQueue,
  rescheduleCandidateHandler,
  rescheduleBulkHandler,
  listRuns,
  getRun,
  listConfigs,
  getActiveConfig,
  createConfig,
  updateConfig,
  activateConfig,
  deleteConfig,
} from '../controllers/schedule.controller';
import {
  getPriorityConfig,
  updateExamPriorityOrder,
  updateFirstChoicePriority,
  updateTieBreaker,
  priorityGenerate,
  getConflicts,
  resolveConflict,
  publish,
  getScheduleHistory,
  getScheduleHistoryById,
  duplicate,
} from '../controllers/priority.controller';
import { requireRole } from '../middleware/role';
import { validateBody } from '../middleware/validate';
import {
  scheduleApproveSchema,
  scheduleGenerateSchema,
  schedulingPreviewSchema,
  schedulingGenerateSchema,
  schedulingRegenerateDaySchema,
  schedulingRegenerateSessionSchema,
  rescheduleCandidateSchema,
  rescheduleBulkSchema,
  schedulingConfigCreateSchema,
  schedulingConfigUpdateSchema,
  updateExamPrioritySchema,
  updateFirstChoicePrioritySchema,
  updateTieBreakerSchema,
  publishScheduleSchema,
  duplicateScheduleSchema,
  resolveConflictSchema,
} from '../schemas';

const router = Router();

// ─── Legacy Endpoints ───────────────────────────────────────────────────────

router.get('/capacity', capacity);
router.get('/status', getStatus);
router.get('/preview', preview);
router.post('/generate', requireRole('superadmin', 'admin', 'operator'), validateBody(scheduleGenerateSchema), generate);
router.post('/approve', requireRole('superadmin', 'admin', 'operator'), validateBody(scheduleApproveSchema), approve);
router.post('/confirm', requireRole('superadmin', 'admin', 'operator'), confirm);
router.post('/clear', requireRole('superadmin', 'admin'), clear);

// ─── Scheduling Engine Endpoints ────────────────────────────────────────────

// Subject combination analysis
router.get('/subjects', listSubjects);
router.get('/subject-combinations', subjectCombinations);
router.get('/combination-analysis/:normalizedKey', combinationAnalysis);

// Preview and generate (new engine)
router.post('/preview-new', requireRole('superadmin', 'admin', 'operator'), validateBody(schedulingPreviewSchema), previewNew);
router.post('/generate-new', requireRole('superadmin', 'admin', 'operator'), validateBody(schedulingGenerateSchema), generateNew);

// Regeneration
router.post('/regenerate-day', requireRole('superadmin', 'admin', 'operator'), validateBody(schedulingRegenerateDaySchema), regenerateDayHandler);
router.post('/regenerate-session', requireRole('superadmin', 'admin', 'operator'), validateBody(schedulingRegenerateSessionSchema), regenerateSessionHandler);

// Rescheduling queue
router.get('/rescheduling-queue', reschedulingQueue);
router.post('/reschedule-candidate', requireRole('superadmin', 'admin', 'operator'), validateBody(rescheduleCandidateSchema), rescheduleCandidateHandler);
router.post('/reschedule-bulk', requireRole('superadmin', 'admin', 'operator'), validateBody(rescheduleBulkSchema), rescheduleBulkHandler);

// Scheduling runs
router.get('/runs', listRuns);
router.get('/runs/:id', getRun);

// Scheduling configurations
router.get('/configs', listConfigs);
router.get('/configs/active', getActiveConfig);
router.post('/configs', requireRole('superadmin', 'admin'), validateBody(schedulingConfigCreateSchema), createConfig);
router.put('/configs/:id', requireRole('superadmin', 'admin'), validateBody(schedulingConfigUpdateSchema), updateConfig);
router.post('/configs/:id/activate', requireRole('superadmin', 'admin'), activateConfig);
router.delete('/configs/:id', requireRole('superadmin', 'admin'), deleteConfig);

// ─── Priority Management Endpoints ──────────────────────────────────────────

router.get('/priority-config', getPriorityConfig);
router.post('/priority-config/exam-order', requireRole('superadmin', 'admin'), validateBody(updateExamPrioritySchema), updateExamPriorityOrder);
router.post('/priority-config/first-choice', requireRole('superadmin', 'admin'), validateBody(updateFirstChoicePrioritySchema), updateFirstChoicePriority);
router.post('/priority-config/tie-breaker', requireRole('superadmin', 'admin'), validateBody(updateTieBreakerSchema), updateTieBreaker);

// Priority-aware scheduling generation
router.post('/priority-generate', requireRole('superadmin', 'admin', 'operator'), priorityGenerate);

// ─── Conflicts / Needs Attention ────────────────────────────────────────────

router.get('/conflicts', getConflicts);
router.put('/conflicts/:id/resolve', requireRole('superadmin', 'admin', 'operator'), resolveConflict);

// ─── Publishing ─────────────────────────────────────────────────────────────

router.post('/publish', requireRole('superadmin', 'admin'), validateBody(publishScheduleSchema), publish);

// ─── Schedule History ───────────────────────────────────────────────────────

router.get('/history', getScheduleHistory);
router.get('/history/:id', getScheduleHistoryById);

// ─── Schedule Duplication ───────────────────────────────────────────────────

router.post('/duplicate', requireRole('superadmin', 'admin'), validateBody(duplicateScheduleSchema), duplicate);

// ─── AI Conflict Resolver ──────────────────────────────────────────────────

import { autoResolveConflicts, applyConflictResolution } from '../controllers/conflict-resolver.controller';
router.post('/auto-resolve-conflicts', requireRole('superadmin', 'admin', 'operator'), autoResolveConflicts);
router.post('/apply-conflict-resolution', requireRole('superadmin', 'admin', 'operator'), applyConflictResolution);

// ─── No-Show Prediction ────────────────────────────────────────────────────

import { predictNoShows } from '../services/no-show-predictor';
router.get('/no-show-prediction/:runId', requireRole('superadmin', 'admin', 'operator'), async (req, res) => {
  const predictions = await predictNoShows(req.params.runId);
  res.json({ data: predictions });
});

export default router;
