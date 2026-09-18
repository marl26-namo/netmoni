import { NextResponse } from "next/server";
import { getUser, sessionFromToken } from "@/auth/store";

export function GET(request: Request) {
  const token = request.headers.get("cookie")?.match(/(?:^|; )softcape_session=([^;]+)/)?.[1];
  const session = token ? sessionFromToken(token) : undefined;
  const user = session ? getUser(session.userId) : undefined;
  if (!session || !user) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({ authenticated: true, user: { id: user.id, email: user.email, name: user.name }, session });
}