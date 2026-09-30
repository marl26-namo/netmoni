import { NextResponse } from "next/server";
import { sessionWorkspaceId } from "@/auth/store";
import { tenantMonitorStore } from "@/core/monitoring/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const settings = await tenantMonitorStore.getSettings(sessionWorkspaceId(request));
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load settings" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const organizationId = sessionWorkspaceId(request);
    const settings = await tenantMonitorStore.saveSettings(organizationId, {
      ...(body.intervalSeconds !== undefined ? { intervalSeconds: Number(body.intervalSeconds) } : {}),
      ...(body.failureThreshold !== undefined ? { failureThreshold: Number(body.failureThreshold) } : {}),
      ...(body.latencyWarningMs !== undefined ? { latencyWarningMs: Number(body.latencyWarningMs) } : {}),
      ...(body.packetLossWarningPercent !== undefined ? { packetLossWarningPercent: Number(body.packetLossWarningPercent) } : {}),
      ...(body.bandwidthWarningMbps !== undefined ? { bandwidthWarningMbps: Number(body.bandwidthWarningMbps) } : {}),
      ...(body.adminEmail !== undefined ? { adminEmail: String(body.adminEmail) } : {}),
      ...(body.aiProvider !== undefined ? { aiProvider: String(body.aiProvider) } : {}),
      ...(body.aiModel !== undefined ? { aiModel: String(body.aiModel) } : {}),
      ...(body.aiInstruction !== undefined ? { aiInstruction: String(body.aiInstruction) } : {}),
    });
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save settings" }, { status: 400 });
  }
}
