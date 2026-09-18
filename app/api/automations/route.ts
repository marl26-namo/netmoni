import { NextResponse } from "next/server";
import { createWorkflow } from "@/core/workflows/definition";
import { workflowRepository } from "@/core/runtime";

export async function GET() {
  return NextResponse.json({ workflows: workflowRepository.list() });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const workflow = workflowRepository.save(createWorkflow(body));
    return NextResponse.json({ workflow }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid workflow" }, { status: 400 });
  }
}
