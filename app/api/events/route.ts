import { NextResponse } from "next/server";
import { publishEvent, workflowRepository } from "@/core/runtime";
import { networkMonitor } from "@/core/monitoring/monitor";
import { sessionWorkspace } from "@/auth/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json() as { type?: string; payload?: Record<string, unknown>; source?: string };
  if (!body.type) return NextResponse.json({ error: "Event type is required" }, { status: 400 });
  const organizationId = await sessionWorkspace(request);

  if (body.type === "workflow.execute") {
    const workflow = await workflowRepository.findById("network-fault-notification", organizationId);
    const probe = (["ping", "tcp", "snmp"] as const).includes(body.payload?.probe as "ping") ? (body.payload?.probe as "ping" | "tcp" | "snmp") : "ping";
    const startedAt = new Date();
    const outcomes = await networkMonitor.runCycle(organizationId, probe);
    await workflowRepository.recordExecution({
      organizationId,
      workflowId: "network-fault-notification",
      status: "succeeded",
      inputPayload: { probe, ...(body.payload ?? {}) },
      output: { outcomes },
      startedAt,
      finishedAt: new Date(),
    });
    const executions = [{ workflowId: "network-fault-notification", status: "succeeded", output: { outcomes } }];
    return NextResponse.json({ event: { type: body.type, occurredAt: new Date().toISOString() }, executions }, { status: 202 });
  }

  return NextResponse.json(await publishEvent(body.type, { organizationId, ...(body.payload ?? {}) }, body.source ?? "api"), { status: 202 });
}
