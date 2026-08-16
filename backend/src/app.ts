import 'reflect-metadata';
import express, { Express } from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { AppDataSource, initDatabase } from './config/data-source';
import { runSeed } from './services/seeding';
import { authenticate } from './middleware/auth';
import { maintenanceMiddleware } from './middleware/maintenance';
import { errorHandler, notFoundHandler } from './middleware/error';
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import candidateRoutes from './routes/candidates';
import hallRoutes from './routes/halls';
import sessionRoutes from './routes/sessions';
import careerGroupRoutes from './routes/career-groups';
import seatRoutes from './routes/seats';
import scheduleRoutes from './routes/schedule';
import attendanceRoutes from './routes/attendance';
import analyticsRoutes from './routes/analytics';
import activityRoutes from './routes/activity';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    cors({
      origin: env.isProd ? (process.env.FRONTEND_ORIGIN?.split(',') ?? true) : true,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'examflow-api', time: new Date().toISOString() });
  });

  // Public routes
  app.use('/api/auth', authRoutes);

  // Everything below requires an authenticated session.
  app.use('/api', authenticate);
  app.use('/api', maintenanceMiddleware);
  app.use('/api/admin', adminRoutes);
  app.use('/api/candidates', candidateRoutes);
  app.use('/api/halls', hallRoutes);
  app.use('/api/sessions', sessionRoutes);
  app.use('/api/career-groups', careerGroupRoutes);
  app.use('/api/seats', seatRoutes);
  app.use('/api/schedule', scheduleRoutes);
  app.use('/api/attendance-sheets', attendanceRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/activity-log', activityRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

// ─────────────────────────────────────────────────────────────
// Vercel serverless entry
//
// Vercel's Node adapter requires a default export that is a
// function or server. We lazy-initialize the DataSource (creating
// the schema — there are no migrations — and seeding on cold start)
// and then hand the request to the Express app.
// ─────────────────────────────────────────────────────────────

let cachedApp: Express | null = null;
let dbReady: Promise<void> | null = null;

async function ensureReady(): Promise<void> {
  if (!dbReady) {
    dbReady = (async () => {
      if (!AppDataSource.isInitialized) {
        await initDatabase();
        // No migrations exist yet — keep schema in sync in production.
        await AppDataSource.synchronize();
      }
      if (env.seedOnStartup) {
        await runSeed();
      }
    })();
  }
  try {
    await dbReady;
  } catch (err) {
    dbReady = null;
    throw err;
  }
}

export default async function handler(req: Request, res: Response): Promise<void> {
  await ensureReady();
  if (!cachedApp) cachedApp = createApp();
  return cachedApp(req, res);
}
