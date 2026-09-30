import { NextResponse } from "next/server";
import { sessionWorkspaceId } from "@/auth/store";
import { tenantMonitorStore } from "@/core/monitoring/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const devices = await tenantMonitorStore.listDevices(sessionWorkspaceId(request));
    return NextResponse.json({ devices });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load devices" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: string; ip?: string; subnet?: string; mac?: string; type?: string };
    if (!body.name?.trim() || !body.ip?.trim()) return NextResponse.json({ error: "Device name and IP address are required" }, { status: 400 });
    const device = await tenantMonitorStore.createDevice(sessionWorkspaceId(request), { name: body.name.trim(), ip: body.ip.trim(), subnet: body.subnet, mac: body.mac, type: body.type });
    return NextResponse.json({ device }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not add device" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const deviceId = url.searchParams.get("id");
    const ip = url.searchParams.get("ip");
    if (!deviceId && !ip) return NextResponse.json({ error: "Device id or ip is required" }, { status: 400 });
    const organizationId = sessionWorkspaceId(request);
    const devices = await tenantMonitorStore.listDevices(organizationId);
    const target = devices.find((device) => (deviceId ? device.id === deviceId : device.ip === ip));
    if (!target) return NextResponse.json({ error: "Device not found" }, { status: 404 });
    await tenantMonitorStore.deleteDevice(organizationId, target.id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not remove device" }, { status: 400 });
  }
}
