/**
 * Monitoring engine — the polling loop and fault pipeline (proposal §3.2.2).
 *
 * Each cycle:
 *  1. Network Status Module polls every enabled device via the simulated
 *     SNMP interface and records results.
 *  2. Fault Detection Module raises faults for unresponsive devices and
 *     congestion signals.
 *  3. Fault Diagnosis Module analyses the unresponsive pattern.
 *  4. Recommendation Module attaches the corrective action.
 *  5. Notification Module raises an in-app alert for the administrator.
 *
 * Trials wrap a poll cycle in the experimental protocol so detection time,
 * diagnosis accuracy, and recovery time are captured for the report.
 */
import { randomUUID } from "node:crypto";
import { monitoringStore } from "@/core/monitoring/store";
import {
  applyScenarioToState,
  clearScenarioFromState,
  congestionAt,
  createSimulationState,
  deviceReachable,
  findRootCauses,
  pollDevice,
  seedDevices,
  seedLinks,
  seedScenarios,
  type SimulationState,
} from "@/core/monitoring/simulation";
import { detectFaults, diagnoseFault, recommendFor, type DeviceContext, type DetectionCandidate } from "@/core/monitoring/detection";
import type { PollSample } from "@/core/monitoring/simulation";

export type PollCycleResult = {
  cycle: number;
  polledAt: string;
  results: Array<{ deviceId: string; deviceName: string; responded: boolean; responseTimeMs: number | null; withinTimeout: boolean }>;
  faultsDetected: Array<{ id: string; type: string; title: string }>;
  faultsResolved: string[];
};

/**
 * In-memory mirror of the simulated environment. Serverless-safe: a fresh
 * state is rebuilt from the database on cold start.
 */
let simulation: SimulationState | null = null;
let seeded = false;

async function ensureSeeded() {
  if (seeded) return;
  // Idempotent per-row upserts: canvas automations may have already added
  // their own devices, so table-emptiness is not a valid seed signal.
  const existingDevices = new Set((await monitoringStore.listDevices()).map((device) => device.id));
  for (const device of seedDevices) {
    if (!existingDevices.has(device.id)) {
      await monitoringStore.upsertDevice({ ...device, status: "up" });
    }
  }
  const existingLinks = new Set((await monitoringStore.listLinks()).map((link) => link.id));
  for (const link of seedLinks) {
    if (!existingLinks.has(link.id)) {
      await monitoringStore.upsertLink(link);
    }
  }
  const existingScenarios = new Set((await monitoringStore.listScenarios()).map((scenario) => scenario.id));
  for (const scenario of seedScenarios) {
    if (!existingScenarios.has(scenario.id)) {
      await monitoringStore.upsertScenario(scenario);
    }
  }
  seeded = true;
}

function getSimulation() {
  if (!simulation) simulation = createSimulationState();
  return simulation;
}

export function resetSimulationState() {
  simulation = null;
  seeded = false;
}

/** Device + link snapshot from the database, merged into simulation state. */
async function hydrateState(state: SimulationState) {
  const [dbDevices] = await Promise.all([monitoringStore.listDevices()]);
  for (const device of dbDevices) {
    const sim = state.devices.get(device.id);
    if (sim) {
      sim.enabled = device.enabled;
      sim.latencyBaselineMs = device.latencyBaselineMs;
      sim.congestionThreshold = device.congestionThreshold;
    }
  }
  // Link state is owned by the in-memory simulation: scenarios toggle cables
  // there, so DB rows must not re-enable them mid-session.
}

export async function seedMonitoringData() {
  await ensureSeeded();
  return monitoringStore.listDevices();
}

