import { defineConfig } from "drizzle-kit";

const url = process.env.ORGANIZATION_DATABASE_URL ?? "file:./softcape-organization.db";
const dialect = url.startsWith("postgres") ? "postgresql" : url.startsWith("mysql") ? "mysql" : "sqlite";
const schema = dialect === "postgresql" ? "./db/schema/tenant-postgres.ts" : dialect === "mysql" ? "./db/schema/tenant-mysql.ts" : "./db/schema/tenant-sqlite.ts";

export default defineConfig({ dialect, schema, out: "./db/migrations/tenant", dbCredentials: { url } });
