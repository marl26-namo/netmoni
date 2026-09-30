import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  monitoringAlerts,
  monitoringChecks,
  monitoringSettings,
  networkDevices,
} from "@/db/schema";
import type { AlertSeverity, CheckRow, MonitoringSettings, NetworkAlert, NetworkDevice, ProbeKind } from "@/core/monitoring/types";

type DeviceRow = typeof networkDevices.$inferSelect;
type CheckInsert = typeof monitoringChecks.$inferInsert;
type AlertInsert = typeof monitoringAlerts.$inferInsert;

function toDevice(row: DeviceRow): NetworkDevice {
  return {
    id: row.id,
    name: row.name,
    ip: row.ip,
    subnet: row.subnet,
    mac: row.mac,
    type: row.type as NetworkDevice["type"],
    status: row.status as NetworkDevice["status"],
    createdAt: row.createdAt.toISOString(),
  };
}

function toCheck(row: typeof monitoringChecks.$inferSelect): CheckRow {
  return {
    id: row.id,
    deviceId: row.deviceId,
    deviceName: row.deviceName,
    ipAddress: row.ipAddress,
    probe: row.probe as ProbeKind,
    ok: row.ok,
    latencyMs: row.latencyMs,
    packetLossPercent: row.packetLoss,
    bandwidthInMbps: row.bandwidthIn,
    bandwidthOutMbps: row.bandwidthOut,
    detail: row.detail,
    checkedAt: row.checkedAt.toISOString(),
  };
}

function toAlert(row: typeof monitoringAlerts.$inferSelect): NetworkAlert {
  let evidence: Record<string, unknown> = {};
  if (row.evidence && typeof row.evidence === "object") evidence = row.evidence as Record<string, unknown>;
  return {
    id: row.id,
    deviceId: row.deviceId,
    deviceName: row.deviceName,
    ipAddress: row.ipAddress,
    severity: row.severity as AlertSeverity,
    status: row.status,
    summary: row.summary,
    recommendation: row.recommendation,
    evidence,
    emailStatus: row.emailStatus,
    createdAt: row.createdAt.toISOString(),
  };
}

function toSettings(organizationId: string, row: typeof monitoringSettings.$inferSelect | undefined): MonitoringSettings {
  return {
    organizationId,
    intervalSeconds: row?.intervalSeconds ?? 30,
    failureThreshold: row?.failureThreshold ?? 3,
    latencyWarningMs: row?.latencyWarningMs ?? 500,
    packetLossWarningPercent: row?.packetLossWarning ?? 10,
    bandwidthWarningMbps: row?.bandwidthWarning ?? 0,
    adminEmail: row?.adminEmail ?? "",
    aiProvider: row?.aiProvider ?? "gemini",
    aiModel: row?.aiModel ?? "gemini-2.5-flash",
    aiInstruction: row?.aiInstruction ?? "Write a concise, professional network fault notification. Include the affected device, IP, severity, evidence and recommended action.",
    updatedAt: row?.updatedAt.toISOString() ?? new Date().toISOString(),
  };
}

/**
 * Organization-scoped monitoring persistence on the single NetMoni database.
 * Every query filters by organization_id — the tenant boundary lives in the
 * WHERE clause, not in a separate database.
 */
class TenantMonitorStore {
  async listDevices(organizationId: string): Promise<NetworkDevice[]> {
    const rows = await db().select().from(networkDevices).where(eq(networkDevices.organizationId, organizationId)).orderBy(networkDevices.createdAt);
    return rows.map(toDevice);
  }

  async createDevice(organizationId: string, input: { name: string; ip: string; subnet?: string; mac?: string; type?: string }): Promise<NetworkDevice> {
    const device: NetworkDevice = {
      id: randomUUID(),
      name: input.name,
      ip: input.ip,
      subnet: input.subnet ?? "",
      mac: input.mac ?? "",
      type: (input.type as NetworkDevice["type"]) ?? "router",
      status: "Online",
      createdAt: new Date().toISOString(),
    };
    await db().insert(networkDevices).values({
      id: device.id,
      organizationId,
      name: device.name,
      ip: device.ip,
      subnet: device.subnet,
      mac: device.mac,
      type: device.type,
      status: device.status,
    });
    return device;
  }

  async deleteDevice(organizationId: string, deviceId: string): Promise<boolean> {
    const deleted = await db()
      .delete(networkDevices)
      .where(and(eq(networkDevices.organizationId, organizationId), eq(networkDevices.id, deviceId)))
      .returning({ id: networkDevices.id });
    return deleted.length > 0;
  }

