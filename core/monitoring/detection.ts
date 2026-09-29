/**
 * Automated fault detection, diagnosis, and recommendation (proposal §3.2.2b–d).
 *
 * Detection raises a fault when a device fails to respond within its 5 second
 * threshold. Unresponsive devices are grouped by their simulated root cause
 * (a powered-off device or a disconnected cable) so one physical fault
 * produces exactly one alert, and sustained high utilisation across the
 * campus raises a congestion fault.
 */
import type { PollSample, RootCause } from "@/core/monitoring/simulation";

export type FaultType = "device_failure" | "link_failure" | "congestion" | "unknown";
export type DiagnosisCause = "device" | "link" | "congestion" | "unknown";

export type DeviceContext = { id: string; name: string; kind: string; role: string; location: string; ipAddress?: string };

export type DetectionInput = {
  samples: PollSample[];
  devices: Map<string, DeviceContext>;
  rootCauses: RootCause[];
  /** Devices already known to be down, to avoid duplicate faults. */
  openFaultDeviceIds: Set<string>;
  /** Root-cause keys already covered by an open fault. */
  openRootCauseKeys: Set<string>;
  /** Campus-wide congestion fault currently open. */
  openCongestionIds: Set<string>;
  detectedAt: string;
};

export type DetectionCandidate = {
  /** Stable key for de-duplication, e.g. "device:edge-router" or "link:link-core-lab". */
  key: string;
  type: FaultType;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  deviceId: string | null;
  linkId: string | null;
  affectedDeviceIds: string[];
  primarySample: PollSample | null;
};

export type Diagnosis = {
  faultType: FaultType;
  cause: DiagnosisCause;
  summary: string;
  evidence: Array<Record<string, unknown>>;
  confidencePct: number;
};

export type Recommendation = {
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
  actionClass: "manual" | "assisted" | "automated";
};

/**
 * Detect faults for one poll cycle:
 *  - one candidate per unexplained root cause (device/link failure),
 *  - one per persistently slow device,
 *  - one campus congestion fault when ≥3 devices saturate.
 */
export function detectFaults(input: DetectionInput): DetectionCandidate[] {
  const candidates: DetectionCandidate[] = [];
  const claimed = new Set<string>();

  for (const cause of input.rootCauses) {
    const key = cause.kind === "device_failure" ? `device:${cause.deviceId}` : `link:${cause.linkId}`;
    if (input.openRootCauseKeys.has(key)) continue;
    const affected = cause.affectedDeviceIds.filter((id) => !input.openFaultDeviceIds.has(id));
    if (affected.length === 0) continue;
    for (const id of cause.affectedDeviceIds) claimed.add(id);

    if (cause.kind === "device_failure") {
      const device = input.devices.get(cause.deviceId);
      const sample = input.samples.find((entry) => entry.deviceId === cause.deviceId) ?? null;
      const isRouter = device?.kind === "router";
      candidates.push({
        key,
        type: "device_failure",
        severity: isRouter ? "critical" : "warning",
        title: `${device?.name ?? cause.deviceId} is not responding to SNMP`,
        description: isRouter
          ? `${device?.name ?? cause.deviceId} (${device?.ipAddress ?? "?"}) is unresponsive and ${cause.affectedDeviceIds.length - 1} downstream devices are unreachable with it — the router has failed.`
          : `${device?.name ?? cause.deviceId} (${device?.ipAddress ?? "?"}) at ${device?.location ?? "campus"} is unresponsive and ${Math.max(0, cause.affectedDeviceIds.length - 1)} downstream devices are unreachable with it.`,
        deviceId: cause.deviceId,
        linkId: null,
        affectedDeviceIds: cause.affectedDeviceIds,
        primarySample: sample,
      });
    } else {
      const device = input.devices.get(cause.deviceId);
      const sample = input.samples.find((entry) => entry.deviceId === cause.deviceId) ?? null;
      candidates.push({
        key,
        type: "link_failure",
        severity: "warning",
        title: `Link down: ${device?.name ?? cause.deviceId} is unreachable`,
        description: `${device?.name ?? cause.deviceId} (${device?.ipAddress ?? "?"}) stopped answering SNMP while the rest of the network stays healthy — its upstream cable is disconnected or the port is down.`,
        deviceId: cause.deviceId,
        linkId: cause.linkId,
        affectedDeviceIds: cause.affectedDeviceIds,
        primarySample: sample,
      });
    }
  }

  // Slow-response faults for devices that answer but exceed their timeout.
  for (const sample of input.samples) {
    if (!sample.responded || sample.withinTimeout || claimed.has(sample.deviceId)) continue;
    if (input.openRootCauseKeys.has(`slow:${sample.deviceId}`)) continue;
    const device = input.devices.get(sample.deviceId);
    if (!device) continue;
    claimed.add(sample.deviceId);
    candidates.push({
      key: `slow:${sample.deviceId}`,
      type: "congestion",
      severity: "warning",
      title: `${device.name} response time above threshold`,
      description: `${device.name} answered SNMP in ${sample.responseTimeMs} ms, exceeding its ${device.kind === "router" ? 5 : 5} s timeout — sustained congestion or overload.`,
      deviceId: device.id,
      linkId: null,
      affectedDeviceIds: [device.id],
      primarySample: sample,
    });
  }

  // Campus-wide congestion: many devices saturating at once.
  const congested = input.samples.filter((sample) => sample.responded && (sample.bandwidthUtilPct ?? 0) >= 80);
  if (congested.length >= 3 && !input.openCongestionIds.has("campus")) {
    candidates.push({
      key: "congestion:campus",
      type: "congestion",
      severity: "critical",
      title: "Network congestion across the campus core",
      description: `${congested.length} devices report bandwidth utilisation at or above 80% — demand is exceeding available capacity (proposal §3.2.2c).`,
      deviceId: null,
      linkId: null,
      affectedDeviceIds: congested.map((sample) => sample.deviceId),
      primarySample: congested[0] ?? null,
    });
  }

  return candidates;
}

