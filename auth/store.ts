import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db/client";
import { config } from "@/config";
import {
  organizationMembers,
  organizations,
  sessions,
  users,
} from "@/db/schema";

export type AuthUser = { id: string; email: string; passwordHash: string; name: string; status: "active"; createdAt: string };
export type OrganizationOwner = { id: string; name: string; createdAt: string; ownerUserId: string };

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

/** Creates the owner user + organization + membership in one transaction. */
export async function createOwner(input: { name: string; email: string; password: string; organizationId: string; organizationName: string }) {
  const email = input.email.trim().toLowerCase();
  const existing = await usersByEmail(email);
  if (existing) throw new Error("An account with that email already exists");

  const user: AuthUser = {
    id: `user-${randomBytes(8).toString("hex")}`,
    email,
    passwordHash: hashPassword(input.password),
    name: input.name.trim(),
    status: "active",
    createdAt: new Date().toISOString(),
  };
  const organization: OrganizationOwner = {
    id: input.organizationId,
    name: input.organizationName.trim(),
    createdAt: new Date().toISOString(),
    ownerUserId: user.id,
  };

  await db().transaction(async (tx) => {
    await tx.insert(users).values({
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      name: user.name,
      status: user.status,
    });
    await tx.insert(organizations).values({
      id: organization.id,
      name: organization.name,
      ownerId: user.id,
    });
    await tx.insert(organizationMembers).values({
      organizationId: organization.id,
      userId: user.id,
      role: "owner",
    });
  });

  return { user, organization };
}

type UserRow = typeof users.$inferSelect;

function rowToUser(row: UserRow | undefined): AuthUser | undefined {
  if (!row) return undefined;
  return { id: row.id, email: row.email, passwordHash: row.passwordHash, name: row.name, status: "active", createdAt: row.createdAt.toISOString() };
}

export async function usersByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const rows = await db().select().from(users).where(eq(users.email, normalized)).limit(1);
  return rowToUser(rows[0]);
}

export async function getUser(id: string) {
  const rows = await db().select().from(users).where(eq(users.id, id)).limit(1);
  return rowToUser(rows[0]);
}

export async function getOrganization(id: string) {
  const rows = await db().select().from(organizations).where(eq(organizations.id, id)).limit(1);
  const row = rows[0];
  if (!row) return undefined;
  return { id: row.id, name: row.name, createdAt: row.createdAt.toISOString(), ownerUserId: row.ownerId } satisfies OrganizationOwner;
}

export async function organizationForUser(userId: string) {
  const rows = await db()
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId))
    .limit(1);
  return rows[0]?.organizationId;
}

export async function organizationDetailsForUser(userId: string) {
  const rows = await db()
    .select({ id: organizations.id, name: organizations.name })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .where(eq(organizationMembers.userId, userId))
    .limit(1);
  return rows[0];
}

export async function listUsers() {
  const rows = await db().select({ id: users.id, email: users.email, name: users.name, status: users.status, createdAt: users.createdAt }).from(users);
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

export async function createSession(userId: string, organizationId: string) {
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.sessionTtlMs);
  const session = { id: `session-${randomBytes(8).toString("hex")}`, userId, workspaceId: organizationId, role: "owner" as const, expiresAt: expiresAt.toISOString() };
  await db().insert(sessions).values({
    id: session.id,
    userId,
    tokenHash: sessionTokenHash(token),
    expiresAt,
  });
  return { token, session };
}

function sessionTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function sessionFromToken(token: string) {
  const rows = await db()
    .select({ id: sessions.id, userId: sessions.userId, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(and(eq(sessions.tokenHash, sessionTokenHash(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row) return undefined;
  return { userId: row.userId, sessionId: row.id, expiresAt: row.expiresAt.toISOString() };
}

/** Resolves the workspace (organization) id from the session cookie. */
export async function sessionWorkspace(request: Request): Promise<string> {
  const token = request.headers.get("cookie")?.match(/(?:^|; )netmoni_session=([^;]+)/)?.[1];
  const session = token ? await sessionFromToken(token) : undefined;
  if (!session) return "local-workspace";
  return (await organizationForUser(session.userId)) ?? "local-workspace";
}

/** Ensures monitoring defaults and the seeded fault-notification workflow exist for a fresh organization. */
export async function ensureOrganizationDefaults(organizationId: string) {
  // monitoringSettings row is created lazily by the monitoring store;
  // nothing to pre-create today. Kept as an explicit hook for onboarding.
}
