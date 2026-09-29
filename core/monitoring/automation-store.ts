/**
 * Automation store — canvas automations, nodes, edges, recipients, runs.
 * Same dialect-bridge pattern as MonitoringStore.
 */
import { and, desc, eq } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { createMonitoringDatabase, type DatabaseClient } from "@/db/client";
import { config } from "@/config";
import {
  automationEdges,
  automationNodes,
  automationRuns,
  automations,
  emailRecipients,
} from "@/db/schema/monitoring-sqlite";

export type AutomationRow = Omit<typeof automations.$inferSelect, "lastRunAt" | "nextRunAt" | "createdAt" | "updatedAt"> & {
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type AutomationNodeRow = Omit<typeof automationNodes.$inferSelect, "createdAt"> & { createdAt: string };
export type AutomationEdgeRow = Omit<typeof automationEdges.$inferSelect, "createdAt"> & { createdAt: string };
export type EmailRecipientRow = Omit<typeof emailRecipients.$inferSelect, "createdAt"> & { createdAt: string };
export type AutomationRunRow = Omit<typeof automationRuns.$inferSelect, "startedAt" | "finishedAt"> & { startedAt: string; finishedAt: string | null };

function nowIso() {
  return new Date().toISOString();
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stamp(value: string): any {
  const url = config.monitoringDatabase;
  return url.startsWith("postgres") || url.startsWith("mysql") ? new Date(value) : value;
}

type Db = BaseSQLiteDatabase<"async", "run", Record<string, never>>;

export class AutomationStore {
  private readonly client: DatabaseClient;
  private readonly db: Db;

  constructor(client?: DatabaseClient) {
    this.client = client ?? createMonitoringDatabase(config.monitoringDatabase);
    this.db = this.client.db as Db;
  }

  // ------------------------------------------------------------ automations

  async listAutomations(organizationId?: string): Promise<AutomationRow[]> {
    const rows = organizationId
      ? await this.db.select().from(automations).where(eq(automations.organizationId, organizationId)).orderBy(desc(automations.createdAt))
      : await this.db.select().from(automations).orderBy(desc(automations.createdAt));
    return rows.map(serializeAutomation);
  }

  async getAutomation(id: string): Promise<AutomationRow | undefined> {
    const [row] = await this.db.select().from(automations).where(eq(automations.id, id)).limit(1);
    return row ? serializeAutomation(row) : undefined;
  }

  async createAutomation(input: {
    id: string;
    organizationId?: string;
    name: string;
    description?: string;
    enabled?: boolean;
    scheduleKind?: string;
    intervalSeconds?: number;
    dailyAt?: string | null;
    cron?: string | null;
    scheduleLabel?: string;
    createdBy?: string | null;
  }): Promise<AutomationRow> {
    const timestamp = nowIso();
    await this.db.insert(automations).values({
      id: input.id,
      organizationId: input.organizationId ?? "local",
      name: input.name,
      description: input.description ?? "",
      enabled: input.enabled ?? true,
      scheduleKind: input.scheduleKind ?? "interval",
      intervalSeconds: Math.max(10, input.intervalSeconds ?? 30),
      dailyAt: input.dailyAt ?? null,
      cron: input.cron ?? null,
      scheduleLabel: input.scheduleLabel ?? `every ${input.intervalSeconds ?? 30} seconds`,
      lastRunAt: null,
      nextRunAt: stamp(new Date().toISOString()),
      createdBy: input.createdBy ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return (await this.getAutomation(input.id))!;
  }

  async updateAutomation(
    id: string,
    patch: Partial<{
      name: string;
      description: string;
      enabled: boolean;
      scheduleKind: string;
      intervalSeconds: number;
      dailyAt: string | null;
      cron: string | null;
      scheduleLabel: string;
      lastRunAt: string | null;
      nextRunAt: string | null;
    }>,
  ): Promise<AutomationRow | undefined> {
    const set: Record<string, unknown> = { ...patch, updatedAt: stamp(nowIso()) };
    if (patch.lastRunAt !== undefined) set.lastRunAt = patch.lastRunAt ? stamp(patch.lastRunAt) : null;
    if (patch.nextRunAt !== undefined) set.nextRunAt = patch.nextRunAt ? stamp(patch.nextRunAt) : null;
    await this.db.update(automations).set(set).where(eq(automations.id, id));
    return this.getAutomation(id);
  }

  async deleteAutomation(id: string) {
    await this.db.delete(automationEdges).where(eq(automationEdges.automationId, id));
    await this.db.delete(automationNodes).where(eq(automationNodes.automationId, id));
    await this.db.delete(emailRecipients).where(eq(emailRecipients.automationId, id));
    await this.db.delete(automationRuns).where(eq(automationRuns.automationId, id));
    await this.db.delete(automations).where(eq(automations.id, id));
  }

  async listDueAutomations(now: Date): Promise<AutomationRow[]> {
    const rows = await this.db.select().from(automations).where(eq(automations.enabled, true));
    const nowIsoStr = now.toISOString();
    return rows
      .map(serializeAutomation)
      .filter((automation) => !automation.nextRunAt || automation.nextRunAt <= nowIsoStr);
  }

  // ------------------------------------------------------------------ nodes

  async listNodes(automationId: string): Promise<AutomationNodeRow[]> {
    const rows = await this.db.select().from(automationNodes).where(eq(automationNodes.automationId, automationId));
    return rows.map((row) => ({ ...row, createdAt: iso(row.createdAt)! }));
  }

  async replaceNodes(automationId: string, nodes: Array<{
    id: string;
    kind: string;
    name: string;
    positionX?: number;
    positionY?: number;
    deviceName?: string | null;
    ipAddress?: string | null;
    subnet?: string | null;
    location?: string | null;
    pollIntervalSeconds?: number | null;
    timeoutSeconds?: number | null;
    email?: string | null;
    config?: Record<string, unknown> | null;
  }>) {
    await this.db.delete(automationNodes).where(eq(automationNodes.automationId, automationId));
    if (nodes.length === 0) return;
    await this.db.insert(automationNodes).values(
      nodes.map((node) => ({
        id: node.id,
        automationId,
        kind: node.kind,
        name: node.name,
        positionX: node.positionX ?? 0,
        positionY: node.positionY ?? 0,
        deviceName: node.deviceName ?? null,
        ipAddress: node.ipAddress ?? null,
        subnet: node.subnet ?? null,
        location: node.location ?? null,
        pollIntervalSeconds: node.pollIntervalSeconds ?? null,
        timeoutSeconds: node.timeoutSeconds ?? null,
        email: node.email ?? null,
        config: node.config ?? null,
        createdAt: stamp(nowIso()),
      })),
    );
  }

  // ------------------------------------------------------------------ edges

  async listEdges(automationId: string): Promise<AutomationEdgeRow[]> {
    const rows = await this.db.select().from(automationEdges).where(eq(automationEdges.automationId, automationId));
    return rows.map((row) => ({ ...row, createdAt: iso(row.createdAt)! }));
  }

  async replaceEdges(automationId: string, edges: Array<{ id: string; sourceNodeId: string; targetNodeId: string }>) {
    await this.db.delete(automationEdges).where(eq(automationEdges.automationId, automationId));
    if (edges.length === 0) return;
    await this.db.insert(automationEdges).values(
      edges.map((edge) => ({
        id: edge.id,
        automationId,
        sourceNodeId: edge.sourceNodeId,
        targetNodeId: edge.targetNodeId,
        createdAt: stamp(nowIso()),
      })),
    );
  }

  // ------------------------------------------------------------ recipients

  async listRecipients(automationId: string): Promise<EmailRecipientRow[]> {
    const rows = await this.db.select().from(emailRecipients).where(eq(emailRecipients.automationId, automationId));
    return rows.map((row) => ({ ...row, createdAt: iso(row.createdAt)! }));
  }

  async replaceRecipients(automationId: string, recipients: Array<{ id: string; email: string; label?: string }>) {
    await this.db.delete(emailRecipients).where(eq(emailRecipients.automationId, automationId));
    if (recipients.length === 0) return;
    await this.db.insert(emailRecipients).values(
      recipients.map((recipient) => ({
        id: recipient.id,
        automationId,
        email: recipient.email,
        label: recipient.label ?? "Administrator",
        createdAt: stamp(nowIso()),
      })),
    );
  }

  // ------------------------------------------------------------------ runs

  async createRun(run: {
    id: string;
    automationId: string;
    status?: string;
    trigger?: string;
    devicesChecked?: number;
    faultsDetected?: number;
    faultsResolved?: number;
    emailsSent?: number;
    emailStatus?: string | null;
    durationMs?: number;
    startedAt: string;
    finishedAt?: string | null;
  }) {
    await this.db.insert(automationRuns).values({
      id: run.id,
      automationId: run.automationId,
      status: run.status ?? "succeeded",
      trigger: run.trigger ?? "schedule",
      devicesChecked: run.devicesChecked ?? 0,
      faultsDetected: run.faultsDetected ?? 0,
      faultsResolved: run.faultsResolved ?? 0,
      emailsSent: run.emailsSent ?? 0,
      emailStatus: run.emailStatus ?? null,
      durationMs: run.durationMs ?? 0,
      startedAt: stamp(run.startedAt),
      finishedAt: run.finishedAt ? stamp(run.finishedAt) : null,
    });
  }

  async listRuns(automationId?: string | number, limit = 30): Promise<AutomationRunRow[]> {
    const automationFilter = typeof automationId === "string" ? automationId : undefined;
    const rows = automationFilter
      ? await this.db.select().from(automationRuns).where(eq(automationRuns.automationId, automationFilter)).orderBy(desc(automationRuns.startedAt)).limit(limit)
      : await this.db.select().from(automationRuns).orderBy(desc(automationRuns.startedAt)).limit(limit);
    return rows.map((row) => ({ ...row, startedAt: iso(row.startedAt)!, finishedAt: iso(row.finishedAt) }));
  }

  async countsForAutomation(automationId: string) {
    const [nodeCount] = await this.db.select({ id: automationNodes.id }).from(automationNodes).where(and(eq(automationNodes.automationId, automationId), eq(automationNodes.kind, "watch_device")));
    return { watchDevices: nodeCount ? 1 : 0 };
  }
}

function serializeAutomation(row: typeof automations.$inferSelect): AutomationRow {
  return {
    ...row,
    lastRunAt: iso(row.lastRunAt),
    nextRunAt: iso(row.nextRunAt),
    createdAt: iso(row.createdAt)!,
    updatedAt: iso(row.updatedAt)!,
  };
}

export const automationStore = new AutomationStore();
