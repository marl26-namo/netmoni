import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit config for the NetMoni monitoring tables. Set MONITORING_DATABASE_URL
 * (or fall back to AUTH_DATABASE_URL) to a postgres://, mysql:// or file: URL and run:
 *
 *   npm run db:generate:monitoring   # emit SQL migration
 *   npm run db:migrate:monitoring    # apply the migration to the database
 *
 * The same pipeline handles SQLite, PostgreSQL and MySQL: the URL decides the
 * dialect and which schema file drizzle-kit reads.
 */
const url = process.env.MONITORING_DATABASE_URL ?? process.env.AUTH_DATABASE_URL ?? "file:./softcape-auth.db";
const dialect = url.startsWith("postgres") ? "postgresql" : url.startsWith("mysql") ? "mysql" : "sqlite";
const schema =
  dialect === "postgresql"
    ? "./db/schema/monitoring-postgres.ts"
    : dialect === "mysql"
      ? "./db/schema/monitoring-mysql.ts"
      : "./db/schema/monitoring-sqlite.ts";

export default defineConfig({ dialect, schema, out: "./db/migrations/monitoring", dbCredentials: { url } });
