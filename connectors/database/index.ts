import type { Connector } from "@/core/types";

export type DatabaseAdapter = { query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> };
export const databaseConnectors: Connector[] = [
  { id: "postgres", name: "PostgreSQL", kind: "postgres", config: {} },
  { id: "mysql", name: "MySQL", kind: "mysql", config: {} },
  { id: "sqlite", name: "SQLite", kind: "sqlite", config: {} },
];
