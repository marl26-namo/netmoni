import type { Alert, Device, ProbeResult, ProbeRunDeviceResult, Severity } from "@/monitoring/types";

/**
 * Deterministic fault analyzer: converts raw probe results into a severity,
 * human-readable evidence list, and a first-pass diagnosis. When an AI key is
 * configured, the AI composer rewrites the summary/recommendation; this
 * deterministic path always works as the baseline and fallback.
 */

const TOOL_LABELS: Record<string, string> = {
  ping: "ICMP ping",
  snmp: "SNMP v2c",
  tcp: "TCP service check",
  http: "HTTP service check",
  dns: "DNS resolution",
};

function evidenceLine(result: ProbeResult) {
  const label = TOOL_LABELS[result.tool] ?? result.tool;
  return `${label}: ${result.detail}`;
}

function deviceLabel(device: Device) {
  return device.location ? `${device.name} (${device.ipAddress}, ${device.location})` : `${device.name} (${device.ipAddress})`;
}

export type FaultAnalysis = {
  faulted: boolean;
  severity: Severity;
  evidence: string[];
  failedTools: string[];
  title: string;
  summary: string;
  recommendation: string;
  latencyMs?: number;
  packetLossPct?: number;
  status: Device["status"];
};

export function analyzeDeviceFault(device: Device, probes: ProbeResult[], settings: { warningLatencyMs: number; packetLossThresholdPct: number }): FaultAnalysis {
  const ping = probes.find((p) => p.tool === "ping");
  const evidence = probes.map(evidenceLine);
  const failedTools = probes.filter((p) => !p.ok).map((p) => p.tool);

  const latency = ping?.latencyMs ?? probes.find((p) => p.latencyMs !== undefined && p.ok)?.latencyMs;
  const loss = ping?.packetLossPct ?? (ping && !ping.ok ? 100 : undefined);

  let severity: Severity | null = null;
  let title = "Device reachable";
  let summary = "";
  let recommendation = "";
  let status: Device["status"] = "online";

  const hostDown = !ping || !ping.ok;

  if (hostDown) {
    severity = "critical";
    title = `${device.name} is unreachable`;
    status = "offline";
    summary = `${deviceLabel(device)} did not answer ICMP echo requests and could not be reached on any tested service port. The device is considered OFFLINE: either it lost power, its uplink cable/WAN link is down, or an ACL now blocks the monitoring host.`;
    recommendation =
      `Dispatch a technician to the physical location of ${device.name}${device.location ? ` (${device.location})` : ""}. ` +
      `On site: (1) confirm the device has power and its status LEDs are healthy; (2) reseat or replace the uplink patch cable; ` +
      `(3) check the upstream switch/router port for link light and errors; (4) power-cycle the device if it is unresponsive; ` +
      `(5) verify no firewall/ACL change is blocking ${device.ipAddress} from the monitoring server.`;
  } else if (loss !== undefined && loss > settings.packetLossThresholdPct) {
    severity = "warning";
    title = `${device.name} is losing packets`;
    status = "warning";
    summary = `${deviceLabel(device)} responds to ping but is dropping ${loss}% of packets (threshold ${settings.packetLossThresholdPct}%). This points to a degraded link: duplex mismatch, failing cable, RF interference (for wireless), or congestion.`;
    recommendation =
      `Inspect the physical path for ${device.name}${device.location ? ` (${device.location})` : ""}: replace suspect patch cables, verify port duplex/speed settings on both ends, ` +
      `check interface error counters via SNMP, and if wireless, survey signal strength and channel utilization at the site.`;
  } else if (latency !== undefined && latency > settings.warningLatencyMs) {
    severity = "warning";
    title = `${device.name} is responding slowly`;
    status = "warning";
    summary = `${deviceLabel(device)} answers in ${latency} ms, above the ${settings.warningLatencyMs} ms threshold. Traffic to and through this node is being delayed — likely saturation, routing detour, or an overloaded CPU.`;
    recommendation =
      `Check bandwidth/CPU utilization on ${device.name}, review QoS policies, and look for topology changes that could add hops. ` +
      `If the delay persists at the site, test with a direct laptop-to-device connection to isolate the cause.`;
  } else if (failedTools.length && !probes.every((p) => p.tool === "ping" || p.ok)) {
    severity = "warning";
    title = `${device.name} has degraded services`;
    status = "warning";
    const down = probes.filter((p) => !p.ok).map((p) => TOOL_LABELS[p.tool] ?? p.tool).join(", ");
    summary = `${deviceLabel(device)} answers ping but these service checks failed: ${down}. The host is up but at least one expected service is not responding.`;
    recommendation = `Connect to ${device.name} and verify the failing services are running and reachable; check local firewall rules and service configuration at the site.`;
  }

  return {
    faulted: severity !== null,
    severity: severity ?? "info",
    evidence,
    failedTools,
    title,
    summary: summary || `${deviceLabel(device)} passed all probes: ${evidence.join("; ")}.`,
    recommendation: recommendation || "No action required — all network probes passed.",
    latencyMs: latency,
    packetLossPct: loss,
    status,
  };
}

/** Builds the administrator email from the fault analysis (AI rewrites it when a key is configured). */
export function alertEmailSubject(alert: Pick<Alert, "severity" | "title" | "ipAddress" | "deviceName">) {
  const prefix = alert.severity === "critical" ? "[NETWORK CRITICAL]" : alert.severity === "warning" ? "[NETWORK WARNING]" : "[NETWORK INFO]";
  return `${prefix} ${alert.title} — ${alert.deviceName} (${alert.ipAddress})`;
}

export function alertEmailBody(alert: Omit<Alert, "probesFailed" | "emailDispatched"> & { probesFailed?: string[]; emailDispatched?: boolean }, run?: ProbeRunDeviceResult) {
  const lines = [
    `A network fault was detected by NetMoni automated monitoring.`,
    ``,
    `DEVICE:     ${alert.deviceName}`,
    `IP ADDRESS: ${alert.ipAddress}`,
    `SEVERITY:   ${alert.severity.toUpperCase()}`,
    `STATUS:     ${alert.status.toUpperCase()}`,
    `DETECTED:   ${new Date(alert.createdAt).toLocaleString()}`,
    ``,
    `WHAT HAPPENED`,
    `-------------`,
    alert.summary,
    ``,
    `EVIDENCE (probe output)`,
    `-----------------------`,
    ...alert.evidence.map((line) => ` - ${line}`),
    ``,
    `RECOMMENDED ACTION — please go to the device location`,
    `-----------------------------------------------------`,
    alert.recommendation,
    ``,
  ];
  if (run?.probes?.length) {
    lines.push(`RAW PROBE DATA`, `--------------`);
    for (const probe of run.probes) {
      lines.push(` - [${probe.tool}] ${probe.target} → ${probe.ok ? "OK" : "FAIL"}${probe.latencyMs !== undefined ? ` (${probe.latencyMs} ms)` : ""}: ${probe.detail}`);
    }
    lines.push(``);
  }
  lines.push(`This alert was generated automatically by the NetMoni monitoring engine.`, `Alert ID: ${alert.id}`);
  return lines.join("\n");
}
