export type UserRole = "owner" | "admin" | "builder" | "viewer";
export type Session = { userId: string; workspaceId: string; role: UserRole; expiresAt: string };

export function createLocalSession(userId = "local-user", workspaceId = "local-workspace"): Session {
  return { userId, workspaceId, role: "owner", expiresAt: new Date(Date.now() + 86_400_000).toISOString() };
}