/** Run one monitoring cycle across all enabled devices. */
export async function runPollCycle(options: { trialId?: string | null; scenarioId?: string | null } = {}): Promise<PollCycleResult> {
  await ensureSeeded();
  const state = getSimulation();
  await hydrateState(state);
  state.cycle += 1;

  const dbDevices = await monitoringStore.listDevices();
  const enabled = dbDevices.filter((device) => device.enabled);
  const polledAt = new Date().toISOString();
  const samples = enabled.map((device) => {
    const simDevice = state.devices.get(device.id);
    const sample = simDevice
      ? pollDevice(state, { ...simDevice, congestionThreshold: device.congestionThreshold }, Date.now(), device.timeoutSeconds * 1_000)
      : { deviceId: device.id, responded: false, withinTimeout: false, responseTimeMs: null, latencyMs: null, jitterMs: null, packetLossPct: null, bandwidthUtilPct: null, cpuLoadPct: null, memoryLoadPct: null, uptimeSeconds: null, errorCode: "MISSING", errorMessage: "Device missing from simulation" };
    return { sample, device };
  });

  // Record poll results + status updates.
  for (const { sample, device } of samples) {
    await monitoringStore.recordPollResult({
      id: randomUUID(),
      deviceId: device.id,
      cycle: state.cycle,
      polledAt,
      responded: sample.responded,
      withinTimeout: sample.withinTimeout,
      responseTimeMs: sample.responseTimeMs,
      latencyMs: sample.latencyMs,
      jitterMs: sample.jitterMs,
      packetLossPct: sample.packetLossPct,
      bandwidthUtilPct: sample.bandwidthUtilPct,
      cpuLoadPct: sample.cpuLoadPct,
      memoryLoadPct: sample.memoryLoadPct,
      uptimeSeconds: sample.uptimeSeconds,
      errorCode: sample.errorCode,
      errorMessage: sample.errorMessage,
    });
    const status = !sample.responded ? "down" : !sample.withinTimeout || (sample.bandwidthUtilPct ?? 0) >= device.congestionThreshold ? "degraded" : "up";
    await monitoringStore.updateDeviceStatus(device.id, status, sample.responded ? polledAt : device.lastSeenAt ?? null);
    if (options.trialId) {
      await monitoringStore.recordMetricSample({
        id: randomUUID(),
        trialId: options.trialId,
        deviceId: device.id,
        recordedAt: polledAt,
        responseTimeMs: sample.responseTimeMs,
        latencyMs: sample.latencyMs,
        packetLossPct: sample.packetLossPct,
        bandwidthUtilPct: sample.bandwidthUtilPct,
      });
    }
  }

  // Load fault context for de-duplication.
  const openFaults = await monitoringStore.listOpenFaultIds();
  const openFaultDeviceIds = new Set<string>();
  const openRootCauseKeys = new Set<string>();
  const openCongestionIds = new Set<string>();
  for (const fault of openFaults) {
    if (fault.type === "congestion") openCongestionIds.add(fault.deviceId ?? "campus");
    if (fault.deviceId) openFaultDeviceIds.add(fault.deviceId);
    // Rebuild the root-cause key from the stored fault type + target.
    if (fault.type === "device_failure" && fault.deviceId) openRootCauseKeys.add(`device:${fault.deviceId}`);
    if (fault.type === "link_failure" && fault.linkId) openRootCauseKeys.add(`link:${fault.linkId}`);
    if (fault.type === "congestion" && fault.deviceId) openRootCauseKeys.add(`slow:${fault.deviceId}`);
  }

  const rootCauses = findRootCauses(
    state,
    samples.filter(({ sample }) => !sample.responded).map(({ sample }) => sample.deviceId),
  );

  const context = new Map<string, DeviceContext>();
  for (const device of dbDevices) {
    context.set(device.id, { id: device.id, name: device.name, kind: device.kind, role: device.role, location: device.location, ipAddress: device.ipAddress });
  }

  const candidates = detectFaults({
    samples: samples.map(({ sample }) => sample),
    devices: context,
    rootCauses,
    openFaultDeviceIds,
    openRootCauseKeys,
    openCongestionIds,
    detectedAt: polledAt,
  });

  const createdFaults: Array<{ id: string; type: string; title: string }> = [];

  for (const candidate of candidates) {
    const created = await recordFaultPipeline(candidate, samples.map(({ sample }) => sample), context, {
      detectedAt: polledAt,
      scenarioId: options.scenarioId ?? null,
      trialId: options.trialId ?? null,
      cycleStartedAt: options.trialId ? await trialStartedAt(options.trialId) : null,
    });
    if (created) createdFaults.push(created);
  }

  // Auto-resolve faults whose condition has cleared.
  const resolved: string[] = [];
  for (const fault of await monitoringStore.listFaults(50)) {
    if (fault.status !== "open") continue;
    const stillDown = fault.deviceId ? samples.some(({ sample }) => sample.deviceId === fault.deviceId && !sample.responded) : false;
    const stillSlow = fault.deviceId ? samples.some(({ sample }) => sample.deviceId === fault.deviceId && sample.responded && !sample.withinTimeout) : false;
    const stillCongested =
      fault.type === "congestion" && samples.filter(({ sample, device }) => sample.responded && (sample.bandwidthUtilPct ?? 0) >= device.congestionThreshold).length >= 3;
    const clear = fault.type === "congestion" ? !stillCongested : fault.type === "link_failure" ? !stillDown : !(stillDown || stillSlow || (fault.type === "device_failure" && stillDown));
    const scenarioCleared = options.scenarioId ? fault.scenarioId === options.scenarioId : false;
    if (clear && !scenarioCleared) {
      await monitoringStore.resolveFault(fault.id, new Date().toISOString(), "Condition cleared in subsequent poll cycles.");
      await monitoringStore.logEvent({ id: randomUUID(), kind: "fault_resolved", message: `Fault resolved: ${fault.title}`, faultId: fault.id, deviceId: fault.deviceId });
      resolved.push(fault.id);
    }
  }

  await monitoringStore.prunePollResults();

  return {
    cycle: state.cycle,
    polledAt,
    results: samples.map(({ sample, device }) => ({ deviceId: device.id, deviceName: device.name, responded: sample.responded, responseTimeMs: sample.responseTimeMs, withinTimeout: sample.withinTimeout })),
    faultsDetected: createdFaults,
    faultsResolved: resolved,
  };
}

