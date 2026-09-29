/**
 * Automation engine — runs network-watch automations on their schedule.
 *
 * An automation is a canvas graph (n8n style):
 *   trigger (manual/schedule) → watch_device nodes → notify_email nodes
 *
 * On every run the engine:
 *  1. Syncs watch_device nodes into the devices table (name + IP persist).
 *  2. Runs a poll cycle across the automation's devices.
 *  3. Emails every notify_email recipient about new/updated faults.
 *  4. Records the run (devices, faults, emails, duration) for the run log.
 */
import { randomUUID } from "node:crypto";
import { automationStore, type AutomationRow } from "@/core/monitoring/automation-store";
import { monitoringStore } from "@/core/monitoring/store";
import { runPollCycle } from "@/core/monitoring/engine";
import { sendAdminEmail } from "@/core/monitoring/email";

export type RunOutcome = {
  runId: string;
  automationId: string;
  devicesChecked: number;
  faultsDetected: number;
  faultsResolved: number;
  emailsSent: number;
  emailStatus: string | null;
  durationMs: number;
  triggeredBy: "schedule" | "manual";
};

/** Human-readable schedule for the UI. */
export function describeSchedule(automation: Pick<AutomationRow, "scheduleKind" | "intervalSeconds" | "dailyAt" | "cron" | "scheduleLabel">) {
  if (automation.scheduleKind === "daily" && automation.dailyAt) return `Daily at ${automation.dailyAt}`;
  if (automation.scheduleKind === "cron" && automation.cron) return `Cron: ${automation.cron}`;
  return automation.scheduleLabel || `Every ${automation.intervalSeconds}s`;
}

function nextRunAt(automation: AutomationRow, from = new Date()): string {
  if (automation.scheduleKind === "daily" && automation.dailyAt) {
    const [hours, minutes] = automation.dailyAt.split(":").map((part) => Number(part));
    const next = new Date(from);
    next.setHours(Number.isFinite(hours) ? hours : 7, Number.isFinite(minutes) ? minutes : 0, 0, 0);
    if (next.getTime() <= from.getTime()) next.setDate(next.getDate() + 1);
    return next.toISOString();
  }
  const intervalMs = Math.max(10, automation.intervalSeconds) * 1_000;
  return new Date(from.getTime() + intervalMs).toISOString();
}

/** Sync watch_device canvas nodes into the devices table (name + IP persist). */
export async function syncAutomationDevices(automationId: string): Promise<number> {
  const nodes = await automationStore.listNodes(automationId);
  const watchNodes = nodes.filter((node) => node.kind === "watch_device" && node.ipAddress);
  for (const node of watchNodes) {
    const existing = await monitoringStore.getDevice(node.id);
    await monitoringStore.upsertDevice({
      id: node.id,
      name: node.deviceName || node.name,
      kind: guessKind(node.deviceName || node.name),
      role: "access",
      ipAddress: node.ipAddress!,
      subnet: node.subnet ?? "192.168.1.0/24",
      location: node.location ?? "campus",
      pollIntervalSeconds: node.pollIntervalSeconds ?? 30,
      timeoutSeconds: node.timeoutSeconds ?? 5,
      status: existing?.status === "down" ? "unknown" : existing?.status ?? "unknown",
      enabled: true,
    });
  }
  return watchNodes.length;
}

function guessKind(name: string): string {
  const lowered = name.toLowerCase();
  if (lowered.includes("router")) return "router";
  if (lowered.includes("switch")) return "switch";
  if (lowered.includes("server")) return "server";
  return "pc";
}

/**
 * Execute one automation run. `trigger` distinguishes scheduler ticks from
 * the dashboard "Run now" button.
 */
export async function runAutomation(automationId: string, trigger: "schedule" | "manual" = "schedule"): Promise<RunOutcome> {
  const automation = await automationStore.getAutomation(automationId);
  if (!automation) throw new Error("Unknown automation");
  const startedAt = new Date();
  const runId = randomUUID();

  const deviceCount = await syncAutomationDevices(automationId);
  const recipients = (await automationStore.listRecipients(automationId)).map((recipient) => recipient.email);
  const nodes = await automationStore.listNodes(automationId);
  const hasWatchNodes = nodes.some((node) => node.kind === "watch_device");

  // A poll cycle covers every enabled device, including canvas-synced ones.
  const poll = hasWatchNodes || deviceCount > 0 ? await runPollCycle() : null;
  const newFaults = poll?.faultsDetected ?? [];
  const resolved = poll?.faultsResolved ?? [];

  // Persist a notification row per new fault (dedup happens in the pipeline).
  let emailsSent = 0;
  let emailStatus: string | null = null;

  if (newFaults.length > 0 && recipients.length > 0) {
    const subject = `MUBAS NetWatch: ${newFaults.length} new fault${newFaults.length === 1 ? "" : "s"} detected`;
    const lines = newFaults.map((fault) => `• [${fault.type.replace("_", " ")}] ${fault.title}`);
    const body = [
      `Automation "${automation.name}" detected ${newFaults.length} new network fault(s) at ${new Date().toLocaleString()}.`,
      "",
      ...lines,
      "",
      "Open the dashboard for diagnosis and recommended actions.",
    ].join("\n");
    const result = await sendAdminEmail(recipients, subject, body);
    emailsSent = result.sent ? recipients.length : 0;
    emailStatus = result.sent ? "sent" : (result.error ?? "skipped");
  } else if (newFaults.length > 0) {
    emailStatus = "no recipients configured";
  } else {
    emailStatus = recipients.length > 0 ? "no new faults — no email needed" : null;
  }

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();

  await automationStore.createRun({
    id: runId,
    automationId,
    status: "succeeded",
    trigger,
    devicesChecked: poll?.results.length ?? deviceCount,
    faultsDetected: newFaults.length,
    faultsResolved: resolved.length,
    emailsSent,
    emailStatus,
    durationMs,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
  });

  await automationStore.updateAutomation(automationId, {
    lastRunAt: startedAt.toISOString(),
    nextRunAt: nextRunAt(automation, finishedAt),
  });

  return {
    runId,
    automationId,
    devicesChecked: poll?.results.length ?? deviceCount,
    faultsDetected: newFaults.length,
    faultsResolved: resolved.length,
    emailsSent,
    emailStatus,
    durationMs,
    triggeredBy: trigger,
  };
}

/**
 * Scheduler tick — run every due automation. Called from the dashboard's
 * polling heartbeat and from POST /api/monitoring/automations/scheduler.
 */
export async function runDueAutomations(now = new Date()): Promise<RunOutcome[]> {
  const due = await automationStore.listDueAutomations(now);
  const outcomes: RunOutcome[] = [];
  for (const automation of due) {
    try {
      outcomes.push(await runAutomation(automation.id, "schedule"));
    } catch {
      // A failing automation must never block the rest of the scheduler.
    }
  }
  return outcomes;
}
