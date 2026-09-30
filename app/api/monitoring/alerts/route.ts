import { NextResponse } from "next/server";
import { sessionWorkspaceId } from "@/auth/store";
import { tenantMonitorStore } from "@/core/monitoring/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const alerts = await tenantMonitorStore.listAlerts(sessionWorkspaceId(request), { limit: 100 });
    return NextResponse.json({ alerts });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load alerts" }, { status: 500 });
  }
}
