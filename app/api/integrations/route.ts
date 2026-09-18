import { NextResponse } from "next/server";
import { integrationDefinitions } from "@/integrations/definitions";
import { listConnections, saveConnection } from "@/integrations/connections";

export function GET(request: Request) {
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "acme-workspace";
  return NextResponse.json({ integrations: integrationDefinitions, connections: listConnections(organizationId) });
}

export async function POST(request: Request) {
  const body = await request.json() as { organizationId?: string; integrationId?: string; name?: string; credentials?: Record<string, string>; variables?: Record<string, string> };
  try {
    if (!body.organizationId || !body.integrationId) throw new Error("organizationId and integrationId are required");
    return NextResponse.json({ connection: saveConnection({ organizationId: body.organizationId, integrationId: body.integrationId, name: body.name, credentials: body.credentials, variables: body.variables }) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save integration" }, { status: 400 });
  }
}
