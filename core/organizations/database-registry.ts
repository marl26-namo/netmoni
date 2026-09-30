/**
 * NetMoni no longer uses per-organization databases. Every organization shares
 * the single PostgreSQL database configured through DATABASE_URL, and tenant
 * isolation is enforced by organization_id scoping in each query.
 */
export type SharedDatabaseInfo = {
  organizationId: string;
  dialect: "postgres";
  configuredAt: string;
  configured: true;
};

class SharedDatabaseRegistry {
  private readonly configuredAt = new Map<string, string>();

  configure(organizationId: string) {
    if (!organizationId.trim()) throw new Error("Organization id is required");
    const configuredAt = this.configuredAt.get(organizationId) ?? new Date().toISOString();
    this.configuredAt.set(organizationId, configuredAt);
    return { organizationId, dialect: "postgres" as const, configuredAt, configured: true } satisfies SharedDatabaseInfo;
  }

  get(organizationId: string) {
    if (!this.configuredAt.has(organizationId)) return undefined;
    return this.configure(organizationId);
  }

  list() {
    return [...this.configuredAt.keys()].map((organizationId) => this.configure(organizationId));
  }
}

export const organizationDatabaseRegistry = new SharedDatabaseRegistry();
