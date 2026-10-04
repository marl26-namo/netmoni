"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
  AlertsPanel,
  DashboardFrame,
  DashboardStyles,
  DevicesPanel,
  EntryScreen,
  ExecutionsPanel,
  NodeInspector,
  OverviewPanel,
  SettingsPanel,
  WorkflowEditor,
  WorkflowLibrary,
  DEFAULT_VIEWPORT,
  NODE_H,
  NODE_W,
  nodeDimensions,
  nodeLibrary,
} from "@/components/dashboard";
import {
  getThemeServerSnapshot,
  getThemeSnapshot,
  getWorkflowsServerSnapshot,
  getWorkflowsSnapshot,
  saveWorkflows,
  setThemePreference,
  subscribeTheme,
  subscribeWorkflows,
} from "@/components/dashboard/workspace-store";
import type {
  BackendAlert,
  BackendResult,
  DeviceEntry,
  DeviceForm,
  EditorSection,
  EntryField,
  EntryStage,
  ExecutionRun,
  NodeLibraryItem,
  SavedWorkflow,
  SettingsForm,
  Viewport,
  WorkflowNode,
} from "@/components/dashboard";

const initialNodes: WorkflowNode[] = [];

const initialDevices: DeviceEntry[] = [
  { name: "Core Router", ip: "192.168.1.1", subnet: "255.255.255.0", mac: "", type: "router", status: "Online" },
  { name: "Admin Switch", ip: "192.168.1.10", subnet: "255.255.255.0", mac: "", type: "switch", status: "Online" },
  { name: "Application Server", ip: "192.168.1.20", subnet: "255.255.255.0", mac: "", type: "server", status: "Warning" },
  { name: "Library Access Point", ip: "192.168.1.30", subnet: "", mac: "", type: "router", status: "Offline" },
];

