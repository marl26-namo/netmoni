/**
 * Simulated Cisco Packet Tracer environment (proposal §3.2.1).
 *
 * The simulation emulates SNMP GET behaviour against the seeded topology:
 * static IPs in 192.168.1.0/24 for campus devices and 192.168.2.0/24 for the
 * server. Fault scenarios introduced through the console alter device/link
 * state and the simulated metrics observed by the monitoring engine.
 */

export type DeviceKind = "router" | "switch" | "pc" | "server";
export type DeviceRole = "core" | "distribution" | "access" | "endpoint";
export type DeviceStatus = "unknown" | "up" | "degraded" | "down";

export type SimulatedDevice = {
  id: string;
  name: string;
  kind: DeviceKind;
  role: DeviceRole;
  ipAddress: string;
  subnet: string;
  location: string;
  model: string;
  latencyBaselineMs: number;
  congestionThreshold: number;
  enabled: boolean;
  status: DeviceStatus;
  /** Simulated state used by the packet-tracer style engine. */
  powered: boolean;
};

export type SimulatedLink = {
  id: string;
  name: string;
  sourceDeviceId: string;
  targetDeviceId: string;
  medium: string;
  speedMbps: number;
  up: boolean;
};

export type PollSample = {
  deviceId: string;
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
};

/** Seeded topology mirroring the proposal's campus design. */
export const seedDevices: Array<Omit<SimulatedDevice, "status" | "powered">> = [
  { id: "edge-router", name: "MUBAS-EDGE-ROUTER", kind: "router", role: "core", ipAddress: "192.168.1.1", subnet: "192.168.1.0/24", location: "Server Room", model: "Cisco 2911", latencyBaselineMs: 1, congestionThreshold: 80, enabled: true },
  { id: "core-switch", name: "MUBAS-CORE-SWITCH", kind: "switch", role: "core", ipAddress: "192.168.1.2", subnet: "192.168.1.0/24", location: "Server Room", model: "Cisco 3560", latencyBaselineMs: 1, congestionThreshold: 80, enabled: true },
  { id: "lab-switch", name: "LAB-SWITCH", kind: "switch", role: "distribution", ipAddress: "192.168.1.3", subnet: "192.168.1.0/24", location: "Laboratory", model: "Cisco 2960", latencyBaselineMs: 2, congestionThreshold: 75, enabled: true },
  { id: "hostel-switch", name: "HOSTEL-SWITCH", kind: "switch", role: "distribution", ipAddress: "192.168.1.4", subnet: "192.168.1.0/24", location: "Hostel", model: "Cisco 2960", latencyBaselineMs: 2, congestionThreshold: 75, enabled: true },
  { id: "library-switch", name: "LIBRARY-SWITCH", kind: "switch", role: "distribution", ipAddress: "192.168.1.5", subnet: "192.168.1.0/24", location: "Library", model: "Cisco 2960", latencyBaselineMs: 2, congestionThreshold: 75, enabled: true },
  { id: "lab-pc-1", name: "LAB-PC-1", kind: "pc", role: "endpoint", ipAddress: "192.168.1.11", subnet: "192.168.1.0/24", location: "Laboratory", model: "Desktop PC", latencyBaselineMs: 3, congestionThreshold: 70, enabled: true },
  { id: "lab-pc-2", name: "LAB-PC-2", kind: "pc", role: "endpoint", ipAddress: "192.168.1.12", subnet: "192.168.1.0/24", location: "Laboratory", model: "Desktop PC", latencyBaselineMs: 3, congestionThreshold: 70, enabled: true },
  { id: "hostel-pc-1", name: "HOSTEL-PC-1", kind: "pc", role: "endpoint", ipAddress: "192.168.1.21", subnet: "192.168.1.0/24", location: "Hostel", model: "Desktop PC", latencyBaselineMs: 4, congestionThreshold: 70, enabled: true },
  { id: "library-pc-1", name: "LIBRARY-PC-1", kind: "pc", role: "endpoint", ipAddress: "192.168.1.31", subnet: "192.168.1.0/24", location: "Library", model: "Desktop PC", latencyBaselineMs: 4, congestionThreshold: 70, enabled: true },
  { id: "mubas-server", name: "MUBAS-SERVER", kind: "server", role: "endpoint", ipAddress: "192.168.2.10", subnet: "192.168.2.0/24", location: "Server Room", model: "Server", latencyBaselineMs: 2, congestionThreshold: 80, enabled: true },
];

