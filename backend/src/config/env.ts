import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config();

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function parseDatabaseUrl() {
  const url = (process.env.DATABASE_URL ?? '').trim();

  if (!url) {
    return {
      type: 'postgres' as const,
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_NAME ?? 'examflow',
    };
  }

  return {
    type: 'postgres' as const,
    url,
    ssl: process.env.DB_SSL === 'false'
      ? false
      : { rejectUnauthorized: false },
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
