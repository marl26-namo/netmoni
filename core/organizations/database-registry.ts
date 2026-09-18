import { createOrganizationDatabase, type DatabaseClient, type DatabaseDialect } from "@/db/client";

type OrganizationDatabase = { organizationId: string; dialect: DatabaseDialect; configuredAt: string; client: DatabaseClient };

class OrganizationDatabaseRegistry {
  private readonly databases = new Map<string, OrganizationDatabase>();

  configure(organizationId: string, url: string) {
    if (!organizationId.trim()) throw new Error("Organization id is required");
    if (!url.startsWith("postgres://") && !url.startsWith("postgresql://") && !url.startsWith("mysql://") && !url.startsWith("file:")) throw new Error("Database URL must use postgres://, mysql://, or file:");
    const client = createOrganizationDatabase(url);
    const entry = { organizationId, dialect: client.dialect, configuredAt: new Date().toISOString(), client };
    this.databases.set(organizationId, entry);
    return entry;
  }

  get(organizationId: string) { return this.databases.get(organizationId); }

  list() { return [...this.databases.values()]; }
}

export const organizationDatabaseRegistry = new OrganizationDatabaseRegistry();
