export const config = {
  appName: "MUBAS NetWatch",
  authDatabase: process.env.AUTH_DATABASE_URL ?? "file:./softcape-auth.db",
  database: process.env.AUTH_DATABASE_URL ?? "file:./softcape-auth.db",
  databaseMode: process.env.AUTH_DATABASE_URL ? "byo-auth" : "embedded-auth-sqlite",
  /**
   * Bring-your-own database for the network monitoring boundary.
   * Accepts postgres://, mysql://, or file: (SQLite is the default).
   */
  monitoringDatabase: process.env.MONITORING_DATABASE_URL ?? "file:./mubas-netwatch.db",
  runtime: process.env.SOFTCAPE_RUNTIME ?? "local",
  apiBaseUrl: process.env.SOFTCAPE_API_URL ?? "http://localhost:3000",
};