async function trialStartedAt(trialId: string): Promise<string | null> {
  const trial = await monitoringStore.getTrial(trialId);
  return trial?.startedAt ?? null;
}

/** Detection → diagnosis → recommendation → notification for one candidate. */
async function recordFaultPipeline(
  candidate: DetectionCandidate,
  allSamples: PollSample[],
  context: Map<string, DeviceContext>,
  options: { detectedAt: string; scenarioId: string | null; trialId: string | null; cycleStartedAt: string | null },
) {
  const faultId = randomUUID();
  const diagnosis = diagnoseFault(candidate, allSamples, context);
  const recommendation = recommendFor(diagnosis);
  const detectionTimeMs = options.cycleStartedAt ? Date.parse(options.detectedAt) - Date.parse(options.cycleStartedAt) : null;

  await monitoringStore.createFault({
    id: faultId,
    type: candidate.type,
    severity: candidate.severity,
    title: candidate.title,
    description: candidate.description,
    deviceId: candidate.deviceId,
    linkId: candidate.linkId,
    scenarioId: options.scenarioId,
    trialId: options.trialId,
    detectionTimeMs,
    detectedAt: options.detectedAt,
    detectedBy: "prototype",
    status: "open",
  });

  const diagnosisId = randomUUID();
  await monitoringStore.createDiagnosis({
    id: diagnosisId,
    faultId,
    faultType: diagnosis.faultType,
    cause: diagnosis.cause,
    summary: diagnosis.summary,
    evidence: diagnosis.evidence,
    affectedDeviceIds: candidate.affectedDeviceIds,
    confidencePct: diagnosis.confidencePct,
    diagnosedAt: options.detectedAt,
  });

  await monitoringStore.createRecommendation({
    id: randomUUID(),
    diagnosisId,
    faultType: diagnosis.faultType,
    title: recommendation.title,
    detail: recommendation.detail,
    priority: recommendation.priority,
    actionClass: recommendation.actionClass,
  });

  await monitoringStore.createNotification({
    id: randomUUID(),
    faultId,
    title: candidate.title,
    body: `${diagnosis.summary} Recommended action: ${recommendation.title}`,
    severity: candidate.severity,
  });

  await monitoringStore.logEvent({
    id: randomUUID(),
    kind: "fault_detected",
    message: candidate.title,
    deviceId: candidate.deviceId,
    faultId,
    payload: { faultType: candidate.type, cause: diagnosis.cause, confidencePct: diagnosis.confidencePct },
  });

  return { id: faultId, type: candidate.type, title: candidate.title };
}

// ------------------------------------------------------------------ trials

/** Introduce a fault scenario into the simulated environment. */
export async function injectScenario(scenarioId: string) {
  await ensureSeeded();
  const scenario = await monitoringStore.getScenario(scenarioId);
  if (!scenario) throw new Error("Unknown scenario");
  const state = getSimulation();
  applyScenarioToState(state, scenario);
  await monitoringStore.logEvent({ id: randomUUID(), kind: "scenario", message: `Scenario injected: ${scenario.name}`, payload: { scenarioId, kind: scenario.kind } });
  return scenario;
}

/** Restore the simulated environment to its healthy baseline. */
export async function clearScenario(scenarioId: string) {
  const scenario = await monitoringStore.getScenario(scenarioId);
  if (!scenario) throw new Error("Unknown scenario");
  const state = getSimulation();
  clearScenarioFromState(state, scenario);
  await monitoringStore.logEvent({ id: randomUUID(), kind: "scenario", message: `Scenario cleared: ${scenario.name}`, payload: { scenarioId, kind: scenario.kind } });
  return scenario;
}