export default function NetworkAutomationEditor() {
  /* ---------------- entry flow state ---------------- */
  const [entryStage, setEntryStage] = useState<EntryStage>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [confirmOwnerPassword, setConfirmOwnerPassword] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [currentUser, setCurrentUser] = useState({ name: "", email: "" });
  const [entryError, setEntryError] = useState("");
  const [entryBusy, setEntryBusy] = useState(false);

  /* ---------------- network automation workspace ---------------- */
  const [nodes, setNodes] = useState<WorkflowNode[]>(initialNodes);
  const [selectedNode, setSelectedNode] = useState("");
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
  const [running, setRunning] = useState(false);
  const [published, setPublished] = useState(false);
  const [search, setSearch] = useState("");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [settingsState, setSettingsState] = useState<SettingsForm>({ pollingInterval: "30", failureThreshold: "3" });
  const [executionHistory, setExecutionHistory] = useState<ExecutionRun[]>([]);
  const [backendAlerts, setBackendAlerts] = useState<BackendAlert[]>([]);
  const [backendResults, setBackendResults] = useState<BackendResult[]>([]);
  const [uiNotice, setUiNotice] = useState("");
  const [activeSection, setActiveSection] = useState<EditorSection>("Workflows");
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);
  const [workflowName, setWorkflowName] = useState("");
  const workflowLibrary = useSyncExternalStore(subscribeWorkflows, getWorkflowsSnapshot, getWorkflowsServerSnapshot);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [workflowView, setWorkflowView] = useState<"library" | "editor">("library");
  const [workflowSearch, setWorkflowSearch] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [nameInvalid, setNameInvalid] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<"Parameters" | "Settings">("Parameters");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpAppPassword, setSmtpAppPassword] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("network-monitor@yourdomain.com");
  const [smtpRecipients, setSmtpRecipients] = useState("admin@yourdomain.com");
  const [smtpState, setSmtpState] = useState("");
  const [devices, setDevices] = useState<DeviceEntry[]>(initialDevices);
  const [deviceFormOpen, setDeviceFormOpen] = useState(false);
  const [deviceForm, setDeviceForm] = useState<DeviceForm>({
    name: "",
    ip: "",
    subnet: "",
    mac: "",
    type: "router",
  });
  const [aiProvider, setAiProvider] = useState("Gemini");
  const [aiInstruction, setAiInstruction] = useState(
    "Write a concise, professional network fault notification. Include the affected device, IP, severity, evidence and recommended action."
  );
  const [aiKeys, setAiKeys] = useState<Record<string, string>>({
    Gemini: "",
    Groq: "",
    OpenAI: "",
    Anthropic: "",
    Mistral: "",
    Custom: "",
  });
  const [aiModels, setAiModels] = useState<Record<string, string>>({
    Gemini: "gemini-2.5-flash",
    Groq: "llama-3.3-70b-versatile",
    OpenAI: "gpt-5-mini",
    Anthropic: "claude-sonnet-4-5",
    Mistral: "mistral-large-latest",
    Custom: "",
  });
  const [aiBaseUrls, setAiBaseUrls] = useState<Record<string, string>>({ Custom: "" });
  const [aiKeyState, setAiKeyState] = useState("");
  const adminEmail = currentUser.email || smtpRecipients || "admin@example.com";

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<
    | { kind: "pan"; startClientX: number; startClientY: number; startVx: number; startVy: number }
    | { kind: "node"; id: string; offX: number; offY: number }
    | null
  >(null);

  const selected = nodes.find((n) => n.id === selectedNode);
  const filteredLibrary = nodeLibrary.filter((n) =>
    `${n.name} ${n.description}`.toLowerCase().includes(search.toLowerCase()),
  );

  /* Save state is derived: "saving" while the editor differs from the last saved snapshot. */
  const currentSnapshot = JSON.stringify({ nodes, workflowName, published });
  const saveState: "saved" | "saving" =
    workflowView === "editor" && activeWorkflowId && savedSnapshot !== currentSnapshot ? "saving" : "saved";

  const toggleTheme = () => setThemePreference(theme === "dark" ? "light" : "dark");

  useEffect(() => {
    if (entryStage !== "editor") return;
    let cancelled = false;
    const loadWorkspace = async () => {
      try {
        const [deviceResponse, settingsResponse, alertsResponse, resultsResponse] = await Promise.all([
          fetch("/api/monitoring/devices"),
          fetch("/api/monitoring/settings"),
          fetch("/api/monitoring/alerts"),
          fetch("/api/monitoring/results?limit=50"),
        ]);
        if (cancelled) return;
        if (deviceResponse.ok) {
          const data = await deviceResponse.json() as { devices?: Array<Record<string, unknown>> };
          if (data.devices?.length) {
            setDevices(data.devices.map((device) => ({
              name: String(device.name ?? ""),
              ip: String(device.ip ?? ""),
              subnet: String(device.subnet ?? ""),
              mac: String(device.mac ?? ""),
              type: String(device.type ?? "router"),
              status: String(device.status ?? "Online"),
            })));
          }
        }
        if (settingsResponse.ok) {
          const data = await settingsResponse.json() as { settings?: Record<string, unknown> };
          if (data.settings) {
            setSettingsState((current) => ({
              ...current,
              pollingInterval: String(data.settings?.intervalSeconds ?? current.pollingInterval),
              failureThreshold: String(data.settings?.failureThreshold ?? current.failureThreshold),
            }));
            if (data.settings?.adminEmail) setSmtpRecipients(String(data.settings.adminEmail));
            if (data.settings?.aiProvider) setAiProvider(String(data.settings.aiProvider).replace(/\b\w/g, (c) => c.toUpperCase()));
            if (data.settings?.aiInstruction) setAiInstruction(String(data.settings.aiInstruction));
          }
        }
        if (alertsResponse.ok) {
          const data = await alertsResponse.json() as { alerts?: Array<Record<string, unknown>> };
          setBackendAlerts((data.alerts ?? []).map((alert) => ({
            id: String(alert.id ?? ""),
            deviceName: String(alert.deviceName ?? ""),
            ipAddress: String(alert.ipAddress ?? ""),
            severity: String(alert.severity ?? "info"),
            status: String(alert.status ?? ""),
            summary: String(alert.summary ?? ""),
            emailStatus: String(alert.emailStatus ?? "pending"),
            createdAt: String(alert.createdAt ?? ""),
          })));
        }
        if (resultsResponse.ok) {
          const data = await resultsResponse.json() as { results?: Array<Record<string, unknown>> };
          setBackendResults((data.results ?? []).map((result) => ({
            id: String(result.id ?? ""),
            deviceName: String(result.deviceName ?? ""),
            ipAddress: String(result.ipAddress ?? ""),
            probe: String(result.probe ?? "ping"),
            ok: Boolean(result.ok),
            latencyMs: result.latencyMs === null || result.latencyMs === undefined ? null : Number(result.latencyMs),
            packetLossPercent: Number(result.packetLossPercent ?? 0),
            bandwidthInMbps: result.bandwidthInMbps === null || result.bandwidthInMbps === undefined ? null : Number(result.bandwidthInMbps),
            bandwidthOutMbps: result.bandwidthOutMbps === null || result.bandwidthOutMbps === undefined ? null : Number(result.bandwidthOutMbps),
            checkedAt: String(result.checkedAt ?? ""),
          })));
        }
      } catch {
        /* workspace loads with local defaults when the API is unreachable */
      }
    };
    void loadWorkspace();

    const poll = window.setInterval(loadWorkspace, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [entryStage]);

  useEffect(() => {
    document.documentElement.dataset.networkTheme = theme;
  }, [theme]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setViewport((v) => {
        const zoom = Math.min(1.8, Math.max(0.3, v.zoom * (e.deltaY < 0 ? 1.1 : 0.9)));
        const scale = zoom / v.zoom;
        return { zoom, x: mx - (mx - v.x) * scale, y: my - (my - v.y) * scale };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const toCanvas = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: (clientX - rect.left - viewport.x) / viewport.zoom, y: (clientY - rect.top - viewport.y) / viewport.zoom };
  };

  const onCanvasPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { kind: "pan", startClientX: e.clientX, startClientY: e.clientY, startVx: viewport.x, startVy: viewport.y };
  };

  const openNodeInspector = (id: string) => {
    setSelectedNode(id);
    setLeftOpen(true);
    setRightOpen(true);
    setActiveSection("Workflows");
  };

  const closeNodeInspector = () => {
    setRightOpen(false);
    // Closing a node configuration always restores the node library.
    setLeftOpen(true);
  };

  const showNotice = (message: string) => {
    setUiNotice(message);
    window.setTimeout(() => setUiNotice(""), 2200);
  };

  const onNodePointerDown = (e: ReactPointerEvent, node: WorkflowNode) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    canvasRef.current?.setPointerCapture(e.pointerId);
    const p = toCanvas(e.clientX, e.clientY);
    dragRef.current = { kind: "node", id: node.id, offX: p.x - node.x, offY: p.y - node.y };
    openNodeInspector(node.id);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === "pan") {
      setViewport((v) => ({ ...v, x: drag.startVx + e.clientX - drag.startClientX, y: drag.startVy + e.clientY - drag.startClientY }));
    } else {
      const p = toCanvas(e.clientX, e.clientY);
      setNodes((cur) => cur.map((n) => n.id === drag.id ? { ...n, x: p.x - drag.offX, y: p.y - drag.offY } : n));
    }
  };

  const addNode = (item: NodeLibraryItem) => {
    const id = crypto.randomUUID();
    const anchor = nodes[nodes.length - 1];
    const anchorSize = anchor ? nodeDimensions(anchor) : { width: NODE_W, height: NODE_H };
    const x = anchor ? anchor.x + anchorSize.width + 90 : 420;
    const y = anchor ? anchor.y : 260;
    const config: Record<string, string> =
      item.name === "Send Gmail"
        ? { host: "smtp.gmail.com", port: "465", secure: "true", to: adminEmail }
        : item.name === "AI Message"
          ? { model: aiProvider.toLowerCase(), instruction: aiInstruction }
          : item.type === "logic"
            ? { condition: "status == Offline OR severity == Critical" }
            : {};
    setNodes((cur) => [...cur, { id, type: item.type, name: item.name, description: item.description, icon: item.icon, x, y, config }]);
    openNodeInspector(id);
  };

  const addDeviceNode = (device: DeviceEntry) => {
    const id = crypto.randomUUID();
    const anchor = nodes[nodes.length - 1];
    setNodes((cur) => [...cur, {
      id,
      type: "trigger",
      name: device.name,
      description: `${device.ip} · ${device.status}`,
      icon: device.type === "server" ? "server" : device.type === "switch" ? "switch" : "network",
      x: anchor ? anchor.x + NODE_W + 90 : 250,
      y: anchor ? anchor.y : 180,
      config: { deviceName: device.name, ipAddress: device.ip, deviceType: device.type },
    }]);
    openNodeInspector(id);
  };

  const insertAfter = (id: string) => {
    const index = nodes.findIndex((n) => n.id === id);
    if (index < 0) return;
    const anchor = nodes[index];
    const anchorSize = nodeDimensions(anchor);
    const item = nodeLibrary.find((n) => n.type === "action")!;
    const newId = crypto.randomUUID();
    setNodes((cur) => {
      const next = cur.map((n, i) => i > index ? { ...n, x: n.x + anchorSize.width + 90 } : n);
      next.splice(index + 1, 0, { id: newId, type: item.type, name: item.name, description: item.description, icon: item.icon, x: anchor.x + anchorSize.width + 90, y: anchor.y });
      return next;
    });
    openNodeInspector(newId);
  };

  const removeNode = (id: string) => {
    setNodes((cur) => {
      const next = cur.filter((n) => n.id !== id);
      if (!next.length) {
        setSelectedNode("");
        setRightOpen(false);
      } else if (id === selectedNode) setSelectedNode(next[0].id);
      return next;
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedNode || (e.key !== "Delete" && e.key !== "Backspace")) return;
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable) return;
      e.preventDefault();
      removeNode(selectedNode);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedNode]);

  const renameNode = (id: string, name: string) => {
    setNodes((cur) => cur.map((n) => n.id === id ? { ...n, name } : n));
  };

  const changeNodeConfig = (id: string, patch: Record<string, string>) => {
    setNodes((cur) => cur.map((n) => n.id === id ? { ...n, config: { ...n.config, ...patch } } : n));
  };

  const zoomAtCenter = (factor: number) => {
    const el = canvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = rect.width / 2;
    const my = rect.height / 2;
    setViewport((v) => {
      const zoom = Math.min(1.8, Math.max(0.3, v.zoom * factor));
      const scale = zoom / v.zoom;
      return { zoom, x: mx - (mx - v.x) * scale, y: my - (my - v.y) * scale };
    });
  };

  const fitView = () => {
    const el = canvasRef.current;
    if (!el || !nodes.length) return;
    const rect = el.getBoundingClientRect();
    const minX = Math.min(...nodes.map((n) => n.x)) - 100;
    const maxX = Math.max(...nodes.map((n) => n.x + nodeDimensions(n).width)) + 100;
    const minY = Math.min(...nodes.map((n) => n.y)) - 100;
    const maxY = Math.max(...nodes.map((n) => n.y + nodeDimensions(n).height)) + 100;
    const zoom = Math.min(1.4, Math.max(0.3, Math.min(rect.width / (maxX - minX), rect.height / (maxY - minY))));
    setViewport({ zoom, x: (rect.width - (maxX - minX) * zoom) / 2 - minX * zoom, y: (rect.height - (maxY - minY) * zoom) / 2 - minY * zoom });
  };

  const executeWorkflow = async () => {
    setRunning(true);
    const executionId = crypto.randomUUID();
    const startedAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setExecutionHistory((cur) => [
      { id: executionId, time: startedAt, status: "Running", detail: `${nodes.length} nodes · ${workflowName}` },
      ...cur,
    ].slice(0, 12));
    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "workflow.execute",
          payload: { workflowId: activeWorkflowId ?? "unsaved-workflow", organizationId, probe: "ping" },
        }),
      });
      const data = await response.json() as { executions?: Array<{ output?: { outcomes?: Array<{ deviceName?: string; status?: string; ok?: boolean; latencyMs?: number | null; packetLossPercent?: number }> } }>; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Execution endpoint returned an error");
      const outcomes = data.executions?.[0]?.output?.outcomes ?? [];
      const faulted = outcomes.filter((outcome) => outcome.status && outcome.status !== "Online");
      setExecutionHistory((cur) => cur.map((item) => item.id === executionId ? {
        ...item,
        status: "Success",
        detail: outcomes.length ? `${outcomes.length} devices probed · ${faulted.length} fault(s)` : "No registered devices to probe",
      } : item));
      showNotice(outcomes.length ? `Monitor cycle complete: ${outcomes.length} devices, ${faulted.length} fault(s).` : "No devices registered in the monitoring database yet.");
    } catch {
      setExecutionHistory((cur) => cur.map((item) => item.id === executionId ? { ...item, status: "Failed" } : item));
      showNotice("Workflow was saved locally, but the execution API could not be reached.");
    } finally {
      window.setTimeout(() => setRunning(false), 900);
    }
  };

  const addDevice = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!deviceForm.name.trim() || !deviceForm.ip.trim()) return;
    setDevices((cur) => [
      ...cur,
      {
        name: deviceForm.name.trim(),
        ip: deviceForm.ip.trim(),
        subnet: deviceForm.subnet.trim(),
        mac: deviceForm.mac.trim(),
        type: deviceForm.type,
        status: "Online",
      },
    ]);
    setDeviceForm({ name: "", ip: "", subnet: "", mac: "", type: "router" });
    setDeviceFormOpen(false);
    void fetch("/api/monitoring/devices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: deviceForm.name.trim(), ip: deviceForm.ip.trim(), subnet: deviceForm.subnet.trim(), mac: deviceForm.mac.trim(), type: deviceForm.type }),
    }).then((response) => response.json().then((data) => ({ ok: response.ok, data }))).then(({ ok, data }) => {
      if (ok) showNotice(`${deviceForm.name.trim()} registered for monitoring.`);
      else showNotice(String((data as { error?: string }).error ?? "Device could not be saved to the monitoring database."));
    }).catch(() => showNotice("Device kept locally; the monitoring API was unreachable."));
  };

  const removeDevice = (ip: string) => {
    setDevices((cur) => cur.filter((d) => d.ip !== ip));
    void fetch(`/api/monitoring/devices?ip=${encodeURIComponent(ip)}`, { method: "DELETE" }).catch(() => undefined);
  };

  const testDevice = (device: DeviceEntry) => {
    showNotice(`Testing ${device.name} (${device.ip})...`);
    void fetch("/api/monitoring/results", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ip: device.ip, probe: "ping" }),
    }).then((response) => response.json()).then((data: { outcome?: { status?: string; latencyMs?: number | null; packetLossPercent?: number }; error?: string }) => {
      if (data.error) { showNotice(data.error); return; }
      const outcome = data.outcome;
      setDevices((cur) => cur.map((entry) => entry.ip === device.ip ? { ...entry, status: outcome?.status ?? entry.status } : entry));
      showNotice(`${device.name}: ${outcome?.status ?? "unknown"} · ${outcome?.latencyMs ?? "–"} ms · ${outcome?.packetLossPercent ?? 0}% loss`);
    }).catch(() => showNotice("Device test API unreachable."));
  };

  const saveSmtp = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setSmtpState("Saving SMTP configuration...");
    try {
      const [settingsResponse, emailStatus] = await Promise.all([
        fetch("/api/monitoring/settings", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ adminEmail: smtpRecipients || adminEmail }),
        }),
        fetch("/api/monitoring/email"),
      ]);
      const statusData = await emailStatus.json() as { smtpConfigured?: boolean; host?: string; port?: number; user?: string | null };
      if (!settingsResponse.ok) throw new Error("Settings endpoint rejected the update");
      setSmtpState(statusData.smtpConfigured
        ? `SMTP ready on ${statusData.host}:${statusData.port} as ${statusData.user}. Fault alerts will dispatch to ${smtpRecipients || adminEmail}.`
        : "Recipient saved. Set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASSWORD server-side to enable live dispatch.");
    } catch {
      setSmtpState("SMTP configuration saved locally; the settings API was unreachable.");
    }
  };

  const saveMonitoringSettings = () => {
    void fetch("/api/monitoring/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ intervalSeconds: Number(settingsState.pollingInterval), failureThreshold: Number(settingsState.failureThreshold), adminEmail: smtpRecipients || adminEmail, aiProvider: aiProvider.toLowerCase(), aiInstruction }),
    }).then((response) => response.json()).then((data: { settings?: Record<string, unknown>; error?: string }) => {
      showNotice(data.error ? `Settings could not be saved: ${data.error}` : "Monitoring settings saved to the organization database.");
    }).catch(() => showNotice("Settings kept locally; the monitoring API was unreachable."));
  };

  /* ---------------- auth / org flows: unchanged API process ---------------- */
  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEntryBusy(true);
    setEntryError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = (await response.json()) as {
      user?: { name: string; email: string };
      organization?: { id: string; name: string };
      session?: { workspaceId: string };
      error?: string;
    };
    if (!response.ok || !data.session) {
      setEntryError("Enter an email and password to continue.");
      setEntryBusy(false);
      return;
    }
    setOrganizationId(data.session.workspaceId);
    if (data.user) {
      setCurrentUser(data.user);
      if (data.user.email) setSmtpRecipients(data.user.email);
    }
    if (data.organization) setOrganizationName(data.organization.name);
    setEntryStage("editor");
    setEntryBusy(false);
  };

  const createOrganization = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEntryBusy(true);
    setEntryError("");
    const response = await fetch("/api/organizations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: organizationName,
        ownerName,
        ownerEmail,
        ownerPassword,
        confirmPassword: confirmOwnerPassword,
      }),
    });
    const data = (await response.json()) as {
      organization?: { id: string };
      owner?: { name: string; email: string };
      error?: string;
    };
    if (!response.ok || !data.organization) {
      setEntryError(data.error ?? "Could not create organization.");
      setEntryBusy(false);
      return;
    }
    setOrganizationId(data.organization.id);
    if (data.owner) {
      setCurrentUser(data.owner);
      if (data.owner.email) setSmtpRecipients(data.owner.email);
    }
    setEntryStage("editor");
    setEntryBusy(false);
  };

  const setEntryField = (field: EntryField, value: string) => {
    switch (field) {
      case "email": setEmail(value); break;
      case "password": setPassword(value); break;
      case "organizationName": setOrganizationName(value); break;
      case "ownerName": setOwnerName(value); break;
      case "ownerEmail": setOwnerEmail(value); break;
      case "ownerPassword": setOwnerPassword(value); break;
      case "confirmOwnerPassword": setConfirmOwnerPassword(value); break;
    }
  };

  /* ---------------- workflow library persistence (localStorage store) ---------------- */
  const persistWorkflowLibrary = (next: SavedWorkflow[]) => saveWorkflows(next);

  /** Best-effort server copy so saved workflows are inspectable via the API. */
  const syncWorkflowToServer = async (workflow: SavedWorkflow) => {
    try {
      const triggerNode = workflow.nodes.find((node) => node.type === "trigger");
      await fetch("/api/automations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: workflow.id,
          name: workflow.name,
          description: `${workflow.nodes.length} node network automation saved from the workflow editor.`,
          trigger: { event: triggerNode?.config?.event ?? "fault" },
          enabled: workflow.published,
          nodes: workflow.nodes.map((node) => ({
            id: node.id,
            kind: node.type,
            name: node.name,
            ...(node.config ? { config: node.config } : {}),
          })),
        }),
      });
    } catch {
      /* the local library stays the source of truth when the API is unreachable */
    }
  };

  const handleWorkflowNameChange = (value: string) => {
    setWorkflowName(value);
    if (nameInvalid && value.trim()) setNameInvalid(false);
  };

  const createWorkflow = () => {
    setActiveWorkflowId(null);
    setWorkflowName("");
    setNameInvalid(false);
    setNodes([]);
    setSelectedNode("");
    setPublished(false);
    setViewport(DEFAULT_VIEWPORT);
    setLeftOpen(true);
    setRightOpen(false);
    setWorkflowView("editor");
    setSavedSnapshot(null);
  };

  const openWorkflow = (workflow: SavedWorkflow) => {
    setActiveWorkflowId(workflow.id);
    setWorkflowName(workflow.name);
    setNameInvalid(false);
    setNodes(workflow.nodes ?? []);
    setSelectedNode(workflow.nodes?.[0]?.id ?? "");
    setPublished(Boolean(workflow.published));
    setViewport(DEFAULT_VIEWPORT);
    setLeftOpen(true);
    setRightOpen(Boolean(workflow.nodes?.length));
    setWorkflowView("editor");
    setSavedSnapshot(JSON.stringify({ nodes: workflow.nodes ?? [], workflowName: workflow.name, published: Boolean(workflow.published) }));
  };

  /** Saves the current workflow under its name. Returns false when unnamed. */
  const saveCurrentWorkflow = (): boolean => {
    const name = workflowName.trim();
    if (!name) {
      setNameInvalid(true);
      showNotice("Name your workflow before saving.");
      return false;
    }
    const now = new Date().toISOString();
    const id = activeWorkflowId ?? crypto.randomUUID();
    const existing = workflowLibrary.find((workflow) => workflow.id === id);
    const saved: SavedWorkflow = {
      id,
      name,
      nodes,
      published,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const next = [saved, ...workflowLibrary.filter((workflow) => workflow.id !== id)];
    setActiveWorkflowId(id);
    setWorkflowName(name);
    setNameInvalid(false);
    persistWorkflowLibrary(next);
    setSavedSnapshot(JSON.stringify({ nodes, workflowName: name, published }));
    showNotice("Workflow saved.");
    void syncWorkflowToServer(saved);
    return true;
  };

  const saveNodeConfiguration = (nodeName: string) => {
    if (!saveCurrentWorkflow()) return;
    showNotice(`${nodeName} configuration saved.`);
  };

  const deleteWorkflow = (id: string) => {
    const next = workflowLibrary.filter((workflow) => workflow.id !== id);
    persistWorkflowLibrary(next);
    if (activeWorkflowId === id) {
      setActiveWorkflowId(null);
      setSavedSnapshot(null);
      setWorkflowView("library");
      setNodes([]);
      setSelectedNode("");
    }
    showNotice("Workflow deleted.");
  };

  const duplicateWorkflow = (workflow: SavedWorkflow) => {
    const copy: SavedWorkflow = {
      ...workflow,
      id: crypto.randomUUID(),
      name: `${workflow.name} copy`,
      nodes: workflow.nodes.map((node) => ({ ...node, id: crypto.randomUUID() })),
      published: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    persistWorkflowLibrary([copy, ...workflowLibrary]);
    showNotice("Workflow duplicated.");
  };

  /* ---------------- AI + SMTP inspector controllers ---------------- */
  const aiController = {
    provider: aiProvider,
    models: aiModels,
    keys: aiKeys,
    baseUrls: aiBaseUrls,
    keyState: aiKeyState,
    instruction: aiInstruction,
    onProviderChange: (nodeId: string, provider: string) => {
      setAiProvider(provider);
      setAiKeyState("");
      setNodes((cur) => cur.map((n) => n.id === nodeId
        ? { ...n, config: { ...n.config, provider, model: aiModels[provider] ?? "" } }
        : n
      ));
    },
    onKeyChange: (nodeId: string, value: string) => {
      setAiKeys((cur) => ({ ...cur, [aiProvider]: value }));
      setAiKeyState("");
      setNodes((cur) => cur.map((n) => n.id === nodeId
        ? { ...n, config: { ...n.config, provider: aiProvider, hasApiKey: value ? "true" : "false" } }
        : n
      ));
    },
    onModelChange: (nodeId: string, model: string) => {
      setAiModels((cur) => ({ ...cur, [aiProvider]: model }));
      setNodes((cur) => cur.map((n) => n.id === nodeId
        ? { ...n, config: { ...n.config, provider: aiProvider, model } }
        : n
      ));
    },
    onBaseUrlChange: (value: string) => setAiBaseUrls({ Custom: value }),
    onInstructionChange: (nodeId: string, value: string) => {
      setAiInstruction(value);
      setNodes((cur) => cur.map((n) => n.id === nodeId
        ? { ...n, config: { ...n.config, instruction: value } }
        : n
      ));
    },
    onSaveKey: () => setAiKeyState(aiKeys[aiProvider] ? `${aiProvider} API key added to this node.` : "Add an API key before saving this AI connection."),
  };

  const smtpController = {
    user: smtpUser,
    appPassword: smtpAppPassword,
    from: smtpFrom,
    recipients: smtpRecipients,
    state: smtpState,
    adminEmail,
    onUserChange: setSmtpUser,
    onAppPasswordChange: setSmtpAppPassword,
    onFromChange: setSmtpFrom,
    onRecipientsChange: setSmtpRecipients,
    onSubmit: saveSmtp,
  };

  /* ---------------- dashboard sections ---------------- */
  const renderPage = () => {
    if (activeSection === "Workflows") {
      if (workflowView === "library") {
        return (
          <WorkflowLibrary
            workflows={workflowLibrary}
            search={workflowSearch}
            onSearchChange={setWorkflowSearch}
            onCreate={createWorkflow}
            onOpen={openWorkflow}
            onDuplicate={duplicateWorkflow}
            onDelete={deleteWorkflow}
          />
        );
      }
      return (
        <WorkflowEditor
          canvasRef={canvasRef}
          nodes={nodes}
          selectedId={selectedNode}
          running={running}
          viewport={viewport}
          leftOpen={leftOpen}
          search={search}
          devices={devices}
          library={filteredLibrary}
          onSearchChange={setSearch}
          onCloseLibrary={() => setLeftOpen(false)}
          onReopenLibrary={() => setLeftOpen(true)}
          onCanvasPointerDown={onCanvasPointerDown}
          onCanvasPointerMove={onPointerMove}
          onCanvasPointerUp={() => { dragRef.current = null; }}
          onNodePointerDown={onNodePointerDown}
          onAddNode={addNode}
          onAddDeviceNode={addDeviceNode}
          onInsertAfter={insertAfter}
          onRemoveNode={removeNode}
          onZoom={zoomAtCenter}
          onFitView={fitView}
          onResetViewport={() => setViewport(DEFAULT_VIEWPORT)}
          inspector={rightOpen && selected ? (
            <NodeInspector
              node={selected}
              tab={inspectorTab}
              onTabChange={setInspectorTab}
              onRename={renameNode}
              onConfigChange={changeNodeConfig}
              onClose={closeNodeInspector}
              onSaveNode={saveNodeConfiguration}
              ai={aiController}
              smtp={smtpController}
            />
          ) : undefined}
        />
      );
    }

    if (activeSection === "Devices") {
      return (
        <DevicesPanel
          devices={devices}
          results={backendResults}
          formOpen={deviceFormOpen}
          form={deviceForm}
          onOpenForm={() => setDeviceFormOpen(true)}
          onCloseForm={() => setDeviceFormOpen(false)}
          onFormChange={(patch) => setDeviceForm((current) => ({ ...current, ...patch }))}
          onSubmit={addDevice}
          onRemove={removeDevice}
          onTest={testDevice}
        />
      );
    }

    if (activeSection === "Alerts") return <AlertsPanel devices={devices} alerts={backendAlerts} />;

    if (activeSection === "Executions") return <ExecutionsPanel results={backendResults} history={executionHistory} />;

    if (activeSection === "Settings") {
      return (
        <SettingsPanel
          settings={settingsState}
          onSettingsChange={(patch) => setSettingsState((current) => ({ ...current, ...patch }))}
          workflowName={workflowName}
          onWorkflowNameChange={handleWorkflowNameChange}
          onSaveSettings={saveMonitoringSettings}
        />
      );
    }

    return <OverviewPanel onOpenWorkflows={() => setActiveSection("Workflows")} />;
  };

  /* ---------------- entry screens ---------------- */
  if (entryStage !== "editor") {
    return (
      <EntryScreen
        stage={entryStage}
        fields={{
          email,
          password,
          organizationName,
          ownerName,
          ownerEmail,
          ownerPassword,
          confirmOwnerPassword,
        }}
        onField={setEntryField}
        error={entryError}
        busy={entryBusy}
        onLogin={login}
        onCreateOrganization={createOrganization}
        onStartOrganization={() => { setEntryStage("organization"); setEntryError(""); }}
        onBackToLogin={() => setEntryStage("login")}
      />
    );
  }

  return (
    <>
      <DashboardStyles />
      <DashboardFrame
        theme={theme}
        onToggleTheme={toggleTheme}
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        organizationName={organizationName}
        user={currentUser}
        workflowView={workflowView}
        workflowName={workflowName}
        nameInvalid={nameInvalid}
        onWorkflowNameChange={handleWorkflowNameChange}
        saveState={saveState}
        published={published}
        running={running}
        notice={uiNotice}
        onBackToLibrary={() => setWorkflowView("library")}
        onCreateWorkflow={createWorkflow}
        onSaveWorkflow={() => { saveCurrentWorkflow(); }}
        onTogglePublished={() => setPublished(!published)}
        onExecute={executeWorkflow}
      >
        {renderPage()}
      </DashboardFrame>
    </>
  );
}
