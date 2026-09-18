import { NextResponse } from "next/server";
import { listUsers } from "@/auth/store";

export function GET() {
  return NextResponse.json({ users: listUsers() });
}