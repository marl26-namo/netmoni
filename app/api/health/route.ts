import { NextResponse } from "next/server";
import { pool } from "@/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await pool().query("SELECT 1 AS ok");
    return NextResponse.json({
      status: "ok",
      service: "netmoni",
      database: "postgres",
      databaseConnected: result.rows[0]?.ok === 1,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "degraded",
        service: "netmoni",
        database: "postgres",
        databaseConnected: false,
        error: error instanceof Error ? error.message : "Database unreachable",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