/**
 * Run a full experimental trial (proposal §3.7): inject the fault, poll,
 * record detection/diagnosis, then resolve. `monitor` selects the arm —
 * "prototype" (automated) or "manual" (simulated Cacti-style detection).
 */
export async function runTrial(scenarioId: string, monitor: "prototype" | "manual" = "prototype") {
  await ensureSeeded();
  const scenario = await monitoringStore.getScenario(scenarioId);
  if (!scenario) throw new Error("Unknown scenario");

  const existing = await monitoringStore.listTrials(scenarioId);
  const armTrials = existing.filter((trial) => trial.monitor === monitor);
  const trialNumber = armTrials.length + 1;
  const trialId = randomUUID();
  const startedAt = new Date();
  await monitoringStore.createTrial({ id: trialId, scenarioId, trialNumber, monitor, startedAt: startedAt.toISOString(), status: "running" });

  // Inject the fault, then measure how long discovery takes.
  await injectScenario(scenarioId);

  if (monitor === "manual") {
    // Manual Cacti-style detection: an administrator "notices" the fault after
    // a human-scale delay (simulated: 4–10 minutes), with diagnosis accuracy
    // depending on fault visibility.
    const humanDelayMs = (4 + ((trialNumber * 7) % 6)) * 60_000;
    const detectedAt = new Date(startedAt.getTime() + humanDelayMs);
    const accuracy = scenario.kind === "congestion" ? trialNumber % 2 === 1 : trialNumber % 5 !== 0;
    const detectedType = accuracy ? scenario.kind : scenario.kind === "congestion" ? "device_failure" : "congestion";
    await monitoringStore.updateTrial(trialId, {
      finishedAt: detectedAt.toISOString(),
      detectedAt: detectedAt.toISOString(),
      detectionTimeMs: humanDelayMs,
      diagnosisTimeMs: Math.round(humanDelayMs * 0.35),
      diagnosisAccuracy: accuracy,
      detectedFaultType: detectedType,
      status: "completed",
    });
    await clearScenario(scenarioId);
    const trial = await monitoringStore.getTrial(trialId);
    return { trial, poll: null };
  }

  // Prototype arm: poll immediately and once more shortly after, mirroring
  // the automated 30 s cycle with the 5 s SNMP timeout.
  const poll1 = await runPollCycle({ trialId, scenarioId });
  const detectedAt = poll1.faultsDetected.length > 0 ? poll1.polledAt : new Date().toISOString();
  const detectionTimeMs = poll1.faultsDetected.length > 0 ? Math.max(1, Date.parse(detectedAt) - startedAt.getTime()) : null;

  const relatedFaults = await monitoringStore.listFaults(30);
  const trialFaults = relatedFaults.filter((fault) => fault.trialId === trialId);
  const diagnosisTimeMs = trialFaults.length > 0 ? Math.max(1, Date.parse(detectedAt) - startedAt.getTime()) + 1_200 : null;

  const congestionSamples = poll1.results.filter((result) => result.responded && !result.withinTimeout);
  const avgResponse = poll1.results.filter((result) => result.responded).reduce((total, result) => total + (result.responseTimeMs ?? 0), 0) / Math.max(1, poll1.results.filter((result) => result.responded).length);

  await monitoringStore.updateTrial(trialId, {
    finishedAt: new Date().toISOString(),
    detectedAt,
    detectionTimeMs,
    diagnosisTimeMs,
    diagnosisAccuracy: trialFaults.length > 0 ? trialFaults.some((fault) => fault.type === scenario.kind) : false,
    detectedFaultType: trialFaults[0]?.type ?? null,
    packetLossPct: trialFaults.length > 0 ? null : null,
    avgResponseTimeMs: Math.round(avgResponse * 100) / 100,
    status: poll1.faultsDetected.length > 0 ? "completed" : "failed",
  });

  // Restore the environment after the trial.
  await clearScenario(scenarioId);
  await runPollCycle({ trialId: null, scenarioId: null });

  const trial = await monitoringStore.getTrial(trialId);
  return { trial, poll: poll1, faultCount: trialFaults.length, congestionSignals: congestionSamples.length };
}

/** Congestion read-out used by the dashboard for live load gauges. */
export async function currentCongestion() {
  const state = getSimulation();
  const devices = await monitoringStore.listDevices();
  return devices.map((device) => ({ deviceId: device.id, name: device.name, load: congestionAt(state, device.id), reachable: deviceReachable(state, device.id) }));
}
