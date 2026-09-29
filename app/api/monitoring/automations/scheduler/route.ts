import { NextResponse } from "next/server";
import { runDueAutomations } from "@/core/monitoring/automation-engine";

/** Scheduler tick: run every automation whose nextRunAt has passed. */
export async function POST() {
  try {
    const outcomes = await runDueAutomations();
    return NextResponse.json({ ran: outcomes.length, outcomes });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Scheduler failed" }, { status: 500 });
  }
}
