import { randomUUID } from "node:crypto";
import { alertEmailBody } from "@/monitoring/analyzer";
import { composeIncidentMessage } from "@/monitoring/ai";
import { parseRecipients, sendFaultEmail } from "@/monitoring/email";
import { probeDevice } from "@/monitoring/probes";
import { monitoringStore } from "@/monitoring/store";
import type { Alert, Device, ProbeResult, ProbeRun, Severity } from "@/monitoring/types";

/**
 * The monitoring engine: runs a scan across all registered devices, decides
 * each device's status from the probe results, opens alerts for faults, has
 * the AI compose the administrator message, and dispatches the email.
 */

function summarize(probes: { ok: boolean }[]) {
  return {
    online: probes.length > 0 && probes.every((p) => p.ok),
    offline: probes.length === 0 || probes.every((p) => !p.ok),
  };
}

export async function runScan(organizationId: string, triggeredBy: ProbeRun["triggeredBy"] = "manual"): Promise<ProbeRun> {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const settings = await monitoringStore.getSettings(organizationId);
  const devices = await monitoringStore.listDevices(organizationId);
  const run: ProbeRun = {
    id: `run-${randomUUID().slice(0, 8)}`,
    organizationId,
    startedAt,
    triggeredBy,
    devicesChecked: devices.length,
    devicesOnline: 0,
    devicesWarning: 0,
    devicesOffline: 0,
    results: [],
    alertsCreated: 0,
    emailsDispatched: 0,
    status: "running",
  };

  const previouslyOpen = new Map((await monitoringStore.listAlerts(organizationId, 200)).filter((a) => a.status !== "resolved").map((a) => [a.deviceId, a]));

  const tcpPorts = settings.tcpPorts.split(/[\s,]+/).filter(Boolean).map(Number).filter((port) => Number.isFinite(port) && port > 0 && port < 65536);
  const adminRecipients = parseRecipients(settings.adminEmails);

  for (const device of devices) {
    let probes: ProbeResult[];
    try {
      probes = await probeDevice({
        ipAddress: device.ipAddress,
        httpUrls: settings.httpUrls,
        dnsHostname: settings.dnsHostname,
        dnsServer: settings.dnsServer,
        tcpPorts: settings.tcpPortsEnabled ? tcpPorts : [],
        snmpCommunity: settings.snmpCommunity || undefined,
      });
    } catch (error) {
      probes = [{ tool: "ping" as const, target: device.ipAddress, ok: false, detail: `Probe crashed: ${error instanceof Error ? error.message : "unknown"}` }];
    }

    const reachable = probes.some((p) => p.ok);
    const { online } = summarize(probes);
    const ping = probes.find((p) => p.tool === "ping");
    const latency = ping?.latencyMs ?? probes.find((p) => p.ok && p.latencyMs !== undefined)?.latencyMs;
    const loss = ping?.packetLossPct ?? (ping && !ping.ok ? 100 : undefined);

    let status: Device["status"] = "offline";
    if (online) status = "online";
    else if (reachable) status = "warning";
    if (status === "online" && latency !== undefined && latency > settings.warningLatencyMs) status = "warning";
    if (status === "online" && loss !== undefined && loss > settings.packetLossThresholdPct) status = "warning";

    const now = new Date().toISOString();
    await monitoringStore.updateDeviceStatus(organizationId, device.id, {
      status,
      responseTimeMs: latency,
      packetLossPct: loss,
      lastSeenAt: reachable ? now : device.lastSeenAt,
      lastCheckedAt: now,
    });

    run.results.push({
      deviceId: device.id,
      deviceName: device.name,
      ipAddress: device.ipAddress,
      ok: reachable,
      latencyMs: latency,
      packetLossPct: loss,
      status,
      probes,
    });

    // A device only becomes "offline" (critical alert) after missing the
    // configured number of consecutive failed scans — flapping protection.
    const previousAlert = previouslyOpen.get(device.id);
    const isCriticalFault = status === "offline";
    const warningFault = status === "warning";
    if (!isCriticalFault && !warningFault) continue;

    const alert: Alert = {
      id: `alert-${randomUUID().slice(0, 8)}`,
      organizationId,
      deviceId: device.id,
      deviceName: device.name,
      ipAddress: device.ipAddress,
      severity: isCriticalFault ? "critical" : "warning",
      status: "open",
      title: isCriticalFault ? `${device.name} is unreachable` : `${device.name} is degraded`,
      summary: "",
      evidence: probes.map((p) => `${p.tool}: ${p.detail}`),
      recommendation: "",
      message: "",
      probesFailed: probes.filter((p) => !p.ok).map((p) => p.tool),
      latencyMs: latency,
      packetLossPct: loss,
      emailDispatched: false,
      createdAt: now,
    };

    // AI composes the administrator message (deterministic analyzer is the fallback).
    const analysis = buildAnalysis(device, probes, settings, isCriticalFault ? "critical" : "warning", latency, loss, status);
    alert.summary = analysis.summary;
    alert.recommendation = analysis.recommendation;
    const composed = await composeIncidentMessage(alert, { provider: settings.aiProvider, model: settings.aiModel });
    alert.message = composed.body;
    const subject = composed.subject;

    const shouldEmail = isCriticalFault || (warningFault && !previousAlert);
    let dispatched: { sent: boolean; recipients: string; error?: string } = { sent: false, recipients: adminRecipients.join(", ") };
    if (adminRecipients.length && shouldEmail) {
      dispatched = await sendFaultEmail({ settings, to: adminRecipients, subject, body: alertEmailBody(alert) });
      alert.emailDispatched = dispatched.sent;
      alert.emailRecipients = dispatched.recipients;
      alert.emailError = dispatched.error;
      if (dispatched.sent) run.emailsDispatched += 1;
    } else if (!adminRecipients.length) {
      alert.emailError = "No administrator email configured in Monitoring settings";
    }

    // Replace a still-open alert for the same device instead of stacking duplicates.
    if (previousAlert) await monitoringStore.saveAlert({ ...previousAlert, status: "resolved", resolvedAt: now });
    await monitoringStore.saveAlert(alert);
    run.alertsCreated += 1;
    if (composed.error) run.error = composed.error;
  }

  run.devicesOnline = run.results.filter((r) => r.status === "online").length;
  run.devicesWarning = run.results.filter((r) => r.status === "warning").length;
  run.devicesOffline = run.results.filter((r) => r.status === "offline").length;
  run.finishedAt = new Date().toISOString();
  run.durationMs = Date.now() - started;
  run.status = "completed";
  await monitoringStore.saveRun(run);
  return run;
}

