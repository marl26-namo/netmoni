import { config } from "@/config";
import { createDatabase, type DatabaseClient, type DatabaseDialect } from "@/db/client";
import { organizationDatabaseRegistry } from "@/core/organizations/database-registry";

/**
 * Minimal dialect-portable SQL adapter over the project's Bring-Your-Own
 * database boundary. The monitoring tables are created with plain SQL on
 * whichever engine the organization connects (postgres://, mysql://, file:)
 * so no extra migration tooling is required.
 */

type Row = Record<string, unknown>;
type Prepared = { run: (...args: unknown[]) => unknown; all: (...args: unknown[]) => unknown[]; get: (...args: unknown[]) => unknown };

const MONITORING_TABLES = `
CREATE TABLE IF NOT EXISTS monitoring_devices (
  id VARCHAR(64) PRIMARY KEY,
  organization_id VARCHAR(128) NOT NULL,
  name VARCHAR(255) NOT NULL,
  ip_address VARCHAR(64) NOT NULL,
  subnet VARCHAR(64),
  mac VARCHAR(64),
  kind VARCHAR(32) NOT NULL DEFAULT 'router',
  location VARCHAR(255),
  status VARCHAR(16) NOT NULL DEFAULT 'unknown',
  response_time_ms REAL,
  packet_loss_pct REAL,
  last_seen_at TEXT,
  last_checked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS monitoring_runs (
  id VARCHAR(64) PRIMARY KEY,
  organization_id VARCHAR(128) NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  duration_ms REAL,
  triggered_by VARCHAR(16) NOT NULL DEFAULT 'manual',
  devices_checked INTEGER NOT NULL DEFAULT 0,
  devices_online INTEGER NOT NULL DEFAULT 0,
  devices_warning INTEGER NOT NULL DEFAULT 0,
  devices_offline INTEGER NOT NULL DEFAULT 0,
  results TEXT,
  alerts_created INTEGER NOT NULL DEFAULT 0,
  emails_dispatched INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'completed',
  error TEXT
);
CREATE TABLE IF NOT EXISTS monitoring_alerts (
  id VARCHAR(64) PRIMARY KEY,
  organization_id VARCHAR(128) NOT NULL,
  device_id VARCHAR(64) NOT NULL,
  device_name VARCHAR(255) NOT NULL,
  ip_address VARCHAR(64) NOT NULL,
  severity VARCHAR(16) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'open',
  title VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  evidence TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  message TEXT NOT NULL,
  probes_failed TEXT,
  latency_ms REAL,
  packet_loss_pct REAL,
  email_dispatched INTEGER NOT NULL DEFAULT 0,
  email_recipients TEXT,
  email_error TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE TABLE IF NOT EXISTS monitoring_settings (
  organization_id VARCHAR(128) PRIMARY KEY,
  polling_interval_seconds INTEGER NOT NULL DEFAULT 30,
  failure_threshold INTEGER NOT NULL DEFAULT 3,
  warning_latency_ms INTEGER NOT NULL DEFAULT 300,
  packet_loss_threshold_pct REAL NOT NULL DEFAULT 5,
  snmp_community VARCHAR(128) NOT NULL DEFAULT '',
  tcp_ports VARCHAR(255) NOT NULL DEFAULT '22,80,443',
  tcp_ports_enabled INTEGER NOT NULL DEFAULT 0,
  http_urls TEXT,
  dns_hostname VARCHAR(255),
  dns_server VARCHAR(64),
  ai_provider VARCHAR(32) NOT NULL DEFAULT 'gemini',
  ai_model VARCHAR(96) NOT NULL DEFAULT 'gemini-2.5-flash',
  admin_emails TEXT NOT NULL,
  smtp_host VARCHAR(255) NOT NULL DEFAULT 'smtp.gmail.com',
  smtp_port INTEGER NOT NULL DEFAULT 465,
  smtp_secure INTEGER NOT NULL DEFAULT 1,
  smtp_user VARCHAR(255),
  smtp_from VARCHAR(255),
  updated_at TEXT NOT NULL
);
`;

let schemaReady = false;

class MonitoringDatabase {
  private readonly fallback: DatabaseClient;

  constructor() {
    this.fallback = createDatabase(config.authDatabase, "auth");
  }

  /** The organization's BYO database, or the platform default when unset. */
  resolve(organizationId?: string): DatabaseClient {
    const byo = organizationId ? organizationDatabaseRegistry.clientFor(organizationId) : null;
    return byo ?? this.fallback;
  }

  dialect(organizationId?: string): DatabaseDialect {
    return this.resolve(organizationId).dialect;
  }

  driver(organizationId?: string) {
    return this.resolve(organizationId).driver;
  }

  prepare(organizationId: string | undefined, sql: string): Prepared | null {
    const driver = this.driver(organizationId) as { prepare?: (s: string) => Prepared } | undefined;
    return driver?.prepare?.(sql) ?? null;
  }

  async ensureSchema(organizationId?: string) {
    if (schemaReady) return;
    const client = this.resolve(organizationId);
    const driver = client.driver;
    if (!driver) return;
    if (client.dialect === "sqlite") {
      const db = driver as { exec: (sql: string) => void };
      db.exec(MONITORING_TABLES.replace(/\bREAL\b/g, "REAL").replace(/VARCHAR\(\d+\)/g, "TEXT"));
    } else {
      const statements = MONITORING_TABLES.split(";").map((s) => s.trim()).filter(Boolean);
      if (client.dialect === "postgres") {
        const pool = driver as { query: (sql: string) => Promise<unknown> };
        for (const statement of statements) await pool.query(statement.replace(/\bREAL\b/g, "DOUBLE PRECISION").replace(/\bTEXT\b/g, "TEXT"));
      } else {
        const pool = driver as { query: (sql: string) => Promise<unknown> };
        for (const statement of statements) await pool.query(statement.replace(/\bREAL\b/g, "DOUBLE"));
      }
    }
    schemaReady = true;
  }
}

export const monitoringDatabase = new MonitoringDatabase();
export type { Row };
