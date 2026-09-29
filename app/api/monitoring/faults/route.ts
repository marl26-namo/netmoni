import { NextResponse } from "next/server";
import { monitoringStore } from "@/core/monitoring/store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const faults = await monitoringStore.listFaults(200);
  const filtered = status ? faults.filter((fault) => fault.status === status) : faults;
  return NextResponse.json({ faults: filtered });
}

/** Acknowledge or resolve a fault from the dashboard. */
export async function PATCH(request: Request) {
  try {
    const body = await request.json() as { id?: string; action?: "acknowledge" | "resolve"; note?: string };
    if (!body.id || !body.action) return NextResponse.json({ error: "id and action are required" }, { status: 400 });
    if (body.action === "acknowledge") {
      const fault = await monitoringStore.updateFaultStatus(body.id, "acknowledged");
      return NextResponse.json({ fault });
    }
    const fault = await monitoringStore.resolveFault(body.id, new Date().toISOString(), body.note ?? "Resolved by administrator.");
    return NextResponse.json({ fault });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Update failed" }, { status: 400 });
  }
}
