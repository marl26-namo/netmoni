"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------- types

type DeviceRow = {
  id: string;
  name: string;
  kind: string;
  ipAddress: string;
  location: string;
  status: string;
  lastPoll: { responseTimeMs: number | null; bandwidthUtilPct: number | null } | null;
};

type FaultRow = { id: string; type: string; severity: string; title: string; description: string; status: string; detectedAt: string; detectionTimeMs: number | null };
type NotificationRow = { id: string; title: string; body: string; severity: string; readAt: string | null; createdAt: string };
type EventRow = { id: string; kind: string; message: string; createdAt: string };
type Overview = {
  summary: { totalDevices: number; up: number; degraded: number; down: number; openFaults: number; unreadNotifications: number };
  devices: DeviceRow[];
  faults: FaultRow[];
  notifications: NotificationRow[];
  events: EventRow[];
};

type ScenarioRow = { id: string; name: string; kind: string };
type TrialRow = { id: string; scenarioId: string; trialNumber: number; monitor: string; detectionTimeMs: number | null; diagnosisAccuracy: boolean | null };
type Report = {
  generatedAt: string;
  detectionTime: { prototype: Stats; manual: Stats };
  diagnosisAccuracy: { prototype: { total: number; correct: number; accuracyPct: number } };
  tTest: { tStatistic: number; degreesOfFreedom: number; significant: boolean; alpha: number };
};
type Stats = { n: number; mean: number; stdDev: number };

type AutomationNodeRow = {
  id: string;
  kind: "trigger" | "watch_device" | "notify_email";
  name: string;
  positionX: number;
  positionY: number;
  deviceName: string | null;
  ipAddress: string | null;
  subnet: string | null;
  location: string | null;
  pollIntervalSeconds: number | null;
  timeoutSeconds: number | null;
  email: string | null;
};
type AutomationEdgeRow = { id: string; sourceNodeId: string; targetNodeId: string };
type AutomationRow = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  scheduleKind: string;
  intervalSeconds: number;
  dailyAt: string | null;
  scheduleLabel: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  nodes: AutomationNodeRow[];
  edges: AutomationEdgeRow[];
  recipients: Array<{ id: string; email: string; label: string }>;
};
type RunRow = {
  id: string;
  automationId: string;
  status: string;
  trigger: string;
  devicesChecked: number;
  faultsDetected: number;
  faultsResolved: number;
  emailsSent: number;
  emailStatus: string | null;
  durationMs: number;
  startedAt: string;
};

// ------------------------------------------------------------- constants

const faultKindLabel: Record<string, string> = { device_failure: "Device failure", link_failure: "Link failure", congestion: "Congestion", unknown: "Unknown" };

const canvasNodesDefault = { trigger: { label: "Schedule", icon: "⏱" }, watch_device: { label: "Watch device", icon: "📡" }, notify_email: { label: "Email admin", icon: "✉" } } as const;

const fallbackScenarios: ScenarioRow[] = [
  { id: "scenario-device-router", name: "Router power off", kind: "device_failure" },
  { id: "scenario-device-labswitch", name: "Lab switch power off", kind: "device_failure" },
  { id: "scenario-link-lab", name: "Lab cable disconnect", kind: "link_failure" },
  { id: "scenario-link-hostel", name: "Hostel cable disconnect", kind: "link_failure" },
  { id: "scenario-congestion", name: "Lab + hostel traffic flood", kind: "congestion" },
];

