import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Monitoring schema for SQLite deployments (`file:` URLs). The same logical
 * tables exist for PostgreSQL and MySQL in auth-postgres.ts / auth-mysql.ts so
 * drizzle-kit can push to whichever engine the organization connects.
 */

export const monitoringDevices = sqliteTable("monitoring_devices", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  name: text("name").notNull(),
  ipAddress: text("ip_address").notNull(),
  subnet: text("subnet"),
  mac: text("mac"),
  kind: text("kind").notNull().default("router"),
  location: text("location"),
  status: text("status").notNull().default("unknown"),
  responseTimeMs: real("response_time_ms"),
  packetLossPct: real("packet_loss_pct"),
  lastSeenAt: text("last_seen_at"),
  lastCheckedAt: text("last_checked_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const monitoringRuns = sqliteTable("monitoring_runs", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  durationMs: real("duration_ms"),
  triggeredBy: text("triggered_by").notNull().default("manual"),
  devicesChecked: integer("devices_checked").notNull().default(0),
  devicesOnline: integer("devices_online").notNull().default(0),
  devicesWarning: integer("devices_warning").notNull().default(0),
  devicesOffline: integer("devices_offline").notNull().default(0),
  results: text("results", { mode: "json" }),
  alertsCreated: integer("alerts_created").notNull().default(0),
  emailsDispatched: integer("emails_dispatched").notNull().default(0),
  status: text("status").notNull().default("completed"),
  error: text("error"),
});

export const monitoringAlerts = sqliteTable("monitoring_alerts", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  deviceId: text("device_id").notNull(),
  deviceName: text("device_name").notNull(),
  ipAddress: text("ip_address").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull().default("open"),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  evidence: text("evidence", { mode: "json" }),
  recommendation: text("recommendation").notNull(),
  message: text("message").notNull(),
  probesFailed: text("probes_failed", { mode: "json" }),
  latencyMs: real("latency_ms"),
  packetLossPct: real("packet_loss_pct"),
  emailDispatched: integer("email_dispatched", { mode: "boolean" }).notNull().default(false),
  emailRecipients: text("email_recipients"),
  emailError: text("email_error"),
  createdAt: text("created_at").notNull(),
  resolvedAt: text("resolved_at"),
});

export const monitoringSettings = sqliteTable("monitoring_settings", {
  organizationId: text("organization_id").primaryKey(),
  pollingIntervalSeconds: integer("polling_interval_seconds").notNull().default(30),
  failureThreshold: integer("failure_threshold").notNull().default(3),
  warningLatencyMs: integer("warning_latency_ms").notNull().default(300),
  packetLossThresholdPct: real("packet_loss_threshold_pct").notNull().default(5),
  snmpCommunity: text("snmp_community").notNull().default(""),
  tcpPorts: text("tcp_ports").notNull().default("22,80,443"),
  tcpPortsEnabled: integer("tcp_ports_enabled", { mode: "boolean" }).notNull().default(false),
  httpUrls: text("http_urls"),
  dnsHostname: text("dns_hostname"),
  dnsServer: text("dns_server"),
  aiProvider: text("ai_provider").notNull().default("gemini"),
  aiModel: text("ai_model").notNull().default("gemini-2.5-flash"),
  adminEmails: text("admin_emails").notNull().default(""),
  smtpHost: text("smtp_host").notNull().default("smtp.gmail.com"),
  smtpPort: integer("smtp_port").notNull().default(465),
  smtpSecure: integer("smtp_secure", { mode: "boolean" }).notNull().default(true),
  smtpUser: text("smtp_user"),
  smtpFrom: text("smtp_from"),
  updatedAt: text("updated_at").notNull(),
});
