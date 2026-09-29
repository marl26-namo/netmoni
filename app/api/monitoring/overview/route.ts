import { NextResponse } from "next/server";
import { monitoringStore } from "@/core/monitoring/store";
import { runPollCycle } from "@/core/monitoring/engine";

/**
 * Live network overview — device status, latest poll per device, open faults,
 * unread notifications, and recent event log for the dashboard.
 */
export async function GET() {
  const [devices, links, latestPolls, faults, notifications, events] = await Promise.all([
    monitoringStore.listDevices(),
    monitoringStore.listLinks(),
    monitoringStore.latestPollPerDevice(),
    monitoringStore.listFaults(40),
    monitoringStore.listUnreadNotifications(),
    monitoringStore.listEvents(30),
  ]);

  const deviceRows = devices.map((device) => {
    const poll = latestPolls.get(device.id);
    return {
      ...device,
      lastPoll: poll
        ? {
            cycle: poll.cycle,
            polledAt: poll.polledAt,
            responded: poll.responded,
            withinTimeout: poll.withinTimeout,
            responseTimeMs: poll.responseTimeMs,
            latencyMs: poll.latencyMs,
            jitterMs: poll.jitterMs,
            packetLossPct: poll.packetLossPct,
            bandwidthUtilPct: poll.bandwidthUtilPct,
            cpuLoadPct: poll.cpuLoadPct,
            memoryLoadPct: poll.memoryLoadPct,
            errorCode: poll.errorCode,
          }
        : null,
    };
  });

  const openFaults = faults.filter((fault) => fault.status === "open");
  const summary = {
    totalDevices: devices.length,
    up: devices.filter((device) => device.status === "up").length,
    degraded: devices.filter((device) => device.status === "degraded").length,
    down: devices.filter((device) => device.status === "down").length,
    openFaults: openFaults.length,
    unreadNotifications: notifications.length,
  };

  return NextResponse.json({ summary, devices: deviceRows, links, faults, notifications, events });
}

/** Trigger a manual poll cycle from the dashboard. */
export async function POST() {
  try {
    const result = await runPollCycle();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Poll failed" }, { status: 500 });
  }
}