function timeOf(iso: string) { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
function seconds(ms: number | null) { return ms === null ? "—" : `${(ms / 1_000).toFixed(2)} s`; }

// ------------------------------------------------------------ canvas state

type CanvasNode = {
  id: string;
  kind: keyof typeof canvasNodesDefault;
  name: string;
  x: number;
  y: number;
  deviceName?: string;
  ipAddress?: string;
  subnet?: string;
  location?: string;
  pollIntervalSeconds?: number;
  timeoutSeconds?: number;
  email?: string;
};
type CanvasEdge = { id: string; source: string; target: string };

let localIdCounter = 0;
function nextLocalId(prefix: string) { localIdCounter += 1; return `${prefix}-${Date.now().toString(36)}-${localIdCounter}`; }

// ================================================================= page

type Tab = "console" | "automation";

export default function DashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("console");
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [scenarios] = useState<ScenarioRow[]>(fallbackScenarios);
  const [trials, setTrials] = useState<TrialRow[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [automations, setAutomations] = useState<AutomationRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);

  const [armedScenario, setArmedScenario] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  // --- canvas state
  const [canvasNodes, setCanvasNodes] = useState<CanvasNode[]>([]);
  const [canvasEdges, setCanvasEdges] = useState<CanvasEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [linkSource, setLinkSource] = useState<string | null>(null);
  const [automationName, setAutomationName] = useState("Campus network watch");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scheduleKind, setScheduleKind] = useState<"interval" | "daily">("interval");
  const [intervalSeconds, setIntervalSeconds] = useState(30);
  const [dailyAt, setDailyAt] = useState("07:00");

  const loadOverview = useCallback(async () => {
    const response = await fetch("/api/monitoring/overview");
    if (response.ok) setOverview(await response.json() as Overview);
  }, []);

  const loadAutomations = useCallback(async () => {
    const response = await fetch("/api/monitoring/automations");
    if (response.ok) {
      const data = await response.json() as { automations: AutomationRow[]; runs: RunRow[] };
      setAutomations(data.automations);
      setRuns(data.runs);
    }
  }, []);

  const loadReport = useCallback(async () => {
    const response = await fetch("/api/monitoring/reports");
    if (response.ok) setReport(await response.json() as Report);
  }, []);

  const loadTrials = useCallback(async () => {
    const response = await fetch("/api/monitoring/trials");
    if (response.ok) {
      const data = await response.json() as { trials: TrialRow[] };
      setTrials(data.trials);
    }
  }, []);

  const loadUser = useCallback(async () => {
    const response = await fetch("/api/auth/me");
    if (response.ok) {
      const data = await response.json() as { user: { name: string; email: string } };
      setUser(data.user);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadOverview(), loadAutomations(), loadReport(), loadTrials(), loadUser()]);
  }, [loadOverview, loadAutomations, loadReport, loadTrials, loadUser]);

  useEffect(() => {
    const initial = setTimeout(() => { void refreshAll(); }, 0);
    const heartbeat = setInterval(() => { void (async () => {
      await fetch("/api/monitoring/automations/scheduler", { method: "POST" });
      await loadOverview();
      if (tab === "automation") await loadAutomations();
    })(); }, 10_000);
    return () => { clearTimeout(initial); clearInterval(heartbeat); };
  }, [refreshAll, loadOverview, loadAutomations, tab]);

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  // ------------------------------------------------------ canvas helpers

  const addNode = (kind: keyof typeof canvasNodesDefault) => {
    const id = nextLocalId(kind);
    const node: CanvasNode = {
      id,
      kind,
      name: kind === "trigger" ? "Every 30 seconds" : kind === "watch_device" ? `Device ${canvasNodes.filter((n) => n.kind === "watch_device").length + 1}` : "Notify admin",
      x: 60 + canvasNodes.length * 30,
      y: 40 + canvasNodes.length * 34,
      ...(kind === "trigger" ? {} : {}),
      ...(kind === "watch_device" ? { deviceName: "", ipAddress: "", subnet: "192.168.1.0/24", location: "campus", pollIntervalSeconds: 30, timeoutSeconds: 5 } : {}),
      ...(kind === "notify_email" ? { email: "" } : {}),
    };
    setCanvasNodes((current) => [...current, node]);
    setSelectedNodeId(id);
  };

  const removeNode = (id: string) => {
    setCanvasNodes((current) => current.filter((node) => node.id !== id));
    setCanvasEdges((current) => current.filter((edge) => edge.source !== id && edge.target !== id));
    if (selectedNodeId === id) setSelectedNodeId(null);
    if (linkSource === id) setLinkSource(null);
  };

  const updateNode = (id: string, patch: Partial<CanvasNode>) => {
    setCanvasNodes((current) => current.map((node) => (node.id === id ? { ...node, ...patch } : node)));
  };

  // Dragging lives in AutomationTab's useCanvasDrag hook.

  const onPortClick = (nodeId: string) => {
    if (!linkSource) { setLinkSource(nodeId); return; }
    if (linkSource === nodeId) { setLinkSource(null); return; }
    setCanvasEdges((current) => current.some((edge) => edge.source === linkSource && edge.target === nodeId) ? current : [...current, { id: nextLocalId("edge"), source: linkSource, target: nodeId }]);
    setLinkSource(null);
  };

  const automationPayload = () => ({
    name: automationName,
    description: "",
    enabled: true,
    scheduleKind,
    intervalSeconds,
    dailyAt: scheduleKind === "daily" ? dailyAt : null,
    nodes: canvasNodes.map((node) => ({ ...node })),
    edges: canvasEdges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
  });

  const saveAutomation = async () => {
    setBusy("save");
    setError("");
    try {
      const payload = automationPayload();
      const response = await fetch("/api/monitoring/automations", {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editingId ? { ...payload, id: editingId, action: "save" } : payload),
      });
      const data = await response.json() as { automation?: AutomationRow; error?: string };
      if (!response.ok || !data.automation) { setError(data.error ?? "Could not save automation."); return; }
      setEditingId(data.automation.id);
      await loadAutomations();
      await syncDevicesFromCanvas(data.automation.id);
    } finally {
      setBusy("");
    }
  };

  const syncDevicesFromCanvas = async (automationId: string) => {
    await fetch("/api/monitoring/automations", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: automationId, action: "run" }) });
    await loadOverview();
    await loadAutomations();
  };

  const runAutomationNow = async (id: string) => {
    setBusy(`run:${id}`);
    try {
      await fetch("/api/monitoring/automations", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, action: "run" }) });
      await Promise.all([loadAutomations(), loadOverview()]);
    } finally { setBusy(""); }
  };

  const toggleAutomation = async (automation: AutomationRow) => {
    await fetch("/api/monitoring/automations", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: automation.id, action: "toggle", enabled: !automation.enabled }) });
    await loadAutomations();
  };

  const deleteAutomation = async (id: string) => {
    await fetch("/api/monitoring/automations", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, action: "delete" }) });
    if (editingId === id) { setEditingId(null); setCanvasNodes([]); setCanvasEdges([]); }
    await loadAutomations();
  };

  const editAutomation = (automation: AutomationRow) => {
    setEditingId(automation.id);
    setAutomationName(automation.name);
    setScheduleKind(automation.scheduleKind === "daily" ? "daily" : "interval");
    setIntervalSeconds(automation.intervalSeconds);
    setDailyAt(automation.dailyAt ?? "07:00");
    setCanvasNodes(automation.nodes.map((node) => ({
      id: node.id,
      kind: node.kind,
      name: node.name,
      x: node.positionX,
      y: node.positionY,
      deviceName: node.deviceName ?? undefined,
      ipAddress: node.ipAddress ?? undefined,
      subnet: node.subnet ?? undefined,
      location: node.location ?? undefined,
      pollIntervalSeconds: node.pollIntervalSeconds ?? undefined,
      timeoutSeconds: node.timeoutSeconds ?? undefined,
      email: node.email ?? undefined,
    })));
    setCanvasEdges(automation.edges.map((edge) => ({ id: edge.id, source: edge.sourceNodeId, target: edge.targetNodeId })));
    setTab("automation");
  };

  const newAutomation = () => {
    setEditingId(null);
    setAutomationName("Campus network watch");
    setScheduleKind("interval");
    setIntervalSeconds(30);
    setCanvasNodes([]);
    setCanvasEdges([]);
    setSelectedNodeId(null);
    setLinkSource(null);
    setTab("automation");
  };

  // ------------------------------------------------------ console actions

  const runPoll = async () => {
    setBusy("poll");
    try { await fetch("/api/monitoring/overview", { method: "POST" }); await loadOverview(); } finally { setBusy(""); }
  };

  const inject = async (scenarioId: string) => {
    setBusy(`inject:${scenarioId}`);
    try {
      const response = await fetch("/api/monitoring/scenarios", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scenarioId, action: "inject" }) });
      if (response.ok) { setArmedScenario(scenarioId); await fetch("/api/monitoring/overview", { method: "POST" }); await loadOverview(); }
    } finally { setBusy(""); }
  };

  const clearArmed = async () => {
    if (!armedScenario) return;
    setBusy("clear");
    try {
      await fetch("/api/monitoring/scenarios", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scenarioId: armedScenario, action: "clear" }) });
      setArmedScenario(null);
      await fetch("/api/monitoring/overview", { method: "POST" });
      await loadOverview();
    } finally { setBusy(""); }
  };

  const markAllRead = async () => {
    await fetch("/api/monitoring/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ all: true }) });
    await loadOverview();
  };

  const resolveFault = async (id: string) => {
    await fetch("/api/monitoring/faults", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, action: "resolve" }) });
    await loadOverview();
  };

  const runTrial = async (scenarioId: string, monitor: "prototype" | "manual") => {
    setBusy(`trial:${scenarioId}:${monitor}`);
    try {
      await fetch("/api/monitoring/trials", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scenarioId, monitor }) });
      await Promise.all([loadTrials(), loadReport(), loadOverview()]);
    } finally { setBusy(""); }
  };

  const summary = overview?.summary;
  const openFaults = overview?.faults.filter((fault) => fault.status === "open") ?? [];
  const selectedNode = useMemo(() => canvasNodes.find((node) => node.id === selectedNodeId) ?? null, [canvasNodes, selectedNodeId]);
  const watchCount = canvasNodes.filter((node) => node.kind === "watch_device").length;
  const emailCount = canvasNodes.filter((node) => node.kind === "notify_email" && node.email).length;

  return (
    <div className="nw-shell">
      <header className="nw-topbar">
        <Link href="/" className="nw-logo"><span className="nw-logo-dot" />MUBAS&nbsp;NetWatch</Link>
        <span className="nw-live"><span className="dot" />Live</span>
        <nav>
          <button className={`nw-toplink ${tab === "console" ? "active" : ""}`} onClick={() => setTab("console")}>Console</button>
          <button className={`nw-toplink ${tab === "automation" ? "active" : ""}`} onClick={() => setTab("automation")}>Automations</button>
          {user ? <span className="nw-toplink" style={{ color: "var(--nw-text)" }}>{user.name}</span> : null}
          <button className="nw-button ghost" onClick={signOut}>Sign out</button>
        </nav>
      </header>

      <main className="nw-console">
        {error ? <div className="nw-fault warning" style={{ marginBottom: 12 }}><span className="ft">{error}</span></div> : null}

        {tab === "console" ? (
          <ConsoleTab
            summary={summary}
            overview={overview}
            openFaults={openFaults}
            scenarios={scenarios}
            trials={trials}
            report={report}
            armedScenario={armedScenario}
            busy={busy}
            onPoll={runPoll}
            onInject={inject}
            onClear={clearArmed}
            onMarkRead={markAllRead}
            onResolve={resolveFault}
            onTrial={runTrial}
          />
        ) : (
          <AutomationTab
            automations={automations}
            runs={runs}
            canvasNodes={canvasNodes}
            canvasEdges={canvasEdges}
            selectedNode={selectedNode}
            selectedNodeId={selectedNodeId}
            linkSource={linkSource}
            automationName={automationName}
            editingId={editingId}
            scheduleKind={scheduleKind}
            intervalSeconds={intervalSeconds}
            dailyAt={dailyAt}
            busy={busy}
            watchCount={watchCount}
            emailCount={emailCount}
            setAutomationName={setAutomationName}
            setScheduleKind={setScheduleKind}
            setIntervalSeconds={setIntervalSeconds}
            setDailyAt={setDailyAt}
            onAddNode={addNode}
            onRemoveNode={removeNode}
            onUpdateNode={updateNode}
            onPortClick={onPortClick}
            onSelect={setSelectedNodeId}
            onSave={saveAutomation}
            onNew={newAutomation}
            onEdit={editAutomation}
            onRun={runAutomationNow}
            onToggle={toggleAutomation}
            onDelete={deleteAutomation}
          />
        )}
      </main>

      <footer className="nw-footer">
        MUBAS NetWatch · automations run on their schedule and email the admin via Resend · data persisted with Drizzle (SQLite / PostgreSQL / MySQL)
      </footer>
    </div>
  );
}

