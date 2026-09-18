import { defineConfig } from "drizzle-kit";

const url = process.env.AUTH_DATABASE_URL ?? "file:./softcape-auth.db";
const dialect = url.startsWith("postgres") ? "postgresql" : url.startsWith("mysql") ? "mysql" : "sqlite";
const schema = dialect === "postgresql" ? "./db/schema/auth-postgres.ts" : dialect === "mysql" ? "./db/schema/auth-mysql.ts" : "./db/schema/auth-sqlite.ts";

export default defineConfig({ dialect, schema, out: "./db/migrations/auth", dbCredentials: { url } });
