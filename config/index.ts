export const config = {
  appName: "NetMoni",
  /** Single PostgreSQL database — auth, tenancy, monitoring and workflow data. */
  databaseUrl: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/netmoni",
  sessionCookieName: "netmoni_session",
  sessionTtlMs: 86_400_000,
  runtime: process.env.NETMONI_RUNTIME ?? "local",
  apiBaseUrl: process.env.NETMONI_API_URL ?? "http://localhost:3000",
};
