import { NextResponse } from "next/server";
import { publishEvent } from "@/core/runtime";

export async function POST(request: Request) {
  const body = await request.json() as { type?: string; payload?: Record<string, unknown>; source?: string };
  if (!body.type) return NextResponse.json({ error: "Event type is required" }, { status: 400 });
  return NextResponse.json(await publishEvent(body.type, body.payload ?? {}, body.source ?? "api"), { status: 202 });
}
