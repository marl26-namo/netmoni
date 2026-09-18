export const config = {
  appName: "Softcape",
  authDatabase: process.env.AUTH_DATABASE_URL ?? "file:./softcape-auth.db",
  database: process.env.AUTH_DATABASE_URL ?? "file:./softcape-auth.db",
  databaseMode: process.env.AUTH_DATABASE_URL ? "byo-auth" : "embedded-auth-sqlite",
  runtime: process.env.SOFTCAPE_RUNTIME ?? "local",
  apiBaseUrl: process.env.SOFTCAPE_API_URL ?? "http://localhost:3000",
};
