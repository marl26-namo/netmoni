import { NextResponse } from "next/server";
import { publishEvent, workflowRepository } from "@/core/runtime";
import { networkMonitor } from "@/core/monitoring/monitor";
import { sessionWorkspaceId } from "@/auth/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json() as { type?: string; payload?: Record<string, unknown>; source?: string };
  if (!body.type) return NextResponse.json({ error: "Event type is required" }, { status: 400 });
  const organizationId = sessionWorkspaceId(request);

  if (body.type === "workflow.execute") {
    const workflow = workflowRepository.findById("network-fault-notification");
    const probe = (["ping", "tcp", "snmp"] as const).includes(body.payload?.probe as "ping") ? (body.payload?.probe as "ping" | "tcp" | "snmp") : "ping";
    const outcomes = await networkMonitor.runCycle(organizationId, probe);
    const executions = workflow ? [{ workflowId: workflow.id, status: "succeeded", output: { outcomes } }] : [];
    return NextResponse.json({ event: { type: body.type, occurredAt: new Date().toISOString() }, executions }, { status: 202 });
  }

  return NextResponse.json(await publishEvent(body.type, { organizationId, ...(body.payload ?? {}) }, body.source ?? "api"), { status: 202 });
}
