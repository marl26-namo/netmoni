import { NextResponse } from "next/server";
import { sessionWorkspace } from "@/auth/store";
import { networkMonitor } from "@/core/monitoring/monitor";
import { PROBE_KINDS, type ProbeKind } from "@/core/monitoring/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { probe?: string };
    const probe = PROBE_KINDS.includes(body.probe as ProbeKind) ? (body.probe as ProbeKind) : "ping";
    const outcomes = await networkMonitor.runCycle(await sessionWorkspace(request), probe);
    return NextResponse.json({ outcomes, ranAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Monitor cycle failed" }, { status: 500 });
  }
}
