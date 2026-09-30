import { networkMonitor } from "@/core/monitoring/monitor";
import { tenantMonitorStore } from "@/core/monitoring/store";

class MonitorScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      // Organizations with devices registered in the shared Postgres database
      // are discovered from the network_devices table itself.
      const { db } = await import("@/db/client");
      const { networkDevices } = await import("@/db/schema");
      const rows = await db().selectDistinct({ organizationId: networkDevices.organizationId }).from(networkDevices);
      const { tenantMonitorStore } = await import("@/core/monitoring/store");
      for (const row of rows) {
        const organizationId = row.organizationId;
        const settings = await tenantMonitorStore.getSettings(organizationId);
        if (!settings.intervalSeconds || settings.intervalSeconds < 10) continue;
        await networkMonitor.runCycle(organizationId, "ping");
      }
    } catch {
      /* keep the scheduler alive on transient errors */
    } finally {
      this.running = false;
    }
  }

  start() {
    if (this.timer || process.env.NETMONI_SCHEDULER === "off") return;
    const intervalMs = Math.max(10_000, Number(process.env.NETMONI_POLL_MS ?? 30_000));
    this.timer = setInterval(() => { void this.tick(); }, intervalMs);
    if (typeof this.timer.unref === "function") this.timer.unref();
  }
}

export const monitorScheduler = new MonitorScheduler();
