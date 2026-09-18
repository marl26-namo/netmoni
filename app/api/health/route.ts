import { NextResponse } from "next/server";
import { database } from "@/db/client";
import { config } from "@/config";

export function GET() {
  return NextResponse.json({ status: "ok", service: "softcape", database: database.dialect, databaseMode: config.databaseMode, timestamp: new Date().toISOString() });
}