export const seedLinks: Array<Omit<SimulatedLink, "up">> = [
  { id: "link-router-core", name: "Router–Core Switch", sourceDeviceId: "edge-router", targetDeviceId: "core-switch", medium: "fiber", speedMbps: 1000 },
  { id: "link-core-lab", name: "Core–Lab Switch", sourceDeviceId: "core-switch", targetDeviceId: "lab-switch", medium: "ethernet", speedMbps: 1000 },
  { id: "link-core-hostel", name: "Core–Hostel Switch", sourceDeviceId: "core-switch", targetDeviceId: "hostel-switch", medium: "ethernet", speedMbps: 1000 },
  { id: "link-core-library", name: "Core–Library Switch", sourceDeviceId: "core-switch", targetDeviceId: "library-switch", medium: "ethernet", speedMbps: 1000 },
  { id: "link-lab-pc1", name: "Lab Switch–PC 1", sourceDeviceId: "lab-switch", targetDeviceId: "lab-pc-1", medium: "ethernet", speedMbps: 100 },
  { id: "link-lab-pc2", name: "Lab Switch–PC 2", sourceDeviceId: "lab-switch", targetDeviceId: "lab-pc-2", medium: "ethernet", speedMbps: 100 },
  { id: "link-hostel-pc1", name: "Hostel Switch–PC 1", sourceDeviceId: "hostel-switch", targetDeviceId: "hostel-pc-1", medium: "ethernet", speedMbps: 100 },
  { id: "link-library-pc1", name: "Library Switch–PC 1", sourceDeviceId: "library-switch", targetDeviceId: "library-pc-1", medium: "ethernet", speedMbps: 100 },
  { id: "link-core-server", name: "Core–MUBAS Server", sourceDeviceId: "core-switch", targetDeviceId: "mubas-server", medium: "fiber", speedMbps: 1000 },
];

/** Seeded fault scenarios (proposal §3.4). */
export const seedScenarios = [
  { id: "scenario-device-router", name: "Router power off", kind: "device_failure" as const, description: "The edge router is powered off in Cisco Packet Tracer.", targetDeviceId: "edge-router", targetLinkId: null as string | null, intensity: 0 },
  { id: "scenario-device-labswitch", name: "Lab switch power off", kind: "device_failure" as const, description: "The laboratory switch is powered off in Cisco Packet Tracer.", targetDeviceId: "lab-switch", targetLinkId: null as string | null, intensity: 0 },
  { id: "scenario-link-lab", name: "Lab cable disconnect", kind: "link_failure" as const, description: "The cable between the core and lab switch is unplugged.", targetDeviceId: null as string | null, targetLinkId: "link-core-lab", intensity: 0 },
  { id: "scenario-link-hostel", name: "Hostel cable disconnect", kind: "link_failure" as const, description: "The cable between the core and hostel switch is unplugged.", targetDeviceId: null as string | null, targetLinkId: "link-core-hostel", intensity: 0 },
  { id: "scenario-congestion", name: "Lab + hostel traffic flood", kind: "congestion" as const, description: "Multiple PCs simultaneously send continuous traffic to the server.", targetDeviceId: null as string | null, targetLinkId: null as string | null, intensity: 70 },
];

/**
 * Deterministic pseudo-random generator so trial measurements are
 * reproducible for the statistical analysis in the report.
 */
export function seededRandom(seed: number) {
  let state = seed % 2_147_483_647;
  if (state <= 0) state += 2_147_483_646;
  return () => {
    state = (state * 16_807) % 2_147_483_647;
    return (state - 1) / 2_147_483_646;
  };
}

export function bootSeconds(device: SimulatedDevice, now: number) {
  return Math.max(60, Math.floor(now / 1000) % (90 * 24 * 3600));
}

export type SimulationState = {
  devices: Map<string, SimulatedDevice>;
  links: Map<string, SimulatedLink>;
  congestion: Map<string, number>;
  cycle: number;
  seed: number;
};

