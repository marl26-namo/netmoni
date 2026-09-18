import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createHash } from "node:crypto";
import BetterSqlite3 from "better-sqlite3";
import { config } from "@/config";

export type AuthUser = { id: string; email: string; passwordHash: string; name: string; status: "active"; createdAt: string };
export type OrganizationOwner = { id: string; name: string; createdAt: string; ownerUserId: string };

const users = new Map<string, AuthUser>();
const organizations = new Map<string, OrganizationOwner>();
const sqliteAuth = config.authDatabase.startsWith("file:") ? new BetterSqlite3(config.authDatabase.replace(/^file:/, "")) : null;

sqliteAuth?.exec(`
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS organization_members (organization_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', PRIMARY KEY (organization_id, user_id));
`);

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;
  const expected = Buffer.from(key, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createOwner(input: { name: string; email: string; password: string; organizationId: string; organizationName: string }) {
  const email = input.email.trim().toLowerCase();
  if (usersByEmail(email)) throw new Error("An account with that email already exists");
  const user: AuthUser = { id: `user-${randomBytes(8).toString("hex")}`, email, passwordHash: hashPassword(input.password), name: input.name.trim(), status: "active", createdAt: new Date().toISOString() };
  const organization: OrganizationOwner = { id: input.organizationId, name: input.organizationName.trim(), createdAt: new Date().toISOString(), ownerUserId: user.id };
  sqliteAuth?.prepare("INSERT INTO users (id, email, password_hash, name, status, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(user.id, user.email, user.passwordHash, user.name, user.status, user.createdAt);
  sqliteAuth?.prepare("INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)").run(organization.id, organization.name, organization.createdAt);
  sqliteAuth?.prepare("INSERT INTO organization_members (organization_id, user_id, role) VALUES (?, ?, ?)").run(organization.id, user.id, "owner");
  users.set(user.id, user);
  organizations.set(organization.id, organization);
  return { user, organization };
}

function rowToUser(row: Record<string, string> | undefined): AuthUser | undefined {
  if (!row) return undefined;
  return { id: row.id, email: row.email, passwordHash: row.password_hash, name: row.name, status: row.status as "active", createdAt: row.created_at };
}

export function usersByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const stored = sqliteAuth?.prepare("SELECT id, email, password_hash, name, status, created_at FROM users WHERE email = ?").get(normalized) as Record<string, string> | undefined;
  return rowToUser(stored) ?? [...users.values()].find((user) => user.email === normalized);
}
export function getUser(id: string) { return rowToUser(sqliteAuth?.prepare("SELECT id, email, password_hash, name, status, created_at FROM users WHERE id = ?").get(id) as Record<string, string> | undefined) ?? users.get(id); }
export function getOrganization(id: string) { return organizations.get(id); }
export function organizationForUser(userId: string) {
  const stored = sqliteAuth?.prepare("SELECT organization_id FROM organization_members WHERE user_id = ? ORDER BY organization_id LIMIT 1").get(userId) as { organization_id: string } | undefined;
  return stored?.organization_id;
}
export function organizationDetailsForUser(userId: string) {
  const stored = sqliteAuth?.prepare("SELECT o.id, o.name FROM organizations o INNER JOIN organization_members m ON m.organization_id = o.id WHERE m.user_id = ? ORDER BY o.created_at LIMIT 1").get(userId) as { id: string; name: string } | undefined;
  return stored ?? [...organizations.values()].find((organization) => organization.ownerUserId === userId);
}
export function listUsers() {
  const stored = sqliteAuth?.prepare("SELECT id, email, name, status, created_at FROM users ORDER BY created_at DESC").all() as Array<Record<string, string>> | undefined;
  return stored?.map((user) => ({ id: user.id, email: user.email, name: user.name, status: user.status, createdAt: user.created_at })) ?? [...users.values()].map((user) => ({ id: user.id, email: user.email, name: user.name, status: user.status, createdAt: user.createdAt }));
}

export function createSession(userId: string, organizationId: string) {
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 86_400_000).toISOString();
  const session = { id: `session-${randomBytes(8).toString("hex")}`, userId, workspaceId: organizationId, role: "owner" as const, expiresAt };
  sqliteAuth?.prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)").run(session.id, userId, createHash("sha256").update(token).digest("hex"), expiresAt, now.toISOString());
  return { token, session };
}

export function sessionFromToken(token: string) {
  const row = sqliteAuth?.prepare("SELECT id, user_id, expires_at FROM sessions WHERE token_hash = ?").get(createHash("sha256").update(token).digest("hex")) as { id: string; user_id: string; expires_at: string } | undefined;
  if (!row || new Date(row.expires_at) <= new Date()) return undefined;
  return { userId: row.user_id, sessionId: row.id, expiresAt: row.expires_at };
}
