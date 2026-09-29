import { NextResponse } from "next/server";
import { monitoringStore } from "@/core/monitoring/store";
import { clearScenario, injectScenario } from "@/core/monitoring/engine";

export async function GET() {
  const scenarios = await monitoringStore.listScenarios();
  return NextResponse.json({ scenarios });
}

/** Inject or clear a controlled Packet Tracer fault scenario. */
export async function POST(request: Request) {
  try {
    const body = await request.json() as { scenarioId?: string; action?: "inject" | "clear" };
    if (!body.scenarioId || !body.action) return NextResponse.json({ error: "scenarioId and action are required" }, { status: 400 });
    const scenario = body.action === "inject" ? await injectScenario(body.scenarioId) : await clearScenario(body.scenarioId);
    return NextResponse.json({ scenario });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Scenario action failed" }, { status: 400 });
  }
}
