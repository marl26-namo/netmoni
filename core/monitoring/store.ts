/**
 * Monitoring store — persistence boundary over the BYO-DB Drizzle client.
 *
 * The engine talks to this store only, so SQLite (default), PostgreSQL, and
 * MySQL deployments share identical behaviour. Rows are normalised to the
 * SQLite row shape (ISO strings for timestamps) so callers never see
 * dialect-specific Date objects.
 */
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { createMonitoringDatabase, type DatabaseClient } from "@/db/client";
import { config } from "@/config";
import {
  devices,
  diagnoses,
  faults,
  links,
  metricSamples,
  monitoringEvents,
  notifications,
  pollResults,
  recommendations,
  scenarios,
  trials,
} from "@/db/schema/monitoring-sqlite";

export type DeviceRow = typeof devices.$inferSelect & { lastSeenAt: string | null; createdAt: string; updatedAt: string };
export type LinkRow = typeof links.$inferSelect & { createdAt: string; updatedAt: string };
export type PollRow = Omit<typeof pollResults.$inferSelect, "polledAt"> & { polledAt: string };
export type FaultRow = Omit<typeof faults.$inferSelect, "detectedAt" | "resolvedAt"> & { detectedAt: string; resolvedAt: string | null };
export type RecommendationRow = Omit<typeof recommendations.$inferSelect, "acknowledgedAt"> & { acknowledgedAt: string | null };
export type NotificationRow = Omit<typeof notifications.$inferSelect, "createdAt" | "readAt"> & { createdAt: string; readAt: string | null };
export type ScenarioRow = Omit<typeof scenarios.$inferSelect, "createdAt"> & { createdAt: string };
export type TrialRow = Omit<typeof trials.$inferSelect, "startedAt" | "finishedAt" | "detectedAt"> & { startedAt: string; finishedAt: string | null; detectedAt: string | null };
export type MetricSampleRow = Omit<typeof metricSamples.$inferSelect, "recordedAt"> & { recordedAt: string };
export type EventRow = Omit<typeof monitoringEvents.$inferSelect, "createdAt"> & { createdAt: string };

