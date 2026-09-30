import { NextResponse } from "next/server";
import { sessionWorkspace } from "@/auth/store";
import { organizationDatabaseRegistry } from "@/core/organizations/database-registry";

export const dynamic = "force-dynamic";

function safe(entry: ReturnType<typeof organizationDatabaseRegistry.get>) {
  if (!entry) return null;
  return { organizationId: entry.organizationId, dialect: entry.dialect, configuredAt: entry.configuredAt, configured: true };
}

export async function GET(_request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  // Every organization uses the shared PostgreSQL database; calling this
  // endpoint simply marks the organization as provisioned.
  return NextResponse.json({ database: safe(organizationDatabaseRegistry.configure(organizationId)) });
}

export async function POST(request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  // Request bodies that still send a `url` are accepted but ignored: NetMoni
  // runs on one database (DATABASE_URL). The session cookie is touched to keep
  // the route shape identical for existing clients.
  void sessionWorkspace(request);
  return NextResponse.json({ database: safe(organizationDatabaseRegistry.configure(organizationId)) }, { status: 201 });
}
