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

const synchronize = !env.isProd;

export const AppDataSource = new DataSource({
  entities,
  logging: false,
  synchronize,
  ...dbConfig,
});

export async function initDatabase(): Promise<DataSource> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  return AppDataSource;
}