export function createSimulationState(): SimulationState {
  return {
    devices: new Map(seedDevices.map((device) => [device.id, { ...device, powered: true, status: "up" as DeviceStatus }])),
    links: new Map(seedLinks.map((link) => [link.id, { ...link, up: true }])),
    congestion: new Map(),
    cycle: 0,
    seed: 42,
  };
}

/**
 * Apply a scenario to the simulated environment, mirroring the operator
 * actions in Packet Tracer: power off a device, unplug a cable, or flood
 * the network with traffic.
 */
export function applyScenarioToState(state: SimulationState, scenario: { id: string; kind: string; targetDeviceId: string | null; targetLinkId: string | null; intensity: number }) {
  if (scenario.kind === "device_failure" && scenario.targetDeviceId) {
    const device = state.devices.get(scenario.targetDeviceId);
    if (device) device.powered = false;
  }
  if (scenario.kind === "link_failure" && scenario.targetLinkId) {
    const link = state.links.get(scenario.targetLinkId);
    if (link) link.up = false;
  }
  if (scenario.kind === "congestion") {
    const intensity = Math.min(100, Math.max(20, scenario.intensity || 70));
    for (const [deviceId, device] of state.devices) {
      if (device.kind !== "pc") continue;
      const upstreamLink = [...state.links.values()].find((candidate) => candidate.targetDeviceId === deviceId);
      if (!upstreamLink) continue;
      state.congestion.set(upstreamLink.sourceDeviceId, Math.max(state.congestion.get(upstreamLink.sourceDeviceId) ?? 0, intensity));
    }
    state.congestion.set("edge-router", Math.max(state.congestion.get("edge-router") ?? 0, Math.min(100, intensity + 5)));
  }
}

export function clearScenarioFromState(state: SimulationState, scenario: { kind: string; targetDeviceId: string | null; targetLinkId: string | null }) {
  if (scenario.kind === "device_failure" && scenario.targetDeviceId) {
    const device = state.devices.get(scenario.targetDeviceId);
    if (device) device.powered = true;
  }
  if (scenario.kind === "link_failure" && scenario.targetLinkId) {
    const link = state.links.get(scenario.targetLinkId);
    if (link) link.up = true;
  }
  if (scenario.kind === "congestion") state.congestion.clear();
}

/** A device is reachable when it is powered and has a path of live links. */
export function deviceReachable(state: SimulationState, deviceId: string): boolean {
  const device = state.devices.get(deviceId);
  if (!device || !device.powered) return false;
  if (device.kind === "router") return true;

  // Find this device's upstream link (the link whose target is the device).
  const parentLink = [...state.links.values()].find((link) => link.targetDeviceId === deviceId);
  if (!parentLink) return device.powered;
  if (!parentLink.up) return false;

  // Walk towards the router: the far end must itself be reachable.
  const nextHop = parentLink.sourceDeviceId;
  if (nextHop === deviceId) return device.powered;
  return deviceReachable(state, nextHop);
}

/**
 * Root-cause analysis over the unresponsive set (proposal §3.2.2c).
 *
 * Walks each unreachable device's upstream path and attributes the outage to
 * the first cause found: a powered-off device (device failure) or a down
 * cable (link failure). Downstream devices are claimed by their root cause
 * so one physical fault produces exactly one alert.
 */
export type RootCause =
  | { kind: "device_failure"; deviceId: string; affectedDeviceIds: string[] }
  | { kind: "link_failure"; linkId: string; deviceId: string; affectedDeviceIds: string[] };

function childrenOf(state: SimulationState, deviceId: string): string[] {
  return [...state.links.values()].filter((link) => link.sourceDeviceId === deviceId).map((link) => link.targetDeviceId);
}

function collectAffected(state: SimulationState, rootId: string, unresponsiveIds: Set<string>): string[] {
  const affected: string[] = [];
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (unresponsiveIds.has(current) && !affected.includes(current)) affected.push(current);
    for (const child of childrenOf(state, current)) queue.push(child);
  }
  return affected;
}

function topologyRank(state: SimulationState, deviceId: string): number {
  const kind = state.devices.get(deviceId)?.kind;
  return kind === "router" ? 0 : kind === "switch" ? 1 : 2;
}

