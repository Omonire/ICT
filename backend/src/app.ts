import express, { Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { authenticate } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error';
import authRoutes from './routes/auth';
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
