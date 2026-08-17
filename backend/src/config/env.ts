import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config();

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DatabaseConstructor = new (...args: any[]) => any;

export interface LibsqlDbConfig {
  type: 'better-sqlite3';
  /**
   * Placeholder path — TypeORM's better-sqlite3 driver only uses this for
   * directory-creation and attach-logic bookkeeping; it never opens this file.
   * The real connection target is captured inside the `driver` wrapper.
   */
  database: string;
  /**
   * Wrapper constructor that returns a libsql `Database` connected to either
   * Turso Cloud (libsql://… + auth token) or a local libSQL/SQLite file.
   */
  driver: DatabaseConstructor;
  enableWAL?: boolean;
}

const DEFAULT_LOCAL_DB = path.resolve(__dirname, '../../data/examflow.sqlite');
const PLACEHOLDER_DB = ':memory:';

function toLocalPath(value: string): string {
  const filePath = value
    .replace(/^(sqlite|file):/, '')
    .replace(/^\/\//, '');
  if (!filePath) return DEFAULT_LOCAL_DB;
  return path.isAbsolute(filePath)
    ? filePath
    : path.resolve(__dirname, '../../', filePath);
}

function parseDatabaseUrl(): LibsqlDbConfig {
  const url = (process.env.DATABASE_URL ?? '').trim();
  const authToken = process.env.TURSO_AUTH_TOKEN;

  const isTurso =
    url.startsWith('libsql://') ||
    url.startsWith('http://') ||
    url.startsWith('https://');

  // Determine the real connection target.
  //   Turso remote  → the libsql:// URL itself
  //   Local file    → resolved filesystem path
  //   Empty / unset → default local file
  const connectionUrl = url
    ? isTurso
      ? url
      : toLocalPath(url)
    : DEFAULT_LOCAL_DB;

  // TypeORM's better-sqlite3 driver calls:
  //   new driver(database, { readonly, fileMustExist, timeout, … })
  // and expects a better-sqlite3-compatible Database instance.
  // libsql's Database is a drop-in replacement.
  const driver = (function LibsqlDriverConstructor() {
    // Lazy-load the native module so that it doesn't interfere with
    // reflect-metadata import ordering during the boot sequence.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const LibsqlDatabase = require('libsql');
    const opts = authToken ? { authToken } : undefined;
    const db = new LibsqlDatabase(connectionUrl, opts);

    // TypeORM calls `db.pragma("foreign_keys = ON")` and other PRAGMAs
    // unconditionally. libsql remote connections don't support all PRAGMAs,
    // so on Turso we silently swallow any errors.
    if (isTurso) {
      const originalPragma = db.pragma.bind(db);
      db.pragma = (...args: unknown[]) => {
        try {
          return originalPragma(...args);
        } catch {
          return [];
        }
      };
    }

    return db;
  }) as unknown as DatabaseConstructor;

  return {
    type: 'better-sqlite3',
    database: PLACEHOLDER_DB,
    driver,
    // WAL mode improves performance for local files but is managed
    // server-side by Turso, so we only enable it locally.
    enableWAL: !isTurso,
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
