import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { monitoringStore } from "@/core/monitoring/store";

export async function GET() {
  const [devices, links] = await Promise.all([monitoringStore.listDevices(), monitoringStore.listLinks()]);
  return NextResponse.json({ devices, links });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      name?: string;
      kind?: string;
      role?: string;
      ipAddress?: string;
      subnet?: string;
      location?: string;
      model?: string;
      pollIntervalSeconds?: number;
      timeoutSeconds?: number;
      latencyBaselineMs?: number;
      congestionThreshold?: number;
    };
    if (!body.name || !body.kind || !body.ipAddress) {
      return NextResponse.json({ error: "name, kind, and ipAddress are required" }, { status: 400 });
    }
    const device = await monitoringStore.upsertDevice({
      id: randomUUID(),
      name: body.name,
      kind: body.kind,
      role: body.role ?? "access",
      ipAddress: body.ipAddress,
      subnet: body.subnet ?? "192.168.1.0/24",
      location: body.location ?? "campus",
      model: body.model ?? null,
      pollIntervalSeconds: body.pollIntervalSeconds,
      timeoutSeconds: body.timeoutSeconds,
      latencyBaselineMs: body.latencyBaselineMs,
      congestionThreshold: body.congestionThreshold,
      status: "unknown",
    });
    return NextResponse.json({ device }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid device" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  // Devices are soft-disabled to preserve poll history integrity.
  const device = await monitoringStore.getDevice(id);
  if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 });
  await monitoringStore.updateDeviceStatus(id, "disabled", device.lastSeenAt);
  return NextResponse.json({ ok: true });
}
