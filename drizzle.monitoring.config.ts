import { defineConfig } from "drizzle-kit";

const url = process.env.MONITORING_DATABASE_URL ?? "file:./mubas-netwatch.db";
const dialect = url.startsWith("postgres") ? "postgresql" : url.startsWith("mysql") ? "mysql" : "sqlite";
const schema =
  dialect === "postgresql"
    ? "./db/schema/monitoring-postgres.ts"
    : dialect === "mysql"
      ? "./db/schema/monitoring-mysql.ts"
      : "./db/schema/monitoring-sqlite.ts";

export default defineConfig({ dialect, schema, out: "./db/migrations/monitoring", dbCredentials: { url } });
