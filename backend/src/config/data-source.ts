import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env } from './env';
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

const base = {
  entities,
  logging: false,
};

const synchronize = !env.isProd;

export const AppDataSource =
  env.dbType === 'sqlite'
    ? new DataSource({
        ...base,
        type: 'sqlite',
        database: env.dbFile,
        synchronize,
      })
    : new DataSource({
        ...base,
        type: 'postgres',
        host: env.dbHost,
        port: env.dbPort,
        username: env.dbUser,
        password: env.dbPassword,
        database: env.dbName,
        synchronize,
      });

export async function initDatabase(): Promise<DataSource> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  return AppDataSource;
}
