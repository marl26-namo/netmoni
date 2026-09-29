import { NextResponse } from "next/server";
import { database, monitoringDatabaseDialect } from "@/db/client";
import { config } from "@/config";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "mubas-netwatch",
    authDatabase: database.dialect,
    monitoringDatabase: monitoringDatabaseDialect,
    databaseMode: config.databaseMode,
    timestamp: new Date().toISOString(),
  });
}