  async recordCheck(organizationId: string, check: Omit<CheckRow, "id">): Promise<CheckRow> {
    const row: CheckInsert = {
      id: randomUUID(),
      organizationId,
      deviceId: check.deviceId,
      deviceName: check.deviceName,
      ipAddress: check.ipAddress,
      probe: check.probe,
      ok: check.ok,
      latencyMs: check.latencyMs,
      packetLoss: check.packetLossPercent,
      bandwidthIn: check.bandwidthInMbps,
      bandwidthOut: check.bandwidthOutMbps,
      detail: check.detail,
      checkedAt: new Date(check.checkedAt),
    };
    const [inserted] = await db().insert(monitoringChecks).values(row).returning();
    return toCheck(inserted);
  }

  async listChecks(organizationId: string, options: { deviceId?: string; limit?: number } = {}): Promise<CheckRow[]> {
    const limit = Math.min(500, Math.max(1, options.limit ?? 100));
    const where = options.deviceId
      ? and(eq(monitoringChecks.organizationId, organizationId), eq(monitoringChecks.deviceId, options.deviceId))
      : eq(monitoringChecks.organizationId, organizationId);
    const rows = await db()
      .select()
      .from(monitoringChecks)
      .where(where)
      .orderBy(desc(monitoringChecks.checkedAt))
      .limit(limit);
    return rows.map(toCheck);
  }

  async saveAlert(organizationId: string, alert: Omit<NetworkAlert, "id" | "createdAt">): Promise<NetworkAlert> {
    const row: AlertInsert = {
      id: randomUUID(),
      organizationId,
      deviceId: alert.deviceId,
      deviceName: alert.deviceName,
      ipAddress: alert.ipAddress,
      severity: alert.severity,
      status: alert.status,
      summary: alert.summary,
      recommendation: alert.recommendation,
      evidence: alert.evidence ?? {},
      emailStatus: alert.emailStatus,
    };
    const [inserted] = await db().insert(monitoringAlerts).values(row).returning();
    return toAlert(inserted);
  }

  async updateAlertEmailStatus(organizationId: string, alertId: string, emailStatus: string): Promise<void> {
    await db()
      .update(monitoringAlerts)
      .set({ emailStatus })
      .where(and(eq(monitoringAlerts.organizationId, organizationId), eq(monitoringAlerts.id, alertId)));
  }

  async listAlerts(organizationId: string, options: { limit?: number } = {}): Promise<NetworkAlert[]> {
    const limit = Math.min(500, Math.max(1, options.limit ?? 100));
    const rows = await db()
      .select()
      .from(monitoringAlerts)
      .where(eq(monitoringAlerts.organizationId, organizationId))
      .orderBy(desc(monitoringAlerts.createdAt))
      .limit(limit);
    return rows.map(toAlert);
  }

  async getSettings(organizationId: string): Promise<MonitoringSettings> {
    const rows = await db().select().from(monitoringSettings).where(eq(monitoringSettings.organizationId, organizationId)).limit(1);
    return toSettings(organizationId, rows[0]);
  }

  async saveSettings(organizationId: string, input: Partial<MonitoringSettings>): Promise<MonitoringSettings> {
    const current = await this.getSettings(organizationId);
    const next: MonitoringSettings = { ...current, ...input, organizationId, updatedAt: new Date().toISOString() };
    await db()
      .insert(monitoringSettings)
      .values({
        organizationId,
        intervalSeconds: next.intervalSeconds,
        failureThreshold: next.failureThreshold,
        latencyWarningMs: next.latencyWarningMs,
        packetLossWarning: next.packetLossWarningPercent,
        bandwidthWarning: next.bandwidthWarningMbps,
        adminEmail: next.adminEmail,
        aiProvider: next.aiProvider,
        aiModel: next.aiModel,
        aiInstruction: next.aiInstruction,
        updatedAt: new Date(next.updatedAt),
      })
      .onConflictDoUpdate({
        target: monitoringSettings.organizationId,
        set: {
          intervalSeconds: next.intervalSeconds,
          failureThreshold: next.failureThreshold,
          latencyWarningMs: next.latencyWarningMs,
          packetLossWarning: next.packetLossWarningPercent,
          bandwidthWarning: next.bandwidthWarningMbps,
          adminEmail: next.adminEmail,
          aiProvider: next.aiProvider,
          aiModel: next.aiModel,
          aiInstruction: next.aiInstruction,
          updatedAt: new Date(next.updatedAt),
        },
      });
    return next;
  }

  async setDeviceStatus(organizationId: string, deviceId: string, status: NetworkDevice["status"]): Promise<void> {
    await db()
      .update(networkDevices)
      .set({ status })
      .where(and(eq(networkDevices.organizationId, organizationId), eq(networkDevices.id, deviceId)));
  }
}

export const tenantMonitorStore = new TenantMonitorStore();
