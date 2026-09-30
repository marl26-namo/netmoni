import { NextResponse } from "next/server";
import { getOrganizationDatabaseUrl, setOrganizationDatabaseUrl } from "@/auth/store";
import { organizationDatabaseRegistry } from "@/core/organizations/database-registry";

function safe(entry: ReturnType<typeof organizationDatabaseRegistry.get>) {
  if (!entry) return null;
  return { organizationId: entry.organizationId, dialect: entry.dialect, configuredAt: entry.configuredAt, configured: true };
}

export async function GET(_request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const url = getOrganizationDatabaseUrl(organizationId);
  if (url && !organizationDatabaseRegistry.get(organizationId)) organizationDatabaseRegistry.configure(organizationId, url);
  return NextResponse.json({ database: safe(organizationDatabaseRegistry.get(organizationId)) });
}

export async function POST(request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const body = await request.json() as { url?: string };
  try {
    if (!body.url) throw new Error("Database URL is required");
    const entry = organizationDatabaseRegistry.configure(organizationId, body.url);
    setOrganizationDatabaseUrl(organizationId, body.url);
    return NextResponse.json({ database: safe(entry) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid database configuration" }, { status: 400 });
  }
}
