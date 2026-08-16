import dotenv from 'dotenv';
import path from 'path';
import { URL } from 'url';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config();

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

interface PostgresDbConfig {
  type: 'postgres';
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

interface SqliteDbConfig {
  type: 'sqlite';
  database: string;
}

type DbConfig = PostgresDbConfig | SqliteDbConfig;

function parseDatabaseUrl(): DbConfig {
  const url = process.env.DATABASE_URL;

  if (url && (url.startsWith('postgres://') || url.startsWith('postgresql://'))) {
    const parsed = new URL(url);
    return {
      type: 'postgres',
      host: parsed.hostname || 'localhost',
      port: Number(parsed.port) || 5432,
      username: parsed.username || 'postgres',
      password: parsed.password || '',
      database: parsed.pathname.replace(/^\//, '') || 'examflow',
    };
  }

  if (url && url.startsWith('sqlite:')) {
    const filePath = url.replace(/^sqlite:/, '').replace(/^\/\//, '');
    const resolved = filePath.startsWith('/')
      ? filePath
      : path.resolve(__dirname, '../../', filePath);
    return { type: 'sqlite', database: resolved };
  }

  // Fallback: individual DB_* vars or default sqlite
  const dbType = (process.env.DB_TYPE ?? 'sqlite') as 'postgres' | 'sqlite';

  if (dbType === 'postgres') {
    return {
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME ?? 'examflow',
    };
  }

  return {
    type: 'sqlite',
    database: process.env.DB_FILE ?? path.resolve(__dirname, '../../data/examflow.sqlite'),
  };
}

export const dbConfig = parseDatabaseUrl();

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  isProd: (process.env.NODE_ENV ?? 'development') === 'production',

  dbType: dbConfig.type,

  jwtSecret: process.env.JWT_SECRET ?? 'insecure-dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  cookieSecure: bool(process.env.COOKIE_SECURE, false),

  seedOnStartup: bool(process.env.SEED_ON_STARTUP, true),
};

export type Env = typeof env;
