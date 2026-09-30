import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createOwner, createSession } from "@/auth/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json() as { name?: string; ownerName?: string; ownerEmail?: string; ownerPassword?: string; confirmPassword?: string; databaseUrl?: string };
  if (!body.name?.trim() || !body.ownerName?.trim() || !body.ownerEmail?.trim() || !body.ownerPassword) {
    return NextResponse.json({ error: "Organization name, owner name, email, and password are required" }, { status: 400 });
  }
  if (body.ownerPassword.length < 8) return NextResponse.json({ error: "Owner password must be at least 8 characters" }, { status: 400 });
  if (body.confirmPassword !== undefined && body.ownerPassword !== body.confirmPassword) {
    return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
  }
  const id = `${body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "organization"}-${randomUUID().slice(0, 6)}`;
  try {
    const result = await createOwner({ name: body.ownerName, email: body.ownerEmail, password: body.ownerPassword, organizationId: id, organizationName: body.name });
    const session = await createSession(result.user.id, result.organization.id);
    const response = NextResponse.json({ organization: result.organization, owner: { id: result.user.id, email: result.user.email, name: result.user.name }, session: session.session }, { status: 201 });
    response.cookies.set("netmoni_session", session.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 86_400, path: "/" });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create owner account" }, { status: 409 });
  }
}
