import { NextResponse } from "next/server";
import { getUser, sessionFromToken } from "@/auth/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = request.headers.get("cookie")?.match(/(?:^|; )netmoni_session=([^;]+)/)?.[1];
  const session = token ? await sessionFromToken(token) : undefined;
  const user = session ? await getUser(session.userId) : undefined;
  if (!session || !user) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({ authenticated: true, user: { id: user.id, email: user.email, name: user.name }, session });
}
