import { NextResponse } from "next/server";
import { monitoringStore } from "@/monitoring/store";

/** GET /api/monitoring/alerts?organizationId=… — fault notifications history. */
export async function GET(request: Request) {
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "local-workspace";
  const alerts = await monitoringStore.listAlerts(organizationId, 50);
  return NextResponse.json({ alerts });
}

/** PATCH /api/monitoring/alerts — acknowledge or resolve an alert. */
export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { organizationId?: string; alertId?: string; status?: "acknowledged" | "resolved" | "open" };
    if (!body.alertId || !body.status) return NextResponse.json({ error: "alertId and status are required" }, { status: 400 });
    const organizationId = body.organizationId ?? "local-workspace";
    const alerts = await monitoringStore.listAlerts(organizationId, 200);
    const alert = alerts.find((a) => a.id === body.alertId);
    if (!alert) return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    const updated = await monitoringStore.saveAlert({
      ...alert,
      status: body.status,
      resolvedAt: body.status === "resolved" ? new Date().toISOString() : undefined,
    });
    return NextResponse.json({ alert: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update alert" }, { status: 400 });
  }
}
