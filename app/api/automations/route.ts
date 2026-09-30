import { NextResponse } from "next/server";
import { createWorkflow } from "@/core/workflows/definition";
import { workflowRepository } from "@/core/runtime";
import { sessionWorkspace } from "@/auth/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const organizationId = await sessionWorkspace(request);
  return NextResponse.json({ workflows: await workflowRepository.list(organizationId) });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const organizationId = await sessionWorkspace(request);
    const workflow = await workflowRepository.save(createWorkflow(body), organizationId);
    return NextResponse.json({ workflow }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid workflow" }, { status: 400 });
  }
}
