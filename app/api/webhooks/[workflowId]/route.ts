import { NextResponse } from "next/server";
import { publishEvent, workflowRepository } from "@/core/runtime";

export async function POST(request: Request, { params }: { params: Promise<{ workflowId: string }> }) {
  const { workflowId } = await params;
  const workflow = workflowRepository.findById(workflowId);
  if (!workflow) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  const payload = await request.json() as Record<string, unknown>;
  return NextResponse.json(await publishEvent(workflow.trigger.event, payload, `webhook:${workflowId}`), { status: 202 });
}
