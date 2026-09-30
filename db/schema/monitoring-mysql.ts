import { double, int, mysqlTable, text, tinyint } from "drizzle-orm/mysql-core";

/**
 * Monitoring schema for MySQL deployments (`mysql://` URLs). Mirrors
 * db/schema/monitoring-sqlite.ts — drizzle-kit pushes these tables to the
 * organization database when the connected URL selects MySQL.
 */

export const monitoringDevices = mysqlTable("monitoring_devices", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  name: text("name").notNull(),
  ipAddress: text("ip_address").notNull(),
  subnet: text("subnet"),
  mac: text("mac"),
  kind: text("kind").notNull().default("router"),
  location: text("location"),
  status: text("status").notNull().default("unknown"),
  responseTimeMs: double("response_time_ms"),
  packetLossPct: double("packet_loss_pct"),
  lastSeenAt: text("last_seen_at"),
  lastCheckedAt: text("last_checked_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const monitoringRuns = mysqlTable("monitoring_runs", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  durationMs: double("duration_ms"),
  triggeredBy: text("triggered_by").notNull().default("manual"),
  devicesChecked: int("devices_checked").notNull().default(0),
  devicesOnline: int("devices_online").notNull().default(0),
  devicesWarning: int("devices_warning").notNull().default(0),
  devicesOffline: int("devices_offline").notNull().default(0),
  results: text("results"),
  alertsCreated: int("alerts_created").notNull().default(0),
  emailsDispatched: int("emails_dispatched").notNull().default(0),
  status: text("status").notNull().default("completed"),
  error: text("error"),
});

export const monitoringAlerts = mysqlTable("monitoring_alerts", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  deviceId: text("device_id").notNull(),
  deviceName: text("device_name").notNull(),
  ipAddress: text("ip_address").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull().default("open"),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  evidence: text("evidence"),
  recommendation: text("recommendation").notNull(),
  message: text("message").notNull(),
  probesFailed: text("probes_failed"),
  latencyMs: double("latency_ms"),
  packetLossPct: double("packet_loss_pct"),
  emailDispatched: tinyint("email_dispatched").notNull().default(0),
  emailRecipients: text("email_recipients"),
  emailError: text("email_error"),
  createdAt: text("created_at").notNull(),
  resolvedAt: text("resolved_at"),
});

export const monitoringSettings = mysqlTable("monitoring_settings", {
  organizationId: text("organization_id").primaryKey(),
  pollingIntervalSeconds: int("polling_interval_seconds").notNull().default(30),
  failureThreshold: int("failure_threshold").notNull().default(3),
  warningLatencyMs: int("warning_latency_ms").notNull().default(300),
  packetLossThresholdPct: double("packet_loss_threshold_pct").notNull().default(5),
  snmpCommunity: text("snmp_community").notNull().default(""),
  tcpPorts: text("tcp_ports").notNull().default("22,80,443"),
  tcpPortsEnabled: tinyint("tcp_ports_enabled").notNull().default(0),
  httpUrls: text("http_urls"),
  dnsHostname: text("dns_hostname"),
  dnsServer: text("dns_server"),
  aiProvider: text("ai_provider").notNull().default("gemini"),
  aiModel: text("ai_model").notNull().default("gemini-2.5-flash"),
  adminEmails: text("admin_emails").notNull().default(""),
  smtpHost: text("smtp_host").notNull().default("smtp.gmail.com"),
  smtpPort: int("smtp_port").notNull().default(465),
  smtpSecure: tinyint("smtp_secure").notNull().default(1),
  smtpUser: text("smtp_user"),
  smtpFrom: text("smtp_from"),
  updatedAt: text("updated_at").notNull(),
});
