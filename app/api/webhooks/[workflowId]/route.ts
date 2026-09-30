import { NextResponse } from "next/server";
import { publishEvent, workflowRepository } from "@/core/runtime";
import { sessionWorkspace } from "@/auth/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ workflowId: string }> }) {
  const { workflowId } = await params;
  const organizationId = await sessionWorkspace(request);
  const workflow = await workflowRepository.findById(workflowId, organizationId);
  if (!workflow) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  const payload = await request.json() as Record<string, unknown>;
  return NextResponse.json(await publishEvent(workflow.trigger.event, { organizationId, ...payload }, `webhook:${workflowId}`), { status: 202 });
}
