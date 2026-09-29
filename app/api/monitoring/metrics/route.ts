import { NextResponse } from "next/server";
import { monitoringStore } from "@/core/monitoring/store";

/** Time-series metrics for dashboard charts (response time, loss, load). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(1_000, Math.max(10, Number(searchParams.get("limit") ?? 200)));
  const [polls, samples] = await Promise.all([monitoringStore.listPollResults(limit), monitoringStore.listMetricSamples(limit)]);
  return NextResponse.json({ polls, samples });
}
