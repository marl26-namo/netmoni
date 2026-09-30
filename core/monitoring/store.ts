import { randomUUID } from "node:crypto";
import type { DatabaseDialect } from "@/db/client";
import { getOrganizationDatabaseUrl } from "@/auth/store";
import { organizationDatabaseRegistry } from "@/core/organizations/database-registry";
import type { AlertSeverity, CheckRow, MonitoringSettings, NetworkAlert, NetworkDevice, ProbeKind } from "@/core/monitoring/types";

type Client = NonNullable<ReturnType<typeof organizationDatabaseRegistry.get>>["client"];
type ResultRow = Record<string, unknown>;

const DDL: Record<DatabaseDialect, string[]> = {
  sqlite: [
    `CREATE TABLE IF NOT EXISTS network_devices (id TEXT PRIMARY KEY, name TEXT NOT NULL, ip TEXT NOT NULL, subnet TEXT NOT NULL DEFAULT '', mac TEXT NOT NULL DEFAULT '', type TEXT NOT NULL DEFAULT 'router', status TEXT NOT NULL DEFAULT 'Online', created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS monitoring_checks (id TEXT PRIMARY KEY, device_id TEXT NOT NULL, device_name TEXT NOT NULL, ip_address TEXT NOT NULL, probe TEXT NOT NULL, ok INTEGER NOT NULL, latency_ms REAL, packet_loss REAL NOT NULL DEFAULT 0, bandwidth_in REAL, bandwidth_out REAL, detail TEXT, checked_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS monitoring_alerts (id TEXT PRIMARY KEY, device_id TEXT NOT NULL, device_name TEXT NOT NULL, ip_address TEXT NOT NULL, severity TEXT NOT NULL, status TEXT NOT NULL, summary TEXT NOT NULL, recommendation TEXT NOT NULL, evidence TEXT NOT NULL DEFAULT '{}', email_status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS monitoring_settings (organization_id TEXT PRIMARY KEY, interval_seconds INTEGER NOT NULL DEFAULT 30, failure_threshold INTEGER NOT NULL DEFAULT 3, latency_warning_ms INTEGER NOT NULL DEFAULT 500, packet_loss_warning REAL NOT NULL DEFAULT 10, bandwidth_warning REAL NOT NULL DEFAULT 0, admin_email TEXT NOT NULL DEFAULT '', ai_provider TEXT NOT NULL DEFAULT 'gemini', ai_model TEXT NOT NULL DEFAULT 'gemini-2.5-flash', ai_instruction TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL)`,
  ],
  postgres: [
    `CREATE TABLE IF NOT EXISTS network_devices (id TEXT PRIMARY KEY, name TEXT NOT NULL, ip TEXT NOT NULL, subnet TEXT NOT NULL DEFAULT '', mac TEXT NOT NULL DEFAULT '', type TEXT NOT NULL DEFAULT 'router', status TEXT NOT NULL DEFAULT 'Online', created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS monitoring_checks (id TEXT PRIMARY KEY, device_id TEXT NOT NULL, device_name TEXT NOT NULL, ip_address TEXT NOT NULL, probe TEXT NOT NULL, ok BOOLEAN NOT NULL, latency_ms DOUBLE PRECISION, packet_loss DOUBLE PRECISION NOT NULL DEFAULT 0, bandwidth_in DOUBLE PRECISION, bandwidth_out DOUBLE PRECISION, detail TEXT, checked_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS monitoring_alerts (id TEXT PRIMARY KEY, device_id TEXT NOT NULL, device_name TEXT NOT NULL, ip_address TEXT NOT NULL, severity TEXT NOT NULL, status TEXT NOT NULL, summary TEXT NOT NULL, recommendation TEXT NOT NULL, evidence JSONB NOT NULL DEFAULT '{}', email_status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS monitoring_settings (organization_id TEXT PRIMARY KEY, interval_seconds INTEGER NOT NULL DEFAULT 30, failure_threshold INTEGER NOT NULL DEFAULT 3, latency_warning_ms INTEGER NOT NULL DEFAULT 500, packet_loss_warning DOUBLE PRECISION NOT NULL DEFAULT 10, bandwidth_warning DOUBLE PRECISION NOT NULL DEFAULT 0, admin_email TEXT NOT NULL DEFAULT '', ai_provider TEXT NOT NULL DEFAULT 'gemini', ai_model TEXT NOT NULL DEFAULT 'gemini-2.5-flash', ai_instruction TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  ],
  mysql: [
    `CREATE TABLE IF NOT EXISTS network_devices (id VARCHAR(36) PRIMARY KEY, name VARCHAR(255) NOT NULL, ip VARCHAR(64) NOT NULL, subnet VARCHAR(64) NOT NULL DEFAULT '', mac VARCHAR(64) NOT NULL DEFAULT '', type VARCHAR(16) NOT NULL DEFAULT 'router', status VARCHAR(16) NOT NULL DEFAULT 'Online', created_at VARCHAR(40) NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS monitoring_checks (id VARCHAR(36) PRIMARY KEY, device_id VARCHAR(36) NOT NULL, device_name VARCHAR(255) NOT NULL, ip_address VARCHAR(64) NOT NULL, probe VARCHAR(16) NOT NULL, ok BOOLEAN NOT NULL, latency_ms DOUBLE, packet_loss DOUBLE NOT NULL DEFAULT 0, bandwidth_in DOUBLE, bandwidth_out DOUBLE, detail TEXT, checked_at VARCHAR(40) NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS monitoring_alerts (id VARCHAR(36) PRIMARY KEY, device_id VARCHAR(36) NOT NULL, device_name VARCHAR(255) NOT NULL, ip_address VARCHAR(64) NOT NULL, severity VARCHAR(16) NOT NULL, status VARCHAR(32) NOT NULL, summary TEXT NOT NULL, recommendation TEXT NOT NULL, evidence TEXT NOT NULL, email_status VARCHAR(32) NOT NULL DEFAULT 'pending', created_at VARCHAR(40) NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS monitoring_settings (organization_id VARCHAR(36) PRIMARY KEY, interval_seconds INT NOT NULL DEFAULT 30, failure_threshold INT NOT NULL DEFAULT 3, latency_warning_ms INT NOT NULL DEFAULT 500, packet_loss_warning DOUBLE NOT NULL DEFAULT 10, bandwidth_warning DOUBLE NOT NULL DEFAULT 0, admin_email VARCHAR(255) NOT NULL DEFAULT '', ai_provider VARCHAR(32) NOT NULL DEFAULT 'gemini', ai_model VARCHAR(64) NOT NULL DEFAULT 'gemini-2.5-flash', ai_instruction TEXT, updated_at VARCHAR(40) NOT NULL)`,
  ],
};

class TenantMonitorStore {
  private readonly prepared = new Set<string>();

  private async ensureTables(client: Client) {
    if (this.prepared.has(client.url)) return;
    const statements = DDL[client.dialect];
    if (client.raw.kind === "sqlite") {
      for (const statement of statements) client.raw.connection.exec(statement);
    } else if (client.raw.kind === "postgres") {
      for (const statement of statements) await client.raw.pool.query(statement);
    } else {
      for (const statement of statements) await client.raw.pool.query(statement);
    }
    this.prepared.add(client.url);
  }

  async clientFor(organizationId: string): Promise<Client | null> {
    const url = getOrganizationDatabaseUrl(organizationId);
    if (!url) return null;
    if (!organizationDatabaseRegistry.get(organizationId)) organizationDatabaseRegistry.configure(organizationId, url);
    const entry = organizationDatabaseRegistry.get(organizationId);
    if (!entry) return null;
    await this.ensureTables(entry.client);
    return entry.client;
  }

  private static toDevice(row: ResultRow): NetworkDevice {
    return { id: String(row.id), name: String(row.name), ip: String(row.ip), subnet: String(row.subnet ?? ""), mac: String(row.mac ?? ""), type: row.type as NetworkDevice["type"], status: row.status as NetworkDevice["status"], createdAt: String(row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at) };
  }

  private static toCheck(row: ResultRow): CheckRow {
    return {
      id: String(row.id),
      deviceId: String(row.device_id),
      deviceName: String(row.device_name),
      ipAddress: String(row.ip_address),
      probe: String(row.probe) as ProbeKind,
      ok: Boolean(row.ok),
      latencyMs: row.latency_ms === null || row.latency_ms === undefined ? null : Number(row.latency_ms),
      packetLossPercent: Number(row.packet_loss ?? 0),
      bandwidthInMbps: row.bandwidth_in === null || row.bandwidth_in === undefined ? null : Number(row.bandwidth_in),
      bandwidthOutMbps: row.bandwidth_out === null || row.bandwidth_out === undefined ? null : Number(row.bandwidth_out),
      detail: row.detail === null || row.detail === undefined ? null : String(row.detail),
      checkedAt: String(row.checked_at instanceof Date ? row.checked_at.toISOString() : row.checked_at),
    };
  }

  private static toAlert(row: ResultRow): NetworkAlert {
    let evidence: Record<string, unknown> = {};
    try { evidence = typeof row.evidence === "string" ? JSON.parse(row.evidence) : row.evidence ?? {}; } catch { evidence = {}; }
    return {
      id: String(row.id),
      deviceId: String(row.device_id),
      deviceName: String(row.device_name),
      ipAddress: String(row.ip_address),
      severity: String(row.severity) as AlertSeverity,
      status: String(row.status),
      summary: String(row.summary),
      recommendation: String(row.recommendation ?? ""),
      evidence,
      emailStatus: String(row.email_status ?? "pending"),
      createdAt: String(row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at),
    };
  }

  private static toSettings(organizationId: string, row: ResultRow | undefined): MonitoringSettings {
    return {
      organizationId,
      intervalSeconds: Number(row?.interval_seconds ?? 30),
      failureThreshold: Number(row?.failure_threshold ?? 3),
      latencyWarningMs: Number(row?.latency_warning_ms ?? 500),
      packetLossWarningPercent: Number(row?.packet_loss_warning ?? 10),
      bandwidthWarningMbps: Number(row?.bandwidth_warning ?? 0),
      adminEmail: String(row?.admin_email ?? ""),
      aiProvider: String(row?.ai_provider ?? "gemini"),
      aiModel: String(row?.ai_model ?? "gemini-2.5-flash"),
      aiInstruction: String(row?.ai_instruction ?? "Write a concise, professional network fault notification. Include the affected device, IP, severity, evidence and recommended action."),
      updatedAt: String(row?.updated_at instanceof Date ? row.updated_at.toISOString() : row?.updated_at ?? new Date().toISOString()),
    };
  }

  private static placeholders(dialect: DatabaseDialect, count: number, startAt = 1) {
    return Array.from({ length: count }, (_, index) => (dialect === "postgres" ? `$${startAt + index}` : "?")).join(", ");
  }

  private static async runQuery(client: Client, sql: string, params: unknown[]): Promise<ResultRow[]> {
    if (client.raw.kind === "sqlite") return client.raw.connection.prepare(sql).all(...params) as ResultRow[];
    if (client.raw.kind === "postgres") return (await client.raw.pool.query(sql, params)).rows;
    const [rows] = await client.raw.pool.query(sql, params);
    return rows as ResultRow[];
  }

  async listDevices(organizationId: string): Promise<NetworkDevice[]> {
    const client = await this.clientFor(organizationId);
    if (!client) return [];
    const rows = await TenantMonitorStore.runQuery(client, "SELECT * FROM network_devices ORDER BY created_at", []);
    return rows.map(TenantMonitorStore.toDevice);
  }

  async createDevice(organizationId: string, input: { name: string; ip: string; subnet?: string; mac?: string; type?: string }): Promise<NetworkDevice> {
    const client = await this.clientFor(organizationId);
    if (!client) throw new Error("Connect an organization database before adding devices");
    const device: NetworkDevice = { id: randomUUID(), name: input.name, ip: input.ip, subnet: input.subnet ?? "", mac: input.mac ?? "", type: (input.type as NetworkDevice["type"]) ?? "router", status: "Online", createdAt: new Date().toISOString() };
    const sql = client.dialect === "postgres"
      ? `INSERT INTO network_devices (id, name, ip, subnet, mac, type, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
      : `INSERT INTO network_devices (id, name, ip, subnet, mac, type, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [device.id, device.name, device.ip, device.subnet, device.mac, device.type, device.status, device.createdAt];
    if (client.raw.kind === "sqlite") client.raw.connection.prepare(sql).run(...params);
    else if (client.raw.kind === "postgres") await client.raw.pool.query(sql, params);
    else await client.raw.pool.query(sql.replace("$1", "?").replace("$2", "?").replace("$3", "?").replace("$4", "?").replace("$5", "?").replace("$6", "?").replace("$7", "?").replace("$8", "?"), params);
    return device;
  }

  async deleteDevice(organizationId: string, deviceId: string): Promise<boolean> {
    const client = await this.clientFor(organizationId);
    if (!client) return false;
    if (client.raw.kind === "sqlite") {
      const info = client.raw.connection.prepare("DELETE FROM network_devices WHERE id = ?").run(deviceId);
      return Number(info.changes) > 0;
    }
    if (client.raw.kind === "postgres") {
      const result = await client.raw.pool.query("DELETE FROM network_devices WHERE id = $1", [deviceId]);
      return (result.rowCount ?? 0) > 0;
    }
    const [result] = await client.raw.pool.query("DELETE FROM network_devices WHERE id = ?", [deviceId]);
    return Number((result as { affectedRows?: number }).affectedRows ?? 0) > 0;
  }

  async recordCheck(organizationId: string, check: Omit<CheckRow, "id">): Promise<CheckRow> {
    const client = await this.clientFor(organizationId);
    if (!client) throw new Error("Connect an organization database before recording checks");
    const row: CheckRow = { ...check, id: randomUUID() };
    const sql = client.dialect === "postgres"
      ? `INSERT INTO monitoring_checks (id, device_id, device_name, ip_address, probe, ok, latency_ms, packet_loss, bandwidth_in, bandwidth_out, detail, checked_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`
      : `INSERT INTO monitoring_checks (id, device_id, device_name, ip_address, probe, ok, latency_ms, packet_loss, bandwidth_in, bandwidth_out, detail, checked_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`;
    const params = [row.id, row.deviceId, row.deviceName, row.ipAddress, row.probe, client.dialect === "sqlite" ? (row.ok ? 1 : 0) : row.ok, row.latencyMs, row.packetLossPercent, row.bandwidthInMbps, row.bandwidthOutMbps, row.detail, row.checkedAt];
    if (client.raw.kind === "sqlite") client.raw.connection.prepare(sql).run(...params);
    else if (client.raw.kind === "postgres") await client.raw.pool.query(sql, params);
    else await client.raw.pool.query(sql, params);
    return row;
  }

  async listChecks(organizationId: string, options: { deviceId?: string; limit?: number } = {}): Promise<CheckRow[]> {
    const client = await this.clientFor(organizationId);
    if (!client) return [];
    const limit = Math.min(500, Math.max(1, options.limit ?? 100));
    const params: unknown[] = [];
    let sql = "SELECT * FROM monitoring_checks";
    if (options.deviceId) {
      params.push(options.deviceId);
      sql += client.dialect === "postgres" ? ` WHERE device_id = $1` : ` WHERE device_id = ?`;
    }
    sql += client.dialect === "postgres" ? ` ORDER BY checked_at DESC LIMIT ${limit}` : ` ORDER BY checked_at DESC LIMIT ${limit}`;
    const rows = await TenantMonitorStore.runQuery(client, sql, params);
    return rows.map(TenantMonitorStore.toCheck);
  }

  async saveAlert(organizationId: string, alert: Omit<NetworkAlert, "id" | "createdAt">): Promise<NetworkAlert> {
    const client = await this.clientFor(organizationId);
    if (!client) throw new Error("Connect an organization database before saving alerts");
    const row: NetworkAlert = { ...alert, id: randomUUID(), createdAt: new Date().toISOString() };
    const sql = client.dialect === "postgres"
      ? `INSERT INTO monitoring_alerts (id, device_id, device_name, ip_address, severity, status, summary, recommendation, evidence, email_status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`
      : `INSERT INTO monitoring_alerts (id, device_id, device_name, ip_address, severity, status, summary, recommendation, evidence, email_status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`;
    const params = [row.id, row.deviceId, row.deviceName, row.ipAddress, row.severity, row.status, row.summary, row.recommendation, JSON.stringify(row.evidence ?? {}), row.emailStatus, row.createdAt];
    if (client.raw.kind === "sqlite") client.raw.connection.prepare(sql).run(...params);
    else if (client.raw.kind === "postgres") await client.raw.pool.query(sql, params);
    else await client.raw.pool.query(sql, params);
    return row;
  }

  async updateAlertEmailStatus(organizationId: string, alertId: string, emailStatus: string): Promise<void> {
    const client = await this.clientFor(organizationId);
    if (!client) return;
    const sql = client.dialect === "postgres" ? `UPDATE monitoring_alerts SET email_status = $1 WHERE id = $2` : `UPDATE monitoring_alerts SET email_status = ? WHERE id = ?`;
    const params = [emailStatus, alertId];
    if (client.raw.kind === "sqlite") client.raw.connection.prepare(sql).run(...params);
    else if (client.raw.kind === "postgres") await client.raw.pool.query(sql, params);
    else await client.raw.pool.query(sql, params);
  }

  async listAlerts(organizationId: string, options: { limit?: number } = {}): Promise<NetworkAlert[]> {
    const client = await this.clientFor(organizationId);
    if (!client) return [];
    const limit = Math.min(500, Math.max(1, options.limit ?? 100));
    const rows = await TenantMonitorStore.runQuery(client, `SELECT * FROM monitoring_alerts ORDER BY created_at DESC LIMIT ${limit}`, []);
    return rows.map(TenantMonitorStore.toAlert);
  }

  async getSettings(organizationId: string): Promise<MonitoringSettings> {
    const client = await this.clientFor(organizationId);
    if (!client) {
      return TenantMonitorStore.toSettings(organizationId, undefined);
    }
    const rows = await TenantMonitorStore.runQuery(client, "SELECT * FROM monitoring_settings WHERE organization_id = " + (client.dialect === "postgres" ? "$1" : "?"), [organizationId]);
    return TenantMonitorStore.toSettings(organizationId, rows[0]);
  }

  async saveSettings(organizationId: string, input: Partial<MonitoringSettings>): Promise<MonitoringSettings> {
    const client = await this.clientFor(organizationId);
    if (!client) throw new Error("Connect an organization database before saving monitoring settings");
    const current = await this.getSettings(organizationId);
    const next: MonitoringSettings = { ...current, ...input, organizationId, updatedAt: new Date().toISOString() };
    const sql = client.dialect === "postgres"
      ? `INSERT INTO monitoring_settings (organization_id, interval_seconds, failure_threshold, latency_warning_ms, packet_loss_warning, bandwidth_warning, admin_email, ai_provider, ai_model, ai_instruction, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (organization_id) DO UPDATE SET interval_seconds = $2, failure_threshold = $3, latency_warning_ms = $4, packet_loss_warning = $5, bandwidth_warning = $6, admin_email = $7, ai_provider = $8, ai_model = $9, ai_instruction = $10, updated_at = $11`
      : client.dialect === "mysql"
        ? `INSERT INTO monitoring_settings (organization_id, interval_seconds, failure_threshold, latency_warning_ms, packet_loss_warning, bandwidth_warning, admin_email, ai_provider, ai_model, ai_instruction, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE interval_seconds = VALUES(interval_seconds), failure_threshold = VALUES(failure_threshold), latency_warning_ms = VALUES(latency_warning_ms), packet_loss_warning = VALUES(packet_loss_warning), bandwidth_warning = VALUES(bandwidth_warning), admin_email = VALUES(admin_email), ai_provider = VALUES(ai_provider), ai_model = VALUES(ai_model), ai_instruction = VALUES(ai_instruction), updated_at = VALUES(updated_at)`
        : `INSERT INTO monitoring_settings (organization_id, interval_seconds, failure_threshold, latency_warning_ms, packet_loss_warning, bandwidth_warning, admin_email, ai_provider, ai_model, ai_instruction, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(organization_id) DO UPDATE SET interval_seconds = excluded.interval_seconds, failure_threshold = excluded.failure_threshold, latency_warning_ms = excluded.latency_warning_ms, packet_loss_warning = excluded.packet_loss_warning, bandwidth_warning = excluded.bandwidth_warning, admin_email = excluded.admin_email, ai_provider = excluded.ai_provider, ai_model = excluded.ai_model, ai_instruction = excluded.ai_instruction, updated_at = excluded.updated_at`;
    const params = [next.organizationId, next.intervalSeconds, next.failureThreshold, next.latencyWarningMs, next.packetLossWarningPercent, next.bandwidthWarningMbps, next.adminEmail, next.aiProvider, next.aiModel, next.aiInstruction, next.updatedAt];
    if (client.raw.kind === "sqlite") client.raw.connection.prepare(sql).run(...params);
    else if (client.raw.kind === "postgres") await client.raw.pool.query(sql, params);
    else await client.raw.pool.query(sql, params);
    return next;
  }

  async setDeviceStatus(organizationId: string, deviceId: string, status: NetworkDevice["status"]): Promise<void> {
    const client = await this.clientFor(organizationId);
    if (!client) return;
    const sql = client.dialect === "postgres" ? `UPDATE network_devices SET status = $1 WHERE id = $2` : `UPDATE network_devices SET status = ? WHERE id = ?`;
    const params = [status, deviceId];
    if (client.raw.kind === "sqlite") client.raw.connection.prepare(sql).run(...params);
    else if (client.raw.kind === "postgres") await client.raw.pool.query(sql, params);
    else await client.raw.pool.query(sql, params);
  }
}

export const tenantMonitorStore = new TenantMonitorStore();