// ------------------------------------------------------------ console tab

function ConsoleTab(props: {
  summary: Overview["summary"] | undefined;
  overview: Overview | null;
  openFaults: FaultRow[];
  scenarios: ScenarioRow[];
  trials: TrialRow[];
  report: Report | null;
  armedScenario: string | null;
  busy: string;
  onPoll: () => void;
  onInject: (id: string) => void;
  onClear: () => void;
  onMarkRead: () => void;
  onResolve: (id: string) => void;
  onTrial: (id: string, monitor: "prototype" | "manual") => void;
}) {
  return (
    <>
      <div className="nw-console-head">
        <div>
          <h1>Network operations console</h1>
          <div className="sub">Simulated MUBAS campus network · SNMP polling every 30 s · fault timeout 5 s</div>
        </div>
        <div className="nw-console-actions">
          <button className="nw-button ghost" onClick={props.onPoll} disabled={props.busy === "poll"}>{props.busy === "poll" ? "Polling…" : "Poll now"}</button>
          <button className="nw-button" onClick={props.onMarkRead}>Clear alerts ({props.summary?.unreadNotifications ?? 0})</button>
        </div>
      </div>

      <div className="nw-grid cols-4" style={{ marginBottom: 14 }}>
        <div className="nw-stat"><div className="label">Devices up</div><div className="value" style={{ color: "var(--nw-accent)" }}>{props.summary ? `${props.summary.up}/${props.summary.totalDevices}` : "—"}</div></div>
        <div className="nw-stat"><div className="label">Degraded</div><div className="value" style={{ color: "var(--nw-warn)" }}>{props.summary?.degraded ?? "—"}</div></div>
        <div className="nw-stat"><div className="label">Open faults</div><div className="value" style={{ color: props.summary?.openFaults ? "var(--nw-crit)" : undefined }}>{props.summary?.openFaults ?? "—"}</div></div>
        <div className="nw-stat"><div className="label">Alerts</div><div className="value">{props.summary?.unreadNotifications ?? "—"}</div></div>
      </div>

      <div className="nw-console-grid">
        <div className="nw-tile span-2">
          <h2>Device status</h2>
          {(props.overview?.devices ?? []).map((device) => (
            <div className="nw-device" key={device.id}>
              <span className={`nw-status-dot ${device.status === "disabled" ? "unknown" : device.status}`} />
              <div className="meta">
                <div className="name">{device.name}</div>
                <div className="sub">{device.ipAddress} · {device.location} · {device.kind}</div>
              </div>
              <div className="rt">
                <div className="v">{device.lastPoll?.responseTimeMs != null ? `${device.lastPoll.responseTimeMs} ms` : "—"}</div>
                <div className="u">{device.lastPoll?.bandwidthUtilPct != null ? `${device.lastPoll.bandwidthUtilPct}% util` : device.status}</div>
              </div>
            </div>
          ))}
          {!props.overview ? <div className="nw-empty">Loading device status…</div> : null}
        </div>

        <div className="nw-tile">
          <h2>Fault console</h2>
          {props.openFaults.length === 0 ? <div className="nw-empty">No open faults — network healthy.</div> : null}
          {props.openFaults.map((fault) => (
            <div className={`nw-fault ${fault.severity === "warning" ? "warning" : ""}`} key={fault.id}>
              <div className="fw"><span className="ft">{fault.title}</span><span className="tag">{faultKindLabel[fault.type] ?? fault.type}</span></div>
              <div className="fd">{fault.description}</div>
              <div className="fd">Detected {timeOf(fault.detectedAt)} · {seconds(fault.detectionTimeMs)} after injection</div>
              <div style={{ marginTop: 8 }}><button className="nw-button ghost" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => props.onResolve(fault.id)}>Mark resolved</button></div>
            </div>
          ))}
        </div>

        <div className="nw-tile">
          <h2>Packet Tracer console</h2>
          <div className="nw-note" style={{ marginTop: 0, marginBottom: 10 }}>Inject controlled fault scenarios, then clear them to restore the baseline.</div>
          {props.scenarios.map((scenario) => (
            <button className={`nw-scenario-btn ${props.armedScenario === scenario.id ? "armed" : ""}`} key={scenario.id} onClick={() => props.onInject(scenario.id)} disabled={props.busy.startsWith("inject:")}>
              <span>{scenario.name}</span><span className="kind">{faultKindLabel[scenario.kind] ?? scenario.kind}</span>
            </button>
          ))}
          <button className="nw-button warn" style={{ width: "100%", marginTop: 8 }} onClick={props.onClear} disabled={!props.armedScenario || props.busy === "clear"}>
            {props.busy === "clear" ? "Restoring…" : "Clear armed fault"}
          </button>
        </div>

        <div className="nw-tile span-2">
          <h2>Notifications</h2>
          {(props.overview?.notifications ?? []).length === 0 ? <div className="nw-empty">No alerts yet.</div> : null}
          {(props.overview?.notifications ?? []).slice(0, 6).map((notification) => (
            <div className="nw-fault" key={notification.id}>
              <div className="fw"><span className="ft">{notification.title}</span><span className="tag">{notification.severity}</span></div>
              <div className="fd">{notification.body}</div>
              <div className="fd">{timeOf(notification.createdAt)}</div>
            </div>
          ))}
        </div>

        <div className="nw-tile">
          <h2>Event log</h2>
          {(props.overview?.events ?? []).slice(0, 10).map((event) => (
            <div className="nw-event" key={event.id}><span className="t">{timeOf(event.createdAt)}</span><span>{event.message}</span></div>
          ))}
          {(props.overview?.events ?? []).length === 0 ? <div className="nw-empty">Waiting for events…</div> : null}
        </div>

        <div className="nw-tile span-2">
          <h2>Research trials</h2>
          <table className="nw-table">
            <thead><tr><th>Scenario</th><th>#</th><th>Monitor</th><th>Detection</th><th>Diagnosis</th></tr></thead>
            <tbody>
              {props.trials.slice(0, 10).map((trial) => (
                <tr key={trial.id}>
                  <td>{props.scenarios.find((entry) => entry.id === trial.scenarioId)?.name ?? trial.scenarioId}</td>
                  <td>{trial.trialNumber}</td>
                  <td><span className={`nw-badge ${trial.monitor === "prototype" ? "ok" : "muted"}`}>{trial.monitor}</span></td>
                  <td>{seconds(trial.detectionTimeMs)}</td>
                  <td>{trial.diagnosisAccuracy === null ? <span className="nw-badge muted">—</span> : trial.diagnosisAccuracy ? <span className="nw-badge ok">Correct</span> : <span className="nw-badge crit">Missed</span>}</td>
                </tr>
              ))}
              {props.trials.length === 0 ? <tr><td colSpan={5}><div className="nw-empty">No trials yet.</div></td></tr> : null}
            </tbody>
          </table>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {props.scenarios.map((scenario) => (
              <span key={scenario.id} style={{ display: "inline-flex", gap: 6 }}>
                <button className="nw-button ghost" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => props.onTrial(scenario.id, "prototype")} disabled={props.busy.startsWith("trial:")}>▶ {scenario.name} (prototype)</button>
                <button className="nw-button ghost" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => props.onTrial(scenario.id, "manual")} disabled={props.busy.startsWith("trial:")}>▶ manual</button>
              </span>
            ))}
          </div>
        </div>

        <div className="nw-tile">
          <h2>Research report</h2>
          {props.report ? (
            <>
              <div className="nw-device">
                <div className="meta"><div className="name">Mean detection — prototype</div><div className="sub">{props.report.detectionTime.prototype.n} trials</div></div>
                <div className="rt"><div className="v">{props.report.detectionTime.prototype.mean.toFixed(2)} s</div><div className="u">σ {props.report.detectionTime.prototype.stdDev.toFixed(2)}</div></div>
              </div>
              <div className="nw-device">
                <div className="meta"><div className="name">Mean detection — manual</div><div className="sub">{props.report.detectionTime.manual.n} trials</div></div>
                <div className="rt"><div className="v">{props.report.detectionTime.manual.mean.toFixed(2)} s</div><div className="u">σ {props.report.detectionTime.manual.stdDev.toFixed(2)}</div></div>
              </div>
              <div className="nw-device">
                <div className="meta"><div className="name">Diagnosis accuracy</div><div className="sub">{props.report.diagnosisAccuracy.prototype.correct}/{props.report.diagnosisAccuracy.prototype.total}</div></div>
                <div className="rt"><div className="v">{props.report.diagnosisAccuracy.prototype.accuracyPct}%</div></div>
              </div>
              <div className="nw-diagnosis" style={{ marginTop: 12 }}>
                <span className="dl">t-test (α = {props.report.tTest.alpha}):</span>{" "}
                <span className="rc">t = {props.report.tTest.tStatistic}, df = {props.report.tTest.degreesOfFreedom}, {props.report.tTest.significant ? "significant" : "not yet significant"}</span>
              </div>
            </>
          ) : <div className="nw-empty">Run trials to populate the report.</div>}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------- automation tab