/**
 * Diagnose a detection candidate against the full poll snapshot. The
 * root-cause classification from detection is confirmed and refined with
 * observed evidence (unresponsive pattern, utilisation, response times).
 */
export function diagnoseFault(candidate: DetectionCandidate, allSamples: PollSample[], devices: Map<string, DeviceContext>): Diagnosis {
  const unresponsive = allSamples.filter((sample) => !sample.responded);
  const unresponsiveIds = new Set(unresponsive.map((sample) => sample.deviceId));

  if (candidate.type === "congestion") {
    const evidence: Array<Record<string, unknown>> = allSamples
      .filter((sample) => sample.responded)
      .slice(0, 8)
      .map((sample) => ({ device: devices.get(sample.deviceId)?.name ?? sample.deviceId, responseTimeMs: sample.responseTimeMs, bandwidthUtilPct: sample.bandwidthUtilPct, packetLossPct: sample.packetLossPct }));
    const confidence = candidate.affectedDeviceIds.length >= 3 ? 92 : 74;
    return {
      faultType: "congestion",
      cause: "congestion",
      summary: candidate.affectedDeviceIds.length >= 3
        ? "Multiple devices show high response times and utilisation — sustained congestion is identified across the campus network."
        : "One device shows elevated response time with high utilisation — localised congestion is likely.",
      evidence,
      confidencePct: confidence,
    };
  }

  if (candidate.type === "device_failure" && candidate.deviceId) {
    const device = devices.get(candidate.deviceId);
    const downstream = [...unresponsiveIds].filter((id) => id !== candidate.deviceId);
    return {
      faultType: "device_failure",
      cause: "device",
      summary: device?.kind === "router"
        ? "The router is unresponsive and everything behind it is unreachable — a router device failure is flagged (proposal §3.2.2c)."
        : `${device?.name ?? candidate.deviceId} is unresponsive along with ${downstream.length} downstream device(s) — a switch device failure is flagged.`,
      evidence: [
        { signal: "snmp_timeout", device: device?.name ?? candidate.deviceId, error: candidate.primarySample?.errorCode ?? "SNMP_TIMEOUT" },
        { signal: "downstream_devices_down", count: downstream.length, devices: downstream.map((id) => devices.get(id)?.name ?? id) },
      ],
      confidencePct: device?.kind === "router" ? 95 : 88,
    };
  }

  // Link failure: unreachable devices while the rest of the network answers.
  const responsiveCount = allSamples.filter((sample) => sample.responded).length;
  const unresponsiveNames = [...unresponsiveIds].map((id) => devices.get(id)?.name ?? id);
  const isolated = unresponsiveIds.size === 1;
  return {
    faultType: "link_failure",
    cause: "link",
    summary: isolated
      ? "Only one PC is unreachable while every other device answers normally — a link failure on its access cable is diagnosed (proposal §3.2.2c)."
      : `${unresponsiveIds.size} endpoints sharing an upstream path are unreachable while the core stays healthy — the upstream link is the likely fault point.`,
    evidence: [
      { signal: "unreachable_devices", devices: unresponsiveNames },
      { signal: "responsive_device_count", count: responsiveCount },
    ],
    confidencePct: isolated ? 90 : 82,
  };
}

/** Map a diagnosis to the corrective recommendation presented to the admin. */
export function recommendFor(diagnosis: Diagnosis): Recommendation {
  if (diagnosis.faultType === "congestion") {
    return {
      title: "Relieve congestion and re-shape traffic",
      detail: "Schedule large transfers outside peak hours, enable QoS to prioritise learning applications, add bandwidth shaping on the congested switch ports, and consider upgrading the saturated uplink.",
      priority: diagnosis.confidencePct >= 85 ? "high" : "medium",
      actionClass: "assisted",
    };
  }
  if (diagnosis.faultType === "device_failure") {
    return {
      title: "Restore the failed device",
      detail: "Inspect the device power state and console cable, power-cycle the unit, verify SNMP reachability afterwards, and replace the hardware if it fails to boot. Escalate to the vendor if the fault repeats.",
      priority: "high",
      actionClass: "manual",
    };
  }
  if (diagnosis.faultType === "link_failure") {
    return {
      title: "Re-seat or replace the network cable",
      detail: "Physically inspect the cable between the affected device and its upstream switch port, re-seat both ends, replace the patch cord, and confirm the port LED is active. Move the device to a spare port if the link stays down.",
      priority: "medium",
      actionClass: "manual",
    };
  }
  return {
    title: "Investigate the unknown fault",
    detail: "Collect recent poll results and device logs, then escalate to the network administrator for on-site inspection.",
    priority: "low",
    actionClass: "manual",
  };
}
