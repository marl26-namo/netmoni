import { NextResponse } from "next/server";
import { sessionWorkspace } from "@/auth/store";
import { tenantMonitorStore } from "@/core/monitoring/store";
import { networkMonitor } from "@/core/monitoring/monitor";
import { PROBE_KINDS, type ProbeKind } from "@/core/monitoring/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const deviceId = url.searchParams.get("deviceId") ?? undefined;
    const limit = Number(url.searchParams.get("limit") ?? 100);
    const results = await tenantMonitorStore.listChecks(await sessionWorkspace(request), { deviceId, limit });
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load monitoring results" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { deviceId?: string; ip?: string; probe?: string; port?: number; community?: string };
    const probe = PROBE_KINDS.includes(body.probe as ProbeKind) ? (body.probe as ProbeKind) : "ping";
    const organizationId = await sessionWorkspace(request);
    const devices = await tenantMonitorStore.listDevices(organizationId);
    const target = devices.find((device) => (body.deviceId ? device.id === body.deviceId : device.ip === body.ip));
    if (!target) return NextResponse.json({ error: "Device not found" }, { status: 404 });
    const outcome = await networkMonitor.testDevice(organizationId, target, probe, { port: body.port, community: body.community });
    return NextResponse.json({ outcome });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Device test failed" }, { status: 400 });
  }
}
