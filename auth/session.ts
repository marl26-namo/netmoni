export type UserRole = "owner" | "admin" | "builder" | "viewer";
export type Session = { userId: string; workspaceId: string; role: UserRole; expiresAt: string };
