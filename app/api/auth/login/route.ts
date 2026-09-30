import { NextResponse } from "next/server";
import { createSession, organizationDetailsForUser, organizationForUser, usersByEmail, verifyPassword } from "@/auth/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json() as { email?: string; password?: string };
  if (!body.email || !body.password) return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  const user = await usersByEmail(body.email);
  if (!user || !verifyPassword(body.password, user.passwordHash) || user.status !== "active") {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  const result = await createSession(user.id, (await organizationForUser(user.id)) ?? "organization-owner");
  const organization = await organizationDetailsForUser(user.id);
  const response = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name }, organization, session: result.session });
  response.cookies.set("netmoni_session", result.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 86_400, path: "/" });
  return response;
}
