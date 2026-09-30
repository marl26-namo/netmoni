import { NextResponse } from "next/server";
import { monitoringStore } from "@/monitoring/store";

/** GET /api/monitoring/runs?organizationId=… — scan history with probe details. */
export async function GET(request: Request) {
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "local-workspace";
  const runs = await monitoringStore.listRuns(organizationId, 15);
  return NextResponse.json({ runs });
}
