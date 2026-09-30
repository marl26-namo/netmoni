import { NextResponse } from "next/server";
import { listUsers } from "@/auth/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const users = await listUsers();
  return NextResponse.json({ users });
}
