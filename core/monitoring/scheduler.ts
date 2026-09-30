import { networkMonitor } from "@/core/monitoring/monitor";
import { tenantMonitorStore } from "@/core/monitoring/store";

class MonitorScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const { listConfiguredOrganizationIds } = await import("@/auth/store");
      for (const organizationId of listConfiguredOrganizationIds()) {
        // Hydrates the in-process registry from the persisted org database URL
        // and ensures the monitoring tables exist before probing.
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
