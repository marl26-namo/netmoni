import { randomUUID } from "node:crypto";
import { monitoringDatabase } from "@/monitoring/db";
import type { Alert, Device, MonitoringSettings, ProbeRun } from "@/monitoring/types";

/**
 * Persistence layer for the network monitoring platform. Every record lives
 * in the organization's own database (Bring-Your-Own-DB) with a platform
 * default for workspaces that have not connected one yet.
 */

type Row = Record<string, unknown>;

function str(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  return String(value);
}

function num(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function bool(value: unknown): boolean {
  return value === 1 || value === true || value === "1" || value === "true";
}

function json<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") return value as T;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}

function mapDevice(row: Row): Device {
  return {
    id: str(row.id) ?? "",
    organizationId: str(row.organization_id) ?? "",
    name: str(row.name) ?? "",
    ipAddress: str(row.ip_address) ?? "",
    subnet: str(row.subnet),
    mac: str(row.mac),
    kind: (str(row.kind) ?? "router") as Device["kind"],
    location: str(row.location),
    status: (str(row.status) ?? "unknown") as Device["status"],
    responseTimeMs: num(row.response_time_ms),
    packetLossPct: num(row.packet_loss_pct),
    lastSeenAt: str(row.last_seen_at),
    lastCheckedAt: str(row.last_checked_at),
    createdAt: str(row.created_at) ?? new Date().toISOString(),
    updatedAt: str(row.updated_at) ?? new Date().toISOString(),
  };
}

function mapRun(row: Row): ProbeRun {
  return {
    id: str(row.id) ?? "",
    organizationId: str(row.organization_id) ?? "",
    startedAt: str(row.started_at) ?? "",
    finishedAt: str(row.finished_at),
    durationMs: num(row.duration_ms),
    triggeredBy: (str(row.triggered_by) ?? "manual") as ProbeRun["triggeredBy"],
    devicesChecked: num(row.devices_checked) ?? 0,
    devicesOnline: num(row.devices_online) ?? 0,
    devicesWarning: num(row.devices_warning) ?? 0,
    devicesOffline: num(row.devices_offline) ?? 0,
    results: json<ProbeRun["results"]>(row.results, []),
    alertsCreated: num(row.alerts_created) ?? 0,
    emailsDispatched: num(row.emails_dispatched) ?? 0,
    status: (str(row.status) ?? "completed") as ProbeRun["status"],
    error: str(row.error),
  };
}

function mapAlert(row: Row): Alert {
  return {
    id: str(row.id) ?? "",
    organizationId: str(row.organization_id) ?? "",
    deviceId: str(row.device_id) ?? "",
    deviceName: str(row.device_name) ?? "",
    ipAddress: str(row.ip_address) ?? "",
    severity: (str(row.severity) ?? "warning") as Alert["severity"],
    status: (str(row.status) ?? "open") as Alert["status"],
    title: str(row.title) ?? "",
    summary: str(row.summary) ?? "",
    evidence: json<string[]>(row.evidence, []),
    recommendation: str(row.recommendation) ?? "",
    message: str(row.message) ?? "",
    probesFailed: json<string[]>(row.probes_failed, []),
    latencyMs: num(row.latency_ms),
    packetLossPct: num(row.packet_loss_pct),
    emailDispatched: bool(row.email_dispatched),
    emailRecipients: str(row.email_recipients),
    emailError: str(row.email_error),
    createdAt: str(row.created_at) ?? new Date().toISOString(),
    resolvedAt: str(row.resolved_at),
  };
}

function mapSettings(row: Row): MonitoringSettings {
  return {
    organizationId: str(row.organization_id) ?? "",
    pollingIntervalSeconds: num(row.polling_interval_seconds) ?? 30,
    failureThreshold: num(row.failure_threshold) ?? 3,
    warningLatencyMs: num(row.warning_latency_ms) ?? 300,
    packetLossThresholdPct: num(row.packet_loss_threshold_pct) ?? 5,
    snmpCommunity: str(row.snmp_community) ?? "public",
    tcpPorts: str(row.tcp_ports) ?? "22,80,443",
    tcpPortsEnabled: bool(row.tcp_ports_enabled),
    httpUrls: str(row.http_urls) ?? "",
    dnsHostname: str(row.dns_hostname) ?? "",
    dnsServer: str(row.dns_server),
    aiProvider: str(row.ai_provider) ?? "gemini",
    aiModel: str(row.ai_model) ?? "gemini-2.5-flash",
    adminEmails: str(row.admin_emails) ?? "",
    smtpHost: str(row.smtp_host) ?? "smtp.gmail.com",
    smtpPort: num(row.smtp_port) ?? 465,
    smtpSecure: bool(row.smtp_secure),
    smtpUser: str(row.smtp_user),
    smtpFrom: str(row.smtp_from),
    updatedAt: str(row.updated_at) ?? new Date().toISOString(),
  };
}

const PLACEHOLDER = "?";

/** Dialect-aware parameter placeholder: postgres uses $1..$n. */
function bind(sql: string, dialect: string): { text: string; values?: unknown[] } {
  if (dialect !== "postgres") return { text: sql };
  let index = 0;
  return { text: sql.replace(/\?/g, () => `$${++index}`) };
}

class MonitoringStore {
  async listDevices(organizationId: string): Promise<Device[]> {
    await monitoringDatabase.ensureSchema(organizationId);
    const db = monitoringDatabase.resolve(organizationId);
    if (db.dialect === "sqlite") {
      const rows = monitoringDatabase.prepare(organizationId, "SELECT * FROM monitoring_devices WHERE organization_id = ? ORDER BY created_at")?.all(organizationId) as Row[] | undefined;
      return (rows ?? []).map(mapDevice);
    }
    const client = db.driver as { query: (sql: string, values?: unknown[]) => Promise<{ rows?: Row[]; 0?: Row[] }> };
    const { text } = bind("SELECT * FROM monitoring_devices WHERE organization_id = ? ORDER BY created_at", db.dialect);
    const result = await client.query(text, [organizationId]);
    const rows = (result.rows ?? (Array.isArray(result) ? result : result[0])) as Row[];
    return (rows ?? []).map(mapDevice);
  }

  async getDevice(organizationId: string, deviceId: string): Promise<Device | undefined> {
    const devices = await this.listDevices(organizationId);
    return devices.find((device) => device.id === deviceId);
  }

  async saveDevice(input: Partial<Device> & { organizationId: string; name: string; ipAddress: string }): Promise<Device> {
    await monitoringDatabase.ensureSchema(input.organizationId);
    const db = monitoringDatabase.resolve(input.organizationId);
    const now = new Date().toISOString();
    const device: Device = {
      id: input.id ?? `dev-${randomUUID().slice(0, 8)}`,
      organizationId: input.organizationId,
      name: input.name,
      ipAddress: input.ipAddress,
      subnet: input.subnet,
      mac: input.mac,
      kind: input.kind ?? "router",
      location: input.location,
      status: input.status ?? "unknown",
      responseTimeMs: input.responseTimeMs,
      packetLossPct: input.packetLossPct,
      lastSeenAt: input.lastSeenAt,
      lastCheckedAt: input.lastCheckedAt,
      createdAt: now,
      updatedAt: now,
    };
    if (db.dialect === "sqlite") {
      monitoringDatabase.prepare(
        input.organizationId,
        "INSERT INTO monitoring_devices (id, organization_id, name, ip_address, subnet, mac, kind, location, status, response_time_ms, packet_loss_pct, last_seen_at, last_checked_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
          "ON CONFLICT(id) DO UPDATE SET name = excluded.name, ip_address = excluded.ip_address, subnet = excluded.subnet, mac = excluded.mac, kind = excluded.kind, location = excluded.location, status = excluded.status, response_time_ms = excluded.response_time_ms, packet_loss_pct = excluded.packet_loss_pct, last_seen_at = excluded.last_seen_at, last_checked_at = excluded.last_checked_at, updated_at = excluded.updated_at",
      )?.run(device.id, device.organizationId, device.name, device.ipAddress, device.subnet ?? null, device.mac ?? null, device.kind, device.location ?? null, device.status, device.responseTimeMs ?? null, device.packetLossPct ?? null, device.lastSeenAt ?? null, device.lastCheckedAt ?? null, device.createdAt, device.updatedAt);
      return device;
    }
    const client = db.driver as { query: (sql: string, values?: unknown[]) => Promise<unknown> };
    const { text } = bind(
      "INSERT INTO monitoring_devices (id, organization_id, name, ip_address, subnet, mac, kind, location, status, response_time_ms, packet_loss_pct, last_seen_at, last_checked_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
        "ON CONFLICT(id) DO UPDATE SET name = excluded.name, ip_address = excluded.ip_address, subnet = excluded.subnet, mac = excluded.mac, kind = excluded.kind, location = excluded.location, status = excluded.status, response_time_ms = excluded.response_time_ms, packet_loss_pct = excluded.packet_loss_pct, last_seen_at = excluded.last_seen_at, last_checked_at = excluded.last_checked_at, updated_at = excluded.updated_at",
      db.dialect,
    );
    // MySQL uses different upsert syntax.
    const mysqlText = db.dialect === "mysql"
      ? text.replace(
          "ON CONFLICT(id) DO UPDATE SET",
          "ON DUPLICATE KEY UPDATE",
        ).replace(/excluded\./g, "")
      : text;
    await client.query(mysqlText, [
      device.id, device.organizationId, device.name, device.ipAddress, device.subnet ?? null, device.mac ?? null, device.kind, device.location ?? null, device.status, device.responseTimeMs ?? null, device.packetLossPct ?? null, device.lastSeenAt ?? null, device.lastCheckedAt ?? null, device.createdAt, device.updatedAt,
    ]);
    return device;
  }

  async updateDeviceStatus(organizationId: string, deviceId: string, patch: Partial<Pick<Device, "status" | "responseTimeMs" | "packetLossPct" | "lastSeenAt" | "lastCheckedAt">>) {
    await monitoringDatabase.ensureSchema(organizationId);
    const db = monitoringDatabase.resolve(organizationId);
    const assignments: string[] = [];
    const values: unknown[] = [];
    const push = (column: string, value: unknown) => {
      assignments.push(`${column} = ?`);
      values.push(value ?? null);
    };
    if (patch.status !== undefined) push("status", patch.status);
    if (patch.responseTimeMs !== undefined) push("response_time_ms", patch.responseTimeMs);
    if (patch.packetLossPct !== undefined) push("packet_loss_pct", patch.packetLossPct);
    if (patch.lastSeenAt !== undefined) push("last_seen_at", patch.lastSeenAt);
    if (patch.lastCheckedAt !== undefined) push("last_checked_at", patch.lastCheckedAt);
    push("updated_at", new Date().toISOString());
    values.push(deviceId, organizationId);
    const sql = `UPDATE monitoring_devices SET ${assignments.join(", ")} WHERE id = ? AND organization_id = ?`;
    if (db.dialect === "sqlite") {
      monitoringDatabase.prepare(organizationId, sql)?.run(...values);
      return;
    }
    const client = db.driver as { query: (sql: string, values?: unknown[]) => Promise<unknown> };
    await client.query(bind(sql, db.dialect).text, values);
  }

  async deleteDevice(organizationId: string, deviceId: string) {
    await monitoringDatabase.ensureSchema(organizationId);
    const db = monitoringDatabase.resolve(organizationId);
    const sql = "DELETE FROM monitoring_devices WHERE id = ? AND organization_id = ?";
    if (db.dialect === "sqlite") {
      monitoringDatabase.prepare(organizationId, sql)?.run(deviceId, organizationId);
      return;
    }
    const client = db.driver as { query: (sql: string, values?: unknown[]) => Promise<unknown> };
    await client.query(bind(sql, db.dialect).text, [deviceId, organizationId]);
  }

  async saveRun(run: ProbeRun): Promise<ProbeRun> {
    await monitoringDatabase.ensureSchema(run.organizationId);
    const db = monitoringDatabase.resolve(run.organizationId);
    const sql =
      "INSERT INTO monitoring_runs (id, organization_id, started_at, finished_at, duration_ms, triggered_by, devices_checked, devices_online, devices_warning, devices_offline, results, alerts_created, emails_dispatched, status, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(id) DO UPDATE SET finished_at = excluded.finished_at, duration_ms = excluded.duration_ms, devices_checked = excluded.devices_checked, devices_online = excluded.devices_online, devices_warning = excluded.devices_warning, devices_offline = excluded.devices_offline, results = excluded.results, alerts_created = excluded.alerts_created, emails_dispatched = excluded.emails_dispatched, status = excluded.status, error = excluded.error";
    const values = [
      run.id, run.organizationId, run.startedAt, run.finishedAt ?? null, run.durationMs ?? null, run.triggeredBy,
      run.devicesChecked, run.devicesOnline, run.devicesWarning, run.devicesOffline,
      JSON.stringify(run.results ?? []), run.alertsCreated, run.emailsDispatched, run.status, run.error ?? null,
    ];
    if (db.dialect === "sqlite") {
      monitoringDatabase.prepare(run.organizationId, sql)?.run(...values);
      return run;
    }
    const client = db.driver as { query: (sql: string, values?: unknown[]) => Promise<unknown> };
    const mysqlText = db.dialect === "mysql"
      ? bind(sql, db.dialect).text.replace("ON CONFLICT(id) DO UPDATE SET", "ON DUPLICATE KEY UPDATE").replace(/excluded\./g, "")
      : bind(sql, db.dialect).text;
    await client.query(mysqlText, values);
    return run;
  }

  async listRuns(organizationId: string, limit = 20): Promise<ProbeRun[]> {
    await monitoringDatabase.ensureSchema(organizationId);
    const db = monitoringDatabase.resolve(organizationId);
    if (db.dialect === "sqlite") {
      const rows = monitoringDatabase.prepare(organizationId, "SELECT * FROM monitoring_runs WHERE organization_id = ? ORDER BY started_at DESC LIMIT ?")?.all(organizationId, limit) as Row[] | undefined;
      return (rows ?? []).map(mapRun);
    }
    const client = db.driver as { query: (sql: string, values?: unknown[]) => Promise<{ rows?: Row[]; 0?: Row[] }> };
    const { text } = bind("SELECT * FROM monitoring_runs ORDER BY started_at DESC", db.dialect);
    const scoped = db.dialect === "postgres" ? text.replace("ORDER BY", `WHERE organization_id = $1 ORDER BY`) : text.replace("ORDER BY", "WHERE organization_id = ? ORDER BY");
    const limitClause = db.dialect === "postgres" ? ` LIMIT ${Number(limit) || 20}` : " LIMIT ?";
    const values = db.dialect === "postgres" ? [organizationId] : [organizationId, Number(limit) || 20];
    const result = await client.query(`${scoped}${limitClause}`, values);
    const rows = (result.rows ?? (Array.isArray(result) ? result : result[0])) as Row[];
    return (rows ?? []).map(mapRun);
  }

  async saveAlert(alert: Alert): Promise<Alert> {
    await monitoringDatabase.ensureSchema(alert.organizationId);
    const db = monitoringDatabase.resolve(alert.organizationId);
    const sql =
      "INSERT INTO monitoring_alerts (id, organization_id, device_id, device_name, ip_address, severity, status, title, summary, evidence, recommendation, message, probes_failed, latency_ms, packet_loss_pct, email_dispatched, email_recipients, email_error, created_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(id) DO UPDATE SET status = excluded.status, message = excluded.message, email_dispatched = excluded.email_dispatched, email_recipients = excluded.email_recipients, email_error = excluded.email_error, resolved_at = excluded.resolved_at";
    const values = [
      alert.id, alert.organizationId, alert.deviceId, alert.deviceName, alert.ipAddress, alert.severity, alert.status,
      alert.title, alert.summary, JSON.stringify(alert.evidence ?? []), alert.recommendation, alert.message, JSON.stringify(alert.probesFailed ?? []),
      alert.latencyMs ?? null, alert.packetLossPct ?? null, alert.emailDispatched ? 1 : 0, alert.emailRecipients ?? null, alert.emailError ?? null,
      alert.createdAt, alert.resolvedAt ?? null,
    ];
    if (db.dialect === "sqlite") {
      monitoringDatabase.prepare(alert.organizationId, sql)?.run(...values);
      return alert;
    }
    const client = db.driver as { query: (sql: string, values?: unknown[]) => Promise<unknown> };
    const mysqlText = db.dialect === "mysql"
      ? bind(sql, db.dialect).text.replace("ON CONFLICT(id) DO UPDATE SET", "ON DUPLICATE KEY UPDATE").replace(/excluded\./g, "")
      : bind(sql, db.dialect).text;
    await client.query(mysqlText, values);
    return alert;
  }

  async listAlerts(organizationId: string, limit = 50): Promise<Alert[]> {
    await monitoringDatabase.ensureSchema(organizationId);
    const db = monitoringDatabase.resolve(organizationId);
    if (db.dialect === "sqlite") {
      const rows = monitoringDatabase.prepare(organizationId, "SELECT * FROM monitoring_alerts WHERE organization_id = ? ORDER BY created_at DESC LIMIT ?")?.all(organizationId, limit) as Row[] | undefined;
      return (rows ?? []).map(mapAlert);
    }
    const client = db.driver as { query: (sql: string, values?: unknown[]) => Promise<{ rows?: Row[]; 0?: Row[] }> };
    const base = "SELECT * FROM monitoring_alerts ORDER BY created_at DESC";
    const scoped = db.dialect === "postgres" ? base.replace("ORDER BY", "WHERE organization_id = $1 ORDER BY") : base.replace("ORDER BY", "WHERE organization_id = ? ORDER BY");
    const limitClause = db.dialect === "postgres" ? ` LIMIT ${Number(limit) || 50}` : " LIMIT ?";
    const values = db.dialect === "postgres" ? [organizationId] : [organizationId, Number(limit) || 50];
    const result = await client.query(`${scoped}${limitClause}`, values);
    const rows = (result.rows ?? (Array.isArray(result) ? result : result[0])) as Row[];
    return (rows ?? []).map(mapAlert);
  }

  async getSettings(organizationId: string): Promise<MonitoringSettings> {
    await monitoringDatabase.ensureSchema(organizationId);
    const db = monitoringDatabase.resolve(organizationId);
    const defaults: MonitoringSettings = {
      organizationId,
      pollingIntervalSeconds: 30,
      failureThreshold: 3,
      warningLatencyMs: 300,
      packetLossThresholdPct: 5,
      snmpCommunity: "",
      tcpPorts: "22,80,443",
      tcpPortsEnabled: false,
      httpUrls: "",
      dnsHostname: "",
      dnsServer: undefined,
      aiProvider: "gemini",
      aiModel: "gemini-2.5-flash",
      adminEmails: "",
      smtpHost: "smtp.gmail.com",
      smtpPort: 465,
      smtpSecure: true,
      smtpUser: undefined,
      smtpFrom: undefined,
      updatedAt: new Date().toISOString(),
    };
    if (db.dialect === "sqlite") {
      const row = monitoringDatabase.prepare(organizationId, "SELECT * FROM monitoring_settings WHERE organization_id = ?")?.get(organizationId) as Row | undefined;
      return row ? { ...defaults, ...mapSettings(row) } : defaults;
    }
    const client = db.driver as { query: (sql: string, values?: unknown[]) => Promise<{ rows?: Row[]; 0?: Row[] }> };
    const { text } = bind("SELECT * FROM monitoring_settings WHERE organization_id = ?", db.dialect);
    const result = await client.query(text, [organizationId]);
    const rows = (result.rows ?? (Array.isArray(result) ? result : result[0])) as Row[];
    return rows?.[0] ? { ...defaults, ...mapSettings(rows[0]) } : defaults;
  }

  async saveSettings(settings: MonitoringSettings): Promise<MonitoringSettings> {
    await monitoringDatabase.ensureSchema(settings.organizationId);
    const db = monitoringDatabase.resolve(settings.organizationId);
    const sql =
      "INSERT INTO monitoring_settings (organization_id, polling_interval_seconds, failure_threshold, warning_latency_ms, packet_loss_threshold_pct, snmp_community, tcp_ports, tcp_ports_enabled, http_urls, dns_hostname, dns_server, ai_provider, ai_model, admin_emails, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_from, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(organization_id) DO UPDATE SET polling_interval_seconds = excluded.polling_interval_seconds, failure_threshold = excluded.failure_threshold, warning_latency_ms = excluded.warning_latency_ms, packet_loss_threshold_pct = excluded.packet_loss_threshold_pct, snmp_community = excluded.snmp_community, tcp_ports = excluded.tcp_ports, tcp_ports_enabled = excluded.tcp_ports_enabled, http_urls = excluded.http_urls, dns_hostname = excluded.dns_hostname, dns_server = excluded.dns_server, ai_provider = excluded.ai_provider, ai_model = excluded.ai_model, admin_emails = excluded.admin_emails, smtp_host = excluded.smtp_host, smtp_port = excluded.smtp_port, smtp_secure = excluded.smtp_secure, smtp_user = excluded.smtp_user, smtp_from = excluded.smtp_from, updated_at = excluded.updated_at";
    const values = [
      settings.organizationId, settings.pollingIntervalSeconds, settings.failureThreshold, settings.warningLatencyMs, settings.packetLossThresholdPct,
      settings.snmpCommunity, settings.tcpPorts, settings.tcpPortsEnabled ? 1 : 0, settings.httpUrls ?? null, settings.dnsHostname ?? null, settings.dnsServer ?? null,
      settings.aiProvider, settings.aiModel, settings.adminEmails, settings.smtpHost, settings.smtpPort, settings.smtpSecure ? 1 : 0,
      settings.smtpUser ?? null, settings.smtpFrom ?? null, settings.updatedAt,
    ];
    if (db.dialect === "sqlite") {
      monitoringDatabase.prepare(settings.organizationId, sql)?.run(...values);
      return settings;
    }
    const client = db.driver as { query: (sql: string, values?: unknown[]) => Promise<unknown> };
    const mysqlText = db.dialect === "mysql"
      ? bind(sql, db.dialect).text.replace("ON CONFLICT(organization_id) DO UPDATE SET", "ON DUPLICATE KEY UPDATE").replace(/excluded\./g, "")
      : bind(sql, db.dialect).text;
    await client.query(mysqlText, values);
    return settings;
  }
}

export const monitoringStore = new MonitoringStore();
export { PLACEHOLDER };
