import BetterSqlite3 from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
import { Pool } from "pg";
import { createPool } from "mysql2/promise";
import { config } from "@/config";
import * as authSqliteSchema from "@/db/schema/auth-sqlite";
import * as authPostgresSchema from "@/db/schema/auth-postgres";
import * as authMysqlSchema from "@/db/schema/auth-mysql";
import * as tenantSqliteSchema from "@/db/schema/tenant-sqlite";
import * as tenantPostgresSchema from "@/db/schema/tenant-postgres";
import * as tenantMysqlSchema from "@/db/schema/tenant-mysql";

export type DatabaseDialect = "postgres" | "mysql" | "sqlite";
export type DatabaseScope = "auth" | "organization";
export type DatabaseClient = { dialect: DatabaseDialect; scope: DatabaseScope; url: string; db: unknown };

function dialectFor(url: string): DatabaseDialect {
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) return "postgres";
  if (url.startsWith("mysql://")) return "mysql";
  return "sqlite";
}

function sqlitePath(url: string) { return url.replace(/^file:/, "") || "./softcape.db"; }

export function createDatabase(url = config.authDatabase, scope: DatabaseScope = "auth"): DatabaseClient {
  const dialect = dialectFor(url);
  if (dialect === "postgres") {
    const pool = new Pool({ connectionString: url });
    return { dialect, scope, url, db: drizzlePostgres(pool, { schema: scope === "auth" ? authPostgresSchema : tenantPostgresSchema }) };
  }
  if (dialect === "mysql") {
    const pool = createPool(url);
    return { dialect, scope, url, db: drizzleMysql(pool, { mode: "default", schema: scope === "auth" ? authMysqlSchema : tenantMysqlSchema }) };
  }
  const sqlite = new BetterSqlite3(sqlitePath(url));
  return { dialect, scope, url, db: drizzleSqlite(sqlite, { schema: scope === "auth" ? authSqliteSchema : tenantSqliteSchema }) };
}

export const authDatabase = createDatabase(config.authDatabase, "auth");
export const database = authDatabase;
export function createOrganizationDatabase(url: string) { return createDatabase(url, "organization"); }
