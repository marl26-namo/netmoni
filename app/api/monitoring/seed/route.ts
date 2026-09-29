import { NextResponse } from "next/server";
import { seedMonitoringData } from "@/core/monitoring/engine";

/** Bootstrap the simulated MUBAS topology, links, and fault scenarios. */
export async function POST() {
  try {
    const devices = await seedMonitoringData();
    return NextResponse.json({ seeded: true, devices: devices.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Seeding failed" }, { status: 500 });
  }
}
