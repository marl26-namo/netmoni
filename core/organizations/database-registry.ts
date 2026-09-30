import { createHash } from "node:crypto";
import { createOrganizationDatabase, database, type DatabaseClient, type DatabaseDialect } from "@/db/client";

type OrganizationDatabase = { organizationId: string; url: string; dialect: DatabaseDialect; configuredAt: string; client: DatabaseClient };

/**
 * Persists organization database URLs (hashed, never plaintext) so that a
 * process restart can re-open every organization's Bring-Your-Own database
 * without anyone re-entering credentials.
 */
class OrganizationDatabaseRegistry {
  private readonly databases = new Map<string, OrganizationDatabase>();

  constructor() {
    this.loadPersisted();
  }

  private loadPersisted() {
    try {
      const driver = database.driver as { prepare?: (sql: string) => { all: () => unknown[] } } | undefined;
      if (!driver?.prepare) return;
      const rows = driver.prepare("SELECT organization_id, url, dialect, configured_at FROM organization_databases ORDER BY configured_at")?.all() as Array<Record<string, string>> | undefined;
      for (const row of rows ?? []) {
        try {
          const client = createOrganizationDatabase(row.url);
          this.databases.set(row.organization_id, {
            organizationId: row.organization_id,
            url: row.url,
            dialect: client.dialect,
            configuredAt: row.configured_at,
            client,
          });
        } catch {
          // A saved URL may point at a database that is temporarily offline.
          // It will be re-registered the next time the user saves the URL.
        }
      }
    } catch {
      // Auth database not migrated yet — in-memory only until then.
    }
  }

  private persist(organizationId: string, url: string, dialect: DatabaseDialect, configuredAt: string) {
    try {
      const driver = database.driver as { prepare?: (sql: string) => { run: (...args: unknown[]) => unknown } } | undefined;
      if (!driver?.prepare) return;
      driver
        .prepare(
          "INSERT INTO organization_databases (id, organization_id, url, dialect, configured_at) VALUES (?, ?, ?, ?, ?) " +
            "ON CONFLICT(id) DO UPDATE SET url = excluded.url, dialect = excluded.dialect, configured_at = excluded.configured_at",
        )
        ?.run(createHash("sha256").update(organizationId).digest("hex"), organizationId, url, dialect, configuredAt);
    } catch {
      // Table may not exist on unmigrated deployments; registry stays in-memory.
    }
  }

  configure(organizationId: string, url: string) {
    if (!organizationId.trim()) throw new Error("Organization id is required");
    if (!url.startsWith("postgres://") && !url.startsWith("postgresql://") && !url.startsWith("mysql://") && !url.startsWith("file:")) throw new Error("Database URL must use postgres://, mysql://, or file:");
    const client = createOrganizationDatabase(url);
    const entry = { organizationId, url, dialect: client.dialect, configuredAt: new Date().toISOString(), client };
    this.databases.set(organizationId, entry);
    this.persist(organizationId, url, entry.dialect, entry.configuredAt);
    return entry;
  }

  get(organizationId: string) { return this.databases.get(organizationId); }

  /** The organization's BYO database, or null when it has not been connected. */
  clientFor(organizationId: string): DatabaseClient | null {
    return this.databases.get(organizationId)?.client ?? null;
  }

  list() { return [...this.databases.values()]; }
}

export const organizationDatabaseRegistry = new OrganizationDatabaseRegistry();
