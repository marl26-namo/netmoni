import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { automationStore } from "@/core/monitoring/automation-store";
import { runAutomation } from "@/core/monitoring/automation-engine";

type CanvasNode = {
  id: string;
  kind: "trigger" | "watch_device" | "notify_email";
  name: string;
  x?: number;
  y?: number;
  deviceName?: string;
  ipAddress?: string;
  subnet?: string;
  location?: string;
  pollIntervalSeconds?: number;
  timeoutSeconds?: number;
  email?: string;
};

type AutomationPayload = {
  name?: string;
  description?: string;
  enabled?: boolean;
  scheduleKind?: "interval" | "daily" | "cron";
  intervalSeconds?: number;
  dailyAt?: string | null;
  cron?: string | null;
  nodes?: CanvasNode[];
  edges?: Array<{ id: string; source: string; target: string }>;
  organizationId?: string;
};

export async function GET() {
  const [automations, runs] = await Promise.all([automationStore.listAutomations(), automationStore.listRuns(30)]);
  const withDetails = await Promise.all(
    automations.map(async (automation) => ({
      ...automation,
      nodes: await automationStore.listNodes(automation.id),
      edges: await automationStore.listEdges(automation.id),
      recipients: await automationStore.listRecipients(automation.id),
    })),
  );
  return NextResponse.json({ automations: withDetails, runs });
}

/** Create an automation from the canvas graph (nodes carry device name + IP). */
export async function POST(request: Request) {
  try {
    const body = await request.json() as AutomationPayload;
    if (!body.name?.trim()) return NextResponse.json({ error: "Automation name is required" }, { status: 400 });

    const id = randomUUID();
    const watchNodes = (body.nodes ?? []).filter((node) => node.kind === "watch_device");
    const emailNodes = (body.nodes ?? []).filter((node) => node.kind === "notify_email");
    if (watchNodes.length === 0) return NextResponse.json({ error: "Add at least one Watch device node with an IP address" }, { status: 400 });

    await automationStore.createAutomation({
      id,
      organizationId: body.organizationId ?? "local",
      name: body.name.trim(),
      description: body.description ?? "",
      enabled: body.enabled ?? true,
      scheduleKind: body.scheduleKind ?? "interval",
      intervalSeconds: body.intervalSeconds ?? 30,
      dailyAt: body.dailyAt ?? null,
      cron: body.cron ?? null,
      scheduleLabel:
        body.scheduleKind === "daily" && body.dailyAt
          ? `Daily at ${body.dailyAt}`
          : body.scheduleKind === "cron" && body.cron
            ? `Cron: ${body.cron}`
            : `Every ${body.intervalSeconds ?? 30} seconds`,
    });

    await automationStore.replaceNodes(
      id,
      (body.nodes ?? []).map((node) => ({
        id: node.id,
        kind: node.kind,
        name: node.name,
        positionX: node.x ?? 0,
        positionY: node.y ?? 0,
        deviceName: node.deviceName ?? null,
        ipAddress: node.ipAddress ?? null,
        subnet: node.subnet ?? null,
        location: node.location ?? null,
        pollIntervalSeconds: node.pollIntervalSeconds ?? null,
        timeoutSeconds: node.timeoutSeconds ?? null,
        email: node.email ?? null,
      })),
    );
    await automationStore.replaceEdges(
      id,
      (body.edges ?? []).map((edge) => ({ id: edge.id, sourceNodeId: edge.source, targetNodeId: edge.target })),
    );
    await automationStore.replaceRecipients(
      id,
      emailNodes.filter((node) => node.email).map((node) => ({ id: `${node.id}-r`, email: node.email!, label: node.name || "Administrator" })),
    );

    const automation = await automationStore.getAutomation(id);
    return NextResponse.json({ automation }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create automation" }, { status: 400 });
  }
}

/** Update (full graph replace), toggle, delete, or run an automation. */
export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as AutomationPayload & { id?: string; action?: "save" | "toggle" | "run" | "delete" };
    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const existing = await automationStore.getAutomation(body.id);
    if (!existing) return NextResponse.json({ error: "Automation not found" }, { status: 404 });

    if (body.action === "toggle") {
      const automation = await automationStore.updateAutomation(body.id, { enabled: body.enabled ?? !existing.enabled });
      return NextResponse.json({ automation });
    }
    if (body.action === "delete") {
      await automationStore.deleteAutomation(body.id);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "run") {
      const outcome = await runAutomation(body.id, "manual");
      return NextResponse.json({ outcome });
    }

    // Default: save graph + schedule.
    const watchNodes = (body.nodes ?? []).filter((node) => node.kind === "watch_device");
    if (watchNodes.length === 0) return NextResponse.json({ error: "Add at least one Watch device node with an IP address" }, { status: 400 });
    const emailNodes = (body.nodes ?? []).filter((node) => node.kind === "notify_email");

    await automationStore.updateAutomation(body.id, {
      name: body.name?.trim() || existing.name,
      description: body.description ?? existing.description,
      enabled: body.enabled ?? existing.enabled,
      scheduleKind: body.scheduleKind ?? existing.scheduleKind,
      intervalSeconds: body.intervalSeconds ?? existing.intervalSeconds,
      dailyAt: body.dailyAt ?? existing.dailyAt,
      cron: body.cron ?? existing.cron,
      scheduleLabel:
        body.scheduleKind === "daily" && body.dailyAt
          ? `Daily at ${body.dailyAt}`
          : body.scheduleKind === "cron" && body.cron
            ? `Cron: ${body.cron}`
            : `Every ${body.intervalSeconds ?? existing.intervalSeconds} seconds`,
    });
    await automationStore.replaceNodes(
      body.id,
      (body.nodes ?? []).map((node) => ({
        id: node.id,
        kind: node.kind,
        name: node.name,
        positionX: node.x ?? 0,
        positionY: node.y ?? 0,
        deviceName: node.deviceName ?? null,
        ipAddress: node.ipAddress ?? null,
        subnet: node.subnet ?? null,
        location: node.location ?? null,
        pollIntervalSeconds: node.pollIntervalSeconds ?? null,
        timeoutSeconds: node.timeoutSeconds ?? null,
        email: node.email ?? null,
      })),
    );
    await automationStore.replaceEdges(
      body.id,
      (body.edges ?? []).map((edge) => ({ id: edge.id, sourceNodeId: edge.source, targetNodeId: edge.target })),
    );
    await automationStore.replaceRecipients(
      body.id,
      emailNodes.filter((node) => node.email).map((node) => ({ id: `${node.id}-r`, email: node.email!, label: node.name || "Administrator" })),
    );
    const automation = await automationStore.getAutomation(body.id);
    return NextResponse.json({ automation });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Update failed" }, { status: 400 });
  }
}