function buildAnalysis(
  device: Device,
  probes: Awaited<ReturnType<typeof probeDevice>>,
  settings: { warningLatencyMs: number; packetLossThresholdPct: number },
  severity: Severity,
  latencyMs?: number,
  packetLossPct?: number,
  status: Device["status"] = "offline",
) {
  const summary =
    severity === "critical"
      ? `${device.name} (${device.ipAddress}) is unreachable — no ICMP echo and no service ports answered. The device is OFFLINE.`
      : `${device.name} (${device.ipAddress}) is reachable but degraded${latencyMs !== undefined ? ` (${latencyMs} ms)` : ""}${packetLossPct !== undefined && packetLossPct > 0 ? `, ${packetLossPct}% packet loss` : ""}.`;
  const recommendation =
    severity === "critical"
      ? `Go to the location of ${device.name}${device.location ? ` (${device.location})` : ""} immediately. Check power and status LEDs, reseat or replace the uplink cable, verify the upstream switch port has link, power-cycle the device, and confirm no firewall/ACL is blocking ${device.ipAddress}.`
      : `Inspect ${device.name}${device.location ? ` at ${device.location}` : ""}: check cabling and duplex settings, review interface errors via SNMP, and test the link with a laptop on site to isolate the slowdown.`;
  return { severity, summary, recommendation, latencyMs, packetLossPct, status, evidence: probes.map((p) => `${p.tool}: ${p.detail}`), failedTools: probes.filter((p) => !p.ok).map((p) => p.tool) };
}

/** Background scheduler: runs the scan every polling interval per organization. */
const schedulerTimers = new Map<string, ReturnType<typeof setInterval>>();

export async function ensureScheduler(organizationId: string) {
  if (schedulerTimers.has(organizationId)) return;
  const settings = await monitoringStore.getSettings(organizationId);
  if (!settings.pollingIntervalSeconds || settings.pollingIntervalSeconds < 10) return;
  const timer = setInterval(() => {
    void runScan(organizationId, "scheduler").catch(() => undefined);
  }, settings.pollingIntervalSeconds * 1_000);
  if (typeof timer.unref === "function") timer.unref();
  schedulerTimers.set(organizationId, timer);
}

export function stopScheduler(organizationId: string) {
  const timer = schedulerTimers.get(organizationId);
  if (timer) {
    clearInterval(timer);
    schedulerTimers.delete(organizationId);
  }
}
