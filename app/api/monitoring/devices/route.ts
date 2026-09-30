import { NextResponse } from "next/server";
import { monitoringStore } from "@/monitoring/store";

function organizationIdOf(request: Request) {
  return new URL(request.url).searchParams.get("organizationId") ?? "local-workspace";
}

/** GET /api/monitoring/devices?organizationId=… */
export async function GET(request: Request) {
  const organizationId = organizationIdOf(request);
  const devices = await monitoringStore.listDevices(organizationId);
  return NextResponse.json({ devices });
}

/** POST /api/monitoring/devices — register a monitoring device. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      organizationId?: string;
      id?: string;
      name?: string;
      ipAddress?: string;
      subnet?: string;
      mac?: string;
      kind?: string;
      location?: string;
    };
    if (!body.name?.trim() || !body.ipAddress?.trim()) {
      return NextResponse.json({ error: "Device name and IP address are required" }, { status: 400 });
    }
    const device = await monitoringStore.saveDevice({
      organizationId: body.organizationId ?? "local-workspace",
      id: body.id,
      name: body.name.trim(),
      ipAddress: body.ipAddress.trim(),
      subnet: body.subnet?.trim() || undefined,
      mac: body.mac?.trim() || undefined,
      kind: (body.kind ?? "router") as "router" | "switch" | "server" | "firewall" | "printer" | "access-point",
      location: body.location?.trim() || undefined,
    });
    return NextResponse.json({ device }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save device" }, { status: 400 });
  }
}

/** DELETE /api/monitoring/devices?organizationId=…&deviceId=… */
export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId") ?? "local-workspace";
  const deviceId = url.searchParams.get("deviceId");
  if (!deviceId) return NextResponse.json({ error: "deviceId is required" }, { status: 400 });
  await monitoringStore.deleteDevice(organizationId, deviceId);
  return NextResponse.json({ deleted: deviceId });
}
