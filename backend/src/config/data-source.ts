import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env, dbConfig } from './env';
import { User } from '../entities/User';
import { Candidate } from '../entities/Candidate';
import { CareerGroup } from '../entities/CareerGroup';
import { Hall } from '../entities/Hall';
import { Seat } from '../entities/Seat';
import { Session } from '../entities/Session';
import { CandidateAssignment } from '../entities/CandidateAssignment';
import { ActivityLog } from '../entities/ActivityLog';
import { ScheduleMeta } from '../entities/ScheduleMeta';

export const entities = [
  User,
  Candidate,
  CareerGroup,
  Hall,
  Seat,
  Session,
  CandidateAssignment,
  ActivityLog,
  ScheduleMeta,
];

export const AppDataSource = new DataSource({
  entities,
  logging: false,
  synchronize: true,
  ...dbConfig,
  // Keep pool tiny on serverless — each cold start spawns its own pool.
  // Neon/Supabase free tiers cap at 20-50 connections total.
  extra: {
    pool: {
      min: 0,
      max: 3,
      acquireTimeoutMillis: 10_000,
      idleTimeoutMillis: 10_000,
    },
  },
});

export async function initDatabase(): Promise<DataSource> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  return AppDataSource;
}
