import { NextResponse } from "next/server";
import { monitoringStore } from "@/core/monitoring/store";
import { runTrial } from "@/core/monitoring/engine";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scenarioId = searchParams.get("scenarioId") ?? undefined;
  const trials = await monitoringStore.listTrials(scenarioId);
  return NextResponse.json({ trials });
}

/** Run one experimental trial (prototype vs manual monitoring arm). */
export async function POST(request: Request) {
  try {
    const body = await request.json() as { scenarioId?: string; monitor?: "prototype" | "manual" };
    if (!body.scenarioId) return NextResponse.json({ error: "scenarioId is required" }, { status: 400 });
    const result = await runTrial(body.scenarioId, body.monitor === "manual" ? "manual" : "prototype");
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Trial failed" }, { status: 400 });
  }
}