function nowIso() {
  return new Date().toISOString();
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

/** All dialect clients expose the same query surface (select/insert/update/run). */
type Db = BaseSQLiteDatabase<"async", "run", Record<string, never>>;

/**
 * Timestamps stay ISO strings in SQLite (text columns); PostgreSQL and MySQL
 * store Date objects. The union is deliberately untyped at the call sites —
 * this store is the single dialect bridge and the runtime value is correct
 * for whichever client was constructed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stamp(value: string): any {
  return isoOnly(config.monitoringDatabase) ? value : new Date(value);
}

function isoOnly(url: string) {
  return !url.startsWith("postgres") && !url.startsWith("mysql");
}

export class MonitoringStore {
  private readonly client: DatabaseClient;
  private readonly db: Db;

  constructor(client?: DatabaseClient) {
    this.client = client ?? createMonitoringDatabase(config.monitoringDatabase);
    this.db = this.client.db as Db;
  }

  get dialect() {
    return this.client.dialect;
  }

  // ---------------------------------------------------------------- devices

  async listDevices(): Promise<DeviceRow[]> {
    const rows = await this.db.select().from(devices).orderBy(devices.name);
    return rows.map((row) => ({ ...row, lastSeenAt: iso(row.lastSeenAt), createdAt: iso(row.createdAt)!, updatedAt: iso(row.updatedAt)! }));
  }

  async getDevice(id: string): Promise<DeviceRow | undefined> {
    const [row] = await this.db.select().from(devices).where(eq(devices.id, id)).limit(1);
    return row ? { ...row, lastSeenAt: iso(row.lastSeenAt), createdAt: iso(row.createdAt)!, updatedAt: iso(row.updatedAt)! } : undefined;
  }

  async upsertDevice(device: {
    id: string;
    name: string;
    kind: string;
    role: string;
    ipAddress: string;
    subnet: string;
    location: string;
    vendor?: string;
    model?: string | null;
    snmpCommunity?: string;
    snmpVersion?: string;
    pollIntervalSeconds?: number;
    timeoutSeconds?: number;
    latencyBaselineMs?: number;
    congestionThreshold?: number;
    enabled?: boolean;
    status?: string;
    lastSeenAt?: string | null;
  }): Promise<DeviceRow | undefined> {
    const timestamp = nowIso();
    const values = {
      id: device.id,
      name: device.name,
      kind: device.kind,
      role: device.role,
      ipAddress: device.ipAddress,
      subnet: device.subnet,
      location: device.location,
      vendor: device.vendor ?? "Cisco",
      model: device.model ?? null,
      snmpCommunity: device.snmpCommunity ?? "public",
      snmpVersion: device.snmpVersion ?? "2c",
      pollIntervalSeconds: device.pollIntervalSeconds ?? 30,
      timeoutSeconds: device.timeoutSeconds ?? 5,
      latencyBaselineMs: device.latencyBaselineMs ?? 1,
      congestionThreshold: device.congestionThreshold ?? 80,
      enabled: device.enabled ?? true,
      status: device.status ?? "unknown",
      lastSeenAt: device.lastSeenAt ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.db
      .insert(devices)
      .values(values)
      .onConflictDoUpdate({
        target: devices.id,
        set: {
          name: values.name,
          kind: values.kind,
          role: values.role,
          ipAddress: values.ipAddress,
          subnet: values.subnet,
          location: values.location,
          pollIntervalSeconds: values.pollIntervalSeconds,
          timeoutSeconds: values.timeoutSeconds,
          latencyBaselineMs: values.latencyBaselineMs,
          congestionThreshold: values.congestionThreshold,
          enabled: values.enabled,
          updatedAt: timestamp,
        },
      });
    return this.getDevice(device.id);
  }

  async updateDeviceStatus(id: string, status: string, lastSeenAt: string | null) {
    await this.db.update(devices).set({ status, lastSeenAt: lastSeenAt ? stamp(lastSeenAt) : null, updatedAt: stamp(nowIso()) }).where(eq(devices.id, id));
  }

  // ------------------------------------------------------------------ links

  async listLinks(): Promise<LinkRow[]> {
    const rows = await this.db.select().from(links).orderBy(links.name);
    return rows.map((row) => ({ ...row, createdAt: iso(row.createdAt)!, updatedAt: iso(row.updatedAt)! }));
  }

  async upsertLink(link: { id: string; name: string; sourceDeviceId: string; targetDeviceId: string; medium?: string; speedMbps?: number; up?: boolean; status?: string }) {
    const timestamp = nowIso();
    await this.db
      .insert(links)
      .values({
        id: link.id,
        name: link.name,
        sourceDeviceId: link.sourceDeviceId,
        targetDeviceId: link.targetDeviceId,
        medium: link.medium ?? "ethernet",
        speedMbps: link.speedMbps ?? 1000,
        status: link.status ?? "up",
        up: link.up ?? true,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .onConflictDoUpdate({
        target: links.id,
        set: { name: link.name, medium: link.medium ?? "ethernet", speedMbps: link.speedMbps ?? 1000, updatedAt: timestamp },
      });
  }

  async setLinkUp(id: string, up: boolean) {
    await this.db.update(links).set({ up, status: up ? "up" : "down", updatedAt: stamp(nowIso()) }).where(eq(links.id, id));
  }

  // ----------------------------------------------------------- poll results

  async recordPollResult(result: {
    id: string;
    deviceId: string;
    cycle: number;
    polledAt: string;
    responded: boolean;
    withinTimeout: boolean;
    responseTimeMs: number | null;
    latencyMs: number | null;
    jitterMs: number | null;
    packetLossPct: number | null;
    bandwidthUtilPct: number | null;
    cpuLoadPct: number | null;
    memoryLoadPct: number | null;
    uptimeSeconds: number | null;
    errorCode: string | null;
    errorMessage: string | null;
  }) {
    await this.db.insert(pollResults).values({ ...result, polledAt: stamp(result.polledAt) });
  }

  async listPollResults(limit = 200): Promise<PollRow[]> {
    const rows = await this.db.select().from(pollResults).orderBy(desc(pollResults.polledAt)).limit(limit);
    return rows.map((row) => ({ ...row, polledAt: iso(row.polledAt)! }));
  }

  async latestPollPerDevice(): Promise<Map<string, PollRow>> {
    const rows = await this.listPollResults(400);
    const latest = new Map<string, PollRow>();
    for (const row of rows) {
      if (!latest.has(row.deviceId)) latest.set(row.deviceId, row);
    }
    return latest;
  }

  // ----------------------------------------------------------------- faults

  async listFaults(limit = 100): Promise<FaultRow[]> {
    const rows = await this.db.select().from(faults).orderBy(desc(faults.detectedAt)).limit(limit);
    return rows.map(serializeFault);
  }

  async getFault(id: string): Promise<FaultRow | undefined> {
    const [row] = await this.db.select().from(faults).where(eq(faults.id, id)).limit(1);
    return row ? serializeFault(row) : undefined;
  }

  async findOpenFault(type: string, deviceId: string | null): Promise<FaultRow | undefined> {
    const [row] = await this.db
      .select()
      .from(faults)
      .where(and(eq(faults.type, type), deviceId ? eq(faults.deviceId, deviceId) : isNull(faults.deviceId), eq(faults.status, "open")))
      .limit(1);
    return row ? serializeFault(row) : undefined;
  }

  async findOpenCongestionFault(): Promise<FaultRow | undefined> {
    const [row] = await this.db
      .select()
      .from(faults)
      .where(and(eq(faults.type, "congestion"), isNull(faults.deviceId), eq(faults.status, "open")))
      .limit(1);
    return row ? serializeFault(row) : undefined;
  }

  async createFault(fault: {
    id: string;
    type: string;
    severity: string;
    title: string;
    description: string;
    deviceId: string | null;
    linkId: string | null;
    scenarioId?: string | null;
    trialId?: string | null;
    detectionTimeMs: number | null;
    detectedAt: string;
    detectedBy: string;
    status: string;
  }): Promise<FaultRow | undefined> {
    await this.db.insert(faults).values({ ...fault, detectedAt: stamp(fault.detectedAt) });
    return this.getFault(fault.id);
  }

  async resolveFault(id: string, resolvedAt: string, note: string): Promise<FaultRow | undefined> {
    const fault = await this.getFault(id);
    if (!fault) return undefined;
    const resolutionTimeMs = new Date(resolvedAt).getTime() - new Date(fault.detectedAt).getTime();
    await this.db.update(faults).set({ status: "resolved", resolvedAt: stamp(resolvedAt), resolutionTimeMs, resolutionNote: note }).where(eq(faults.id, id));
    return this.getFault(id);
  }

  async updateFaultStatus(id: string, status: string): Promise<FaultRow | undefined> {
    await this.db.update(faults).set({ status }).where(eq(faults.id, id));
    return this.getFault(id);
  }

  async listOpenFaultIds() {
    return this.db.select({ id: faults.id, type: faults.type, deviceId: faults.deviceId, linkId: faults.linkId }).from(faults).where(eq(faults.status, "open"));
  }

  // -------------------------------------------------- diagnoses + advisory

  async createDiagnosis(entry: {
    id: string;
    faultId: string;
    faultType: string;
    cause: string;
    summary: string;
    evidence: Array<Record<string, unknown>>;
    affectedDeviceIds: string[];
    confidencePct: number;
    diagnosedAt: string;
  }) {
    await this.db.insert(diagnoses).values({ ...entry, diagnosedAt: stamp(entry.diagnosedAt) });
  }

  async createRecommendation(entry: { id: string; diagnosisId: string; faultType: string; title: string; detail: string; priority: string; actionClass: string }) {
    await this.db.insert(recommendations).values(entry);
  }

  async listRecommendations(limit = 50): Promise<RecommendationRow[]> {
    const rows = await this.db.select().from(recommendations).orderBy(desc(recommendations.id)).limit(limit);
    return rows.map((row) => ({ ...row, acknowledgedAt: iso(row.acknowledgedAt) }));
  }

  async acknowledgeRecommendation(id: string) {
    await this.db.update(recommendations).set({ acknowledgedAt: stamp(nowIso()) }).where(eq(recommendations.id, id));
  }

  // ---------------------------------------------------------- notifications

  async createNotification(entry: { id: string; faultId: string | null; title: string; body: string; severity: string; channel?: string }) {
    await this.db.insert(notifications).values({ ...entry, channel: entry.channel ?? "in-app", createdAt: nowIso() });
  }

  async listNotifications(limit = 50): Promise<NotificationRow[]> {
    const rows = await this.db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(limit);
    return rows.map((row) => ({ ...row, readAt: iso(row.readAt), createdAt: iso(row.createdAt)! }));
  }

  async listUnreadNotifications(): Promise<NotificationRow[]> {
    const rows = await this.db.select().from(notifications).where(isNull(notifications.readAt)).orderBy(desc(notifications.createdAt));
    return rows.map((row) => ({ ...row, readAt: iso(row.readAt), createdAt: iso(row.createdAt)! }));
  }

  async markNotificationRead(id: string) {
    await this.db.update(notifications).set({ readAt: stamp(nowIso()) }).where(eq(notifications.id, id));
  }

  // -------------------------------------------------------------- scenarios

  async listScenarios(): Promise<ScenarioRow[]> {
    const rows = await this.db.select().from(scenarios).orderBy(scenarios.name);
    return rows.map((row) => ({ ...row, createdAt: iso(row.createdAt)! }));
  }

  async getScenario(id: string): Promise<ScenarioRow | undefined> {
    const [row] = await this.db.select().from(scenarios).where(eq(scenarios.id, id)).limit(1);
    return row ? { ...row, createdAt: iso(row.createdAt)! } : undefined;
  }

  async upsertScenario(scenario: { id: string; name: string; kind: string; description: string; targetDeviceId: string | null; targetLinkId: string | null; intensity: number }) {
    const timestamp = nowIso();
    await this.db
      .insert(scenarios)
      .values({ ...scenario, enabled: true, createdAt: timestamp })
      .onConflictDoUpdate({ target: scenarios.id, set: { name: scenario.name, description: scenario.description, intensity: scenario.intensity } });
  }

  // ----------------------------------------------------------------- trials

  async createTrial(trial: { id: string; scenarioId: string; trialNumber: number; monitor: string; startedAt: string; status: string }) {
    await this.db.insert(trials).values({ ...trial, startedAt: stamp(trial.startedAt) });
  }

  async getTrial(id: string): Promise<TrialRow | undefined> {
    const [row] = await this.db.select().from(trials).where(eq(trials.id, id)).limit(1);
    return row ? serializeTrial(row) : undefined;
  }

  async listTrials(scenarioId?: string): Promise<TrialRow[]> {
    const rows = scenarioId
      ? await this.db.select().from(trials).where(eq(trials.scenarioId, scenarioId)).orderBy(trials.trialNumber)
      : await this.db.select().from(trials).orderBy(trials.scenarioId, trials.trialNumber);
    return rows.map(serializeTrial);
  }

  async updateTrial(
    id: string,
    patch: Partial<{
      finishedAt: string | null;
      detectedAt: string | null;
      detectionTimeMs: number | null;
      diagnosisTimeMs: number | null;
      recoveryTimeMs: number | null;
      diagnosisAccuracy: boolean | null;
      detectedFaultType: string | null;
      packetLossPct: number | null;
      avgResponseTimeMs: number | null;
      status: string;
    }>,
  ) {
    const set: Record<string, unknown> = { ...patch };
    if (patch.finishedAt !== undefined) set.finishedAt = patch.finishedAt ? stamp(patch.finishedAt) : null;
    if (patch.detectedAt !== undefined) set.detectedAt = patch.detectedAt ? stamp(patch.detectedAt) : null;
    await this.db.update(trials).set(set).where(eq(trials.id, id));
    return this.getTrial(id);
  }

  // --------------------------------------------------------------- metrics

  async recordMetricSample(sample: {
    id: string;
    trialId: string | null;
    deviceId: string | null;
    recordedAt: string;
    responseTimeMs: number | null;
    latencyMs: number | null;
    packetLossPct: number | null;
    bandwidthUtilPct: number | null;
  }) {
    await this.db.insert(metricSamples).values({ ...sample, recordedAt: stamp(sample.recordedAt) });
  }

  async listMetricSamples(limit = 500): Promise<MetricSampleRow[]> {
    const rows = await this.db.select().from(metricSamples).orderBy(desc(metricSamples.recordedAt)).limit(limit);
    return rows.map((row) => ({ ...row, recordedAt: iso(row.recordedAt)! }));
  }

  // ----------------------------------------------------------------- events

  async logEvent(entry: { id: string; kind: string; message: string; deviceId?: string | null; faultId?: string | null; trialId?: string | null; payload?: Record<string, unknown> | null }) {
    await this.db.insert(monitoringEvents).values({ ...entry, createdAt: nowIso() });
  }

  async listEvents(limit = 100): Promise<EventRow[]> {
    const rows = await this.db.select().from(monitoringEvents).orderBy(desc(monitoringEvents.createdAt)).limit(limit);
    return rows.map((row) => ({ ...row, createdAt: iso(row.createdAt)! }));
  }

  /** Trim poll history so the embedded SQLite file stays small. */
  async prunePollResults(keepCycles = 600) {
    await this.db.run(sql`
      DELETE FROM poll_results WHERE cycle NOT IN (
        SELECT DISTINCT cycle FROM poll_results ORDER BY cycle DESC LIMIT ${keepCycles}
      )
    `);
  }
}

function serializeFault(row: typeof faults.$inferSelect): FaultRow {
  return { ...row, detectedAt: iso(row.detectedAt)!, resolvedAt: iso(row.resolvedAt) };
}

function serializeTrial(row: typeof trials.$inferSelect): TrialRow {
  return { ...row, startedAt: iso(row.startedAt)!, finishedAt: iso(row.finishedAt), detectedAt: iso(row.detectedAt) };
}

export const monitoringStore = new MonitoringStore();
