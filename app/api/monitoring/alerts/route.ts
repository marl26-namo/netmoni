import { NextResponse } from "next/server";
import { sessionWorkspace } from "@/auth/store";
import { tenantMonitorStore } from "@/core/monitoring/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const alerts = await tenantMonitorStore.listAlerts(await sessionWorkspace(request), { limit: 100 });
    return NextResponse.json({ alerts });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load alerts" }, { status: 500 });
  }
}