export function findRootCauses(state: SimulationState, unresponsiveIds: Array<string>): RootCause[] {
  const unresponsive = new Set(unresponsiveIds);
  const causes: RootCause[] = [];
  // Upstream-first so a dead router/switch claims its descendants.
  const ordered = [...unresponsiveIds].sort((a, b) => topologyRank(state, a) - topologyRank(state, b));
  for (const id of ordered) {
    const device = state.devices.get(id);
    if (!device) continue;
    if (!device.powered) {
      causes.push({ kind: "device_failure", deviceId: id, affectedDeviceIds: collectAffected(state, id, unresponsive) });
      continue;
    }
    const uplink = [...state.links.values()].find((link) => link.targetDeviceId === id);
    if (uplink && !uplink.up) {
      causes.push({ kind: "link_failure", linkId: uplink.id, deviceId: id, affectedDeviceIds: collectAffected(state, id, unresponsive) });
    }
    // Powered with an intact uplink: its outage is caused upstream and has
    // already been claimed by that cause.
  }
  return causes;
}

/** Load (0–100) at a device, inherited from any congested upstream path. */
export function congestionAt(state: SimulationState, deviceId: string): number {
  const own = state.congestion.get(deviceId) ?? 0;
  let inherited = 0;
  const device = state.devices.get(deviceId);
  if (device && device.kind !== "router") {
    const parentLink = [...state.links.values()].find((link) => link.targetDeviceId === deviceId);
    if (parentLink) inherited = congestionAt(state, parentLink.sourceDeviceId);
  }
  return Math.max(own, inherited);
}

/** Emulate one SNMP GET against a device (proposal §3.2.2a). */
export function pollDevice(state: SimulationState, device: SimulatedDevice, now: number, timeoutMs = 5_000): PollSample {
  const random = seededRandom(state.seed + state.cycle * 1_000 + device.id.length * 31 + now % 100_000);
  const reachable = deviceReachable(state, device.id);
  const load = congestionAt(state, device.id);

  if (!reachable) {
    return { deviceId: device.id, responded: false, withinTimeout: false, responseTimeMs: null, latencyMs: null, jitterMs: null, packetLossPct: null, bandwidthUtilPct: null, cpuLoadPct: null, memoryLoadPct: null, uptimeSeconds: null, errorCode: "SNMP_TIMEOUT", errorMessage: `No SNMP response from ${device.ipAddress} within ${Math.round(timeoutMs / 1000)}s` };
  }

  const congestionFactor = load / 100;
  const latency = device.latencyBaselineMs * (1 + congestionFactor * 9) + random() * device.latencyBaselineMs;
  const jitter = latency * (0.05 + congestionFactor * 0.3) * random();
  const responseTime = latency + jitter + 0.4 + random() * 0.6;
  const packetLoss = congestionFactor > 0.55 ? (congestionFactor - 0.5) * (18 + random() * 10) : random() * 0.4;
  const bandwidth = Math.min(99, 15 + congestionFactor * 95 + random() * 5);
  const cpu = Math.min(99, 8 + congestionFactor * 60 + random() * 10);
  const memory = Math.min(99, 22 + congestionFactor * 35 + random() * 12);

  // responseTime and timeoutMs are both milliseconds.
  const withinTimeout = responseTime <= timeoutMs;
  return {
    deviceId: device.id,
    responded: true,
    withinTimeout,
    responseTimeMs: Math.round(responseTime * 100) / 100,
    latencyMs: Math.round(latency * 100) / 100,
    jitterMs: Math.round(jitter * 100) / 100,
    packetLossPct: Math.round(packetLoss * 10) / 10,
    bandwidthUtilPct: Math.round(bandwidth * 10) / 10,
    cpuLoadPct: Math.round(cpu * 10) / 10,
    memoryLoadPct: Math.round(memory * 10) / 10,
    uptimeSeconds: bootSeconds(device, now),
    errorCode: withinTimeout ? null : "SLOW_RESPONSE",
    errorMessage: withinTimeout ? null : `SNMP response exceeded ${Math.round(timeoutMs / 1000)}s threshold`,
  };
}
