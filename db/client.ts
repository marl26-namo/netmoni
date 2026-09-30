import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { config } from "@/config";
import * as schema from "@/db/schema";

export type NetMoniDatabase = ReturnType<typeof createDatabase>;

let cachedDatabase: NetMoniDatabase | null = null;

function createDatabase() {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  return { pool, db: drizzle(pool, { schema }) };
}

/**
 * Shared Drizzle + node-postgres client for the single NetMoni database.
 * The pool is created lazily on first access so importing this module never
 * opens connections (safe for build-time imports).
 */
export function getDatabase(): NetMoniDatabase {
  if (!cachedDatabase) cachedDatabase = createDatabase();
  return cachedDatabase;
}

/** Drizzle instance (schema-aware). */
export function db() {
  return getDatabase().db;
}

/** Raw pg pool — used by health checks and maintenance tooling. */
export function pool() {
  return getDatabase().pool;
}

export const database = { get db() { return db(); }, get pool() { return pool(); }, get dialect() { return "postgres" as const; } };