function useCanvasDrag(
  updateNode: (id: string, patch: Partial<CanvasNode>) => void,
) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);

  const onNodeMouseDown = (event: React.MouseEvent, node: CanvasNode) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    dragState.current = { nodeId: node.id, offsetX: event.clientX - rect.left - node.x, offsetY: event.clientY - rect.top - node.y };
  };

  const onMouseMove = (event: React.MouseEvent) => {
    const drag = dragState.current;
    const canvas = canvasRef.current;
    if (!drag || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width - 200, event.clientX - rect.left - drag.offsetX));
    const y = Math.max(0, Math.min(rect.height - 90, event.clientY - rect.top - drag.offsetY));
    updateNode(drag.nodeId, { x, y });
  };

  const onStopDrag = () => { dragState.current = null; };

  return { canvasRef, onNodeMouseDown, onMouseMove, onStopDrag };
}

function AutomationTab(props: {
  automations: AutomationRow[];
  runs: RunRow[];
  canvasNodes: CanvasNode[];
  canvasEdges: CanvasEdge[];
  selectedNode: CanvasNode | null;
  selectedNodeId: string | null;
  linkSource: string | null;
  automationName: string;
  editingId: string | null;
  scheduleKind: "interval" | "daily";
  intervalSeconds: number;
  dailyAt: string;
  busy: string;
  watchCount: number;
  emailCount: number;
  setAutomationName: (value: string) => void;
  setScheduleKind: (value: "interval" | "daily") => void;
  setIntervalSeconds: (value: number) => void;
  setDailyAt: (value: string) => void;
  onAddNode: (kind: keyof typeof canvasNodesDefault) => void;
  onRemoveNode: (id: string) => void;
  onUpdateNode: (id: string, patch: Partial<CanvasNode>) => void;
  onPortClick: (nodeId: string) => void;
  onSelect: (id: string | null) => void;
  onSave: () => void;
  onNew: () => void;
  onEdit: (automation: AutomationRow) => void;
  onRun: (id: string) => void;
  onToggle: (automation: AutomationRow) => void;
  onDelete: (id: string) => void;
}) {
  const { canvasRef, onNodeMouseDown, onMouseMove, onStopDrag } = useCanvasDrag(props.onUpdateNode);
  return (
    <>
      <div className="nw-console-head">
        <div>
          <h1>Network watch automations</h1>
          <div className="sub">Build automations on the canvas — device nodes persist name + IP to the database, then run on schedule and email the admin.</div>
        </div>
        <div className="nw-console-actions">
          <button className="nw-button ghost" onClick={props.onNew}>New automation</button>
          <button className="nw-button" onClick={props.onSave} disabled={props.busy === "save" || props.watchCount === 0}>
            {props.busy === "save" ? "Saving…" : props.editingId ? "Save changes" : "Create automation"}
          </button>
        </div>
      </div>

      <div className="nw-console-grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <div className="nw-tile">
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <input className="nw-input" style={{ maxWidth: 280 }} value={props.automationName} onChange={(event) => props.setAutomationName(event.target.value)} placeholder="Automation name" />
            <select className="nw-select" value={props.scheduleKind} onChange={(event) => props.setScheduleKind(event.target.value as "interval" | "daily")}>
              <option value="interval">Every N seconds</option>
              <option value="daily">Daily at time</option>
            </select>
            {props.scheduleKind === "interval" ? (
              <input className="nw-input" style={{ maxWidth: 110 }} type="number" min={10} value={props.intervalSeconds} onChange={(event) => props.setIntervalSeconds(Number(event.target.value))} />
            ) : (
              <input className="nw-input" style={{ maxWidth: 110 }} type="time" value={props.dailyAt} onChange={(event) => props.setDailyAt(event.target.value)} />
            )}
            <span className="nw-badge muted">{props.watchCount} devices · {props.emailCount} recipients</span>
          </div>

          <div className="nw-palette" style={{ marginBottom: 12 }}>
            {(Object.keys(canvasNodesDefault) as Array<keyof typeof canvasNodesDefault>).map((kind) => (
              <button className="nw-palette-btn" key={kind} onClick={() => props.onAddNode(kind)}>
                <span>{canvasNodesDefault[kind].icon}</span> {canvasNodesDefault[kind].label}
              </button>
            ))}
            <span className="nw-note" style={{ margin: "0 0 0 auto", alignSelf: "center" }}>Click a node&apos;s ▶ port, then another node, to connect.</span>
          </div>

          <div
            className="nw-canvas"
            ref={canvasRef}
            onMouseMove={onMouseMove}
            onMouseUp={onStopDrag}
            onMouseLeave={onStopDrag}
            onClick={(event) => { if (event.target === event.currentTarget) props.onSelect(null); }}
          >
            <svg className="nw-edge-svg">
              {props.canvasEdges.map((edge) => {
                const source = props.canvasNodes.find((node) => node.id === edge.source);
                const target = props.canvasNodes.find((node) => node.id === edge.target);
                if (!source || !target) return null;
                const x1 = source.x + 190, y1 = source.y + 40, x2 = target.x, y2 = target.y + 40;
                const mid = (x1 + x2) / 2;
                return <path key={edge.id} d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`} stroke="#22d3ee" strokeWidth={2} fill="none" opacity={0.75} />;
              })}
            </svg>

            {props.canvasNodes.map((node) => (
              <div
                className={`nw-node kind-${node.kind} ${props.selectedNodeId === node.id ? "selected" : ""}`}
                key={node.id}
                style={{ left: node.x, top: node.y }}
                onMouseDown={(event) => onNodeMouseDown(event, node)}
              >
                {node.kind !== "trigger" ? <button className="remove" onClick={(event) => { event.stopPropagation(); props.onRemoveNode(node.id); }}>×</button> : null}
                <div className="head">
                  <span className="icon">{canvasNodesDefault[node.kind].icon}</span>
                  <div>
                    <div className="title">{canvasNodesDefault[node.kind].label}</div>
                    <div className="subtitle">{node.kind === "watch_device" ? (node.deviceName || node.name) : node.kind === "notify_email" ? (node.email || node.name) : node.name}</div>
                  </div>
                </div>
                {node.kind === "watch_device" ? (
                  <>
                    <div className="field"><label>Device name</label><input value={node.deviceName ?? ""} onChange={(event) => props.onUpdateNode(node.id, { deviceName: event.target.value })} placeholder="Library Switch" /></div>
                    <div className="field"><label>IP address</label><input value={node.ipAddress ?? ""} onChange={(event) => props.onUpdateNode(node.id, { ipAddress: event.target.value })} placeholder="192.168.1.5" /></div>
                  </>
                ) : null}
                {node.kind === "notify_email" ? (
                  <div className="field"><label>Admin email</label><input value={node.email ?? ""} onChange={(event) => props.onUpdateNode(node.id, { email: event.target.value })} placeholder="admin@mubas.ac.mw" /></div>
                ) : null}
                {node.kind === "trigger" ? (
                  <div className="field"><label>Runs</label><input value={props.scheduleKind === "daily" ? `Daily at ${props.dailyAt}` : `Every ${props.intervalSeconds}s`} readOnly /></div>
                ) : null}
                <button
                  className={`port out ${props.linkSource === node.id ? "active" : ""}`}
                  title="Connect from this node"
                  onClick={(event) => { event.stopPropagation(); props.onPortClick(node.id); }}
                  onMouseDown={(event) => event.stopPropagation()}
                />
              </div>
            ))}

            {props.canvasNodes.length === 0 ? (
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--nw-muted)", fontSize: 13 }}>
                Add nodes from the palette above — start with Schedule → Watch device → Email admin
              </div>
            ) : null}
          </div>
        </div>

        <div className="nw-tile" style={{ maxHeight: 560, overflowY: "auto" }}>
          <h2>Saved automations</h2>
          {props.automations.length === 0 ? <div className="nw-empty">Nothing saved yet — build a canvas and save it.</div> : null}
          {props.automations.map((automation) => (
            <div className="nw-automation-card" key={automation.id}>
              <div className="top">
                <span className="name">{automation.name}</span>
                <button className={`nw-toggle ${automation.enabled ? "on" : ""}`} onClick={() => props.onToggle(automation)} title={automation.enabled ? "Disable" : "Enable"}><span className="knob" /></button>
              </div>
              <div className="meta">
                {automation.scheduleLabel} · {automation.nodes.filter((node) => node.kind === "watch_device").length} device(s) · {automation.recipients.length} recipient(s)
                <br />
                {automation.lastRunAt ? `Last run ${timeOf(automation.lastRunAt)}` : "Never run"}{automation.enabled && automation.nextRunAt ? ` · next ${timeOf(automation.nextRunAt)}` : ""}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                <button className="nw-button ghost" style={{ padding: "5px 10px", fontSize: 11.5 }} onClick={() => props.onEdit(automation)}>Edit</button>
                <button className="nw-button" style={{ padding: "5px 10px", fontSize: 11.5 }} onClick={() => props.onRun(automation.id)} disabled={props.busy === `run:${automation.id}`}>{props.busy === `run:${automation.id}` ? "Running…" : "Run now"}</button>
                <button className="nw-button danger" style={{ padding: "5px 10px", fontSize: 11.5 }} onClick={() => props.onDelete(automation.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>

        <div className="nw-tile span-2">
          <h2>Run log</h2>
          <div className="nw-run-log">
            {props.runs.length === 0 ? <div className="nw-empty">No runs yet — save an automation and it will run on its schedule.</div> : null}
            {props.runs.map((run) => (
              <div className="nw-event" key={run.id}>
                <span className="t">{timeOf(run.startedAt)}</span>
                <span style={{ flex: 1 }}>
                  {props.automations.find((automation) => automation.id === run.automationId)?.name ?? run.automationId.slice(0, 8)} · {run.trigger} · {run.devicesChecked} devices · {run.faultsDetected} faults · {run.emailsSent} email(s) {run.emailStatus ? `(${run.emailStatus})` : ""} · {run.durationMs} ms
                </span>
                <span className={`nw-badge ${run.status === "succeeded" ? "ok" : "crit"}`}>{run.status}</span>
              </div>
            ))}
          </div>
          <div className="nw-note">
            The dashboard heartbeat ticks the scheduler every 10 s while open; production deployments should call
            <code style={{ marginLeft: 6 }}> POST /api/monitoring/automations/scheduler</code> from cron.
          </div>
        </div>
      </div>
    </>
  );
}
