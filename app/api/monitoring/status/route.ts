import { NextResponse } from "next/server";
import { ensureScheduler, runScan } from "@/monitoring/engine";
import { monitoringDatabase } from "@/monitoring/db";
import { monitoringStore } from "@/monitoring/store";

function organizationIdOf(request: Request) {
  return new URL(request.url).searchParams.get("organizationId") ?? "local-workspace";
}

/** GET /api/monitoring/status?organizationId=… — everything the dashboard needs in one call. */
export async function GET(request: Request) {
  const organizationId = organizationIdOf(request);
  try {
    const [devices, alerts, runs, settings] = await Promise.all([
      monitoringStore.listDevices(organizationId),
      monitoringStore.listAlerts(organizationId, 50),
      monitoringStore.listRuns(organizationId, 15),
      monitoringStore.getSettings(organizationId),
    ]);
    void ensureScheduler(organizationId);
    const openAlerts = alerts.filter((alert) => alert.status === "open");
    const lastRun = runs[0];
    return NextResponse.json({
      organizationId,
      databaseDialect: monitoringDatabase.dialect(organizationId),
      devices,
      alerts,
      openAlerts,
      runs,
      settings,
      summary: {
        devicesTotal: devices.length,
        devicesOnline: devices.filter((d) => d.status === "online").length,
        devicesWarning: devices.filter((d) => d.status === "warning").length,
        devicesOffline: devices.filter((d) => d.status === "offline").length,
        openAlerts: openAlerts.length,
        criticalAlerts: openAlerts.filter((a) => a.severity === "critical").length,
        lastScanAt: lastRun?.finishedAt ?? lastRun?.startedAt,
        lastScanStatus: lastRun?.status,
        avgLatencyMs: (() => {
          const values = devices.map((d) => d.responseTimeMs).filter((v): v is number => typeof v === "number");
          return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : undefined;
        })(),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Monitoring status failed" }, { status: 500 });
  }
}

/** POST /api/monitoring/status — run a full network scan now. */
export async function POST(request: Request) {
  const organizationId = organizationIdOf(request);
  try {
    const run = await runScan(organizationId, "manual");
    return NextResponse.json({ run });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Scan failed" }, { status: 500 });
  }
}
