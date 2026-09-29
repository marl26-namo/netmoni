"use client";

import { useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Activity, AlertTriangle, ArrowRight, Bell, BrainCircuit, CheckCircle2, CircleHelp, Clock3, Database, GitBranch, Globe2, Mail, Network, Play, Plus, Router, Server, Settings, ShieldAlert, Sparkles, Trash2, Workflow, X, Zap } from "lucide-react";

type NodeType = "trigger" | "action" | "logic";

type WorkflowNode = {
  id: string;
  type: NodeType;
  name: string;
  description: string;
  icon: string;
  x: number;
  y: number;
  config?: Record<string, string>;
};

type EntryStage = "login" | "organization" | "database" | "editor";
type EditorSection = "Overview" | "Workflows" | "Executions" | "Devices" | "Alerts" | "Settings";
type Viewport = { x: number; y: number; zoom: number };

const NODE_W = 112;
const NODE_H = 132;
const DEFAULT_VIEWPORT: Viewport = { x: 160, y: 80, zoom: 0.9 };

const initialNodes: WorkflowNode[] = [
  {
    id: "fault-trigger",
    type: "trigger",
    name: "Network Fault",
    description: "Starts when a monitored device fails or crosses a threshold.",
    icon: "fault",
    x: 120,
    y: 170,
  },
  {
    id: "fault-condition",
    type: "logic",
    name: "Check Severity",
    description: "Routes critical and offline incidents.",
    icon: "if",
    x: 420,
    y: 170,
    config: { condition: "status == Offline OR severity == Critical" },
  },
  {
    id: "ai-message",
    type: "action",
    name: "AI Message",
    description: "Creates a clear administrator-ready incident message.",
    icon: "ai",
    x: 720,
    y: 170,
    config: {
      model: "gemini",
      instruction: "Explain the network fault, affected device, severity and recommended action.",
    },
  },
  {
    id: "send-email",
    type: "action",
    name: "Send Gmail",
    description: "Sends the AI-generated fault message to the administrator Gmail.",
    icon: "mail",
    x: 1020,
    y: 170,
    config: {
      host: "smtp.gmail.com",
      port: "465",
      secure: "true",
      to: "admin",
    },
  },
];

const nodeLibrary = [
  { type: "trigger" as const, name: "Network Fault", description: "Start when a device fails", icon: "fault" },
  { type: "trigger" as const, name: "Status Changed", description: "Start on device status change", icon: "status" },
  { type: "trigger" as const, name: "Schedule Monitor", description: "Run monitoring on a schedule", icon: "schedule" },
  { type: "logic" as const, name: "IF Severity", description: "Branch by severity or status", icon: "if" },
  { type: "logic" as const, name: "Switch Device", description: "Route by device type", icon: "switch" },
  { type: "action" as const, name: "AI Message", description: "Generate the fault message with AI", icon: "ai" },
  { type: "action" as const, name: "Send Gmail", description: "Send through Google SMTP", icon: "mail" },
  { type: "action" as const, name: "Create Alert", description: "Create a monitoring incident", icon: "alert" },
  { type: "action" as const, name: "HTTP Request", description: "Call a notification API", icon: "http" },
  { type: "action" as const, name: "Record Incident", description: "Save the network event", icon: "db" },
];

function edgePath(x1: number, y1: number, x2: number, y2: number) {
  const dx = Math.max(70, Math.abs(x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

function NodeGlyph({ icon, size = 18 }: { icon: string; size?: number }) {
  const props = { size, strokeWidth: 2 };
  switch (icon) {
    case "fault": return <ShieldAlert {...props} />;
    case "if": return <GitBranch {...props} />;
    case "mail": return <Mail {...props} />;
    case "ai": return <BrainCircuit {...props} />;
    case "status": return <Activity {...props} />;
    case "schedule": return <Clock3 {...props} />;
    case "switch": return <GitBranch {...props} />;
    case "alert": return <AlertTriangle {...props} />;
    case "http": return <Globe2 {...props} />;
    case "db": return <Database {...props} />;
    case "network": return <Network {...props} />;
    case "server": return <Server {...props} />;
    default: return <Zap {...props} />;
  }
}

function DeviceGlyph({ type = "router", size = 24 }: { type?: string; size?: number }) {
  const props = { size, strokeWidth: 1.9 };
  if (type.toLowerCase().includes("server")) return <Server {...props} />;
  if (type.toLowerCase().includes("switch")) return <Network {...props} />;
  return <Router {...props} />;
}

function typeLabel(type: NodeType) {
  return type === "trigger" ? "Trigger" : type === "logic" ? "Logic" : "Action";
}

function nodeDimensions(node: WorkflowNode) {
  return node.icon === "ai" ? { width: 260, height: 108 } : { width: 116, height: 116 };
}

export default function NetworkAutomationEditor() {
  /* ---------------- entry flow state: intentionally unchanged ---------------- */
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
  const [organizationDbUrl, setOrganizationDbUrl] = useState("file:./organization.db");
  const [entryError, setEntryError] = useState("");
  const [entryBusy, setEntryBusy] = useState(false);

  /* ---------------- network automation workspace ---------------- */
  const [nodes, setNodes] = useState<WorkflowNode[]>(initialNodes);
  const [selectedNode, setSelectedNode] = useState("fault-trigger");
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
  const [running, setRunning] = useState(false);
  const [published, setPublished] = useState(false);
  const [search, setSearch] = useState("");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [settingsState, setSettingsState] = useState({ pollingInterval: "30", failureThreshold: "3" });
  const [executionHistory, setExecutionHistory] = useState<Array<{ id: string; time: string; status: string; detail: string }>>([]);
  const [uiNotice, setUiNotice] = useState("");
  const [activeSection, setActiveSection] = useState<EditorSection>("Workflows");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [workflowName, setWorkflowName] = useState("Network Fault Notification");
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const [inspectorTab, setInspectorTab] = useState<"Parameters" | "Settings">("Parameters");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpAppPassword, setSmtpAppPassword] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("network-monitor@yourdomain.com");
  const [smtpRecipients, setSmtpRecipients] = useState("admin@yourdomain.com");
  const [smtpState, setSmtpState] = useState("");
  const [devices, setDevices] = useState([
    { name: "Core Router", ip: "192.168.1.1", subnet: "255.255.255.0", mac: "", type: "router", status: "Online" },
    { name: "Admin Switch", ip: "192.168.1.10", subnet: "255.255.255.0", mac: "", type: "switch", status: "Online" },
    { name: "Application Server", ip: "192.168.1.20", subnet: "255.255.255.0", mac: "", type: "server", status: "Warning" },
    { name: "Library Access Point", ip: "192.168.1.30", subnet: "", mac: "", type: "router", status: "Offline" },
  ]);
  const [deviceFormOpen, setDeviceFormOpen] = useState(false);
  const [deviceForm, setDeviceForm] = useState({
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

  useEffect(() => {
    if (currentUser.email) setSmtpRecipients(currentUser.email);
  }, [currentUser.email]);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("network-automation-theme");
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.networkTheme = theme;
    window.localStorage.setItem("network-automation-theme", theme);
  }, [theme]);

  useEffect(() => {
    setSaveState("saving");
    const t = window.setTimeout(() => setSaveState("saved"), 700);
    return () => window.clearTimeout(t);
  }, [nodes, workflowName, published]);

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

  const addNode = (item: typeof nodeLibrary[number]) => {
    const id = crypto.randomUUID();
    const anchor = nodes[nodes.length - 1];
    const anchorSize = anchor ? nodeDimensions(anchor) : { width: NODE_W, height: NODE_H };
    const x = anchor ? anchor.x + anchorSize.width + 90 : 250;
    const y = anchor ? anchor.y : 180;
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
      if (!next.length) setSelectedNode("");
      else if (id === selectedNode) setSelectedNode(next[0].id);
      return next;
    });
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
          payload: { workflowId: "network-fault-notification", organizationId, nodes },
        }),
      });
      if (!response.ok) throw new Error("Execution endpoint returned an error");
      setExecutionHistory((cur) => cur.map((item) => item.id === executionId ? { ...item, status: "Success" } : item));
      showNotice("Workflow test completed successfully.");
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
  };

  const removeDevice = (ip: string) => {
    setDevices((cur) => cur.filter((d) => d.ip !== ip));
  };

  const saveSmtp = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setSmtpState("Saving SMTP configuration...");
    /*
      Google SMTP values:
      host: smtp.gmail.com
      port: 465
      secure: true
      auth.user: Google/Gmail address
      auth.pass: Google App Password
      The actual Nodemailer transporter belongs on the server, never in this client component.
    */
    setSmtpState("SMTP configuration ready. Store these values server-side before enabling live dispatch.");
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
    if (data.user) setCurrentUser(data.user);
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
    if (data.owner) setCurrentUser(data.owner);
    setEntryStage("database");
    setEntryBusy(false);
  };

  const connectOrganizationDatabase = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEntryBusy(true);
    setEntryError("");
    const response = await fetch(`/api/organizations/${organizationId}/database`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: organizationDbUrl }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setEntryError(data.error ?? "We could not connect to that database.");
      setEntryBusy(false);
      return;
    }
    setEntryStage("editor");
    setEntryBusy(false);
  };

  const renderWorkflow = () => (
    <div className="editor-body">
      {leftOpen && (
        <aside className="nodes-panel">
          <div className="nodes-panel-head">
            <strong>Network nodes</strong>
            <button className="icon-btn" onClick={() => setLeftOpen(false)} title="Hide node library"><X size={16} /></button>
          </div>
          <div className="nodes-search">
            <span>⌕</span>
            <input placeholder="Search network nodes..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="nodes-panel-body">
            <div className="device-library-section">
              <div className="nodes-section-title device-library-title">
                <span>Registered devices</span>
                <small>{devices.length}</small>
              </div>
              {devices.map((device) => (
                <button
                  className={`node-item device-library-item ${device.status.toLowerCase()}`}
                  key={device.ip}
                  onClick={() => {
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
                      config: { deviceName: device.name, ipAddress: device.ip, deviceType: device.type }
                    }]);
                    openNodeInspector(id);
                  }}
                >
                  <span className={`device-library-icon ${device.status.toLowerCase()}`}>
                    <DeviceGlyph type={device.type} size={17} />
                  </span>
                  <span className="node-item-text">
                    <strong>{device.name}</strong>
                    <small>{device.ip}</small>
                  </span>
                  <span className={`device-dot ${device.status.toLowerCase()}`} />
                </button>
              ))}
              {!devices.length && <div className="device-library-empty">Add devices from the Devices page.</div>}
            </div>

            {(["trigger", "logic", "action"] as NodeType[]).map((type) => {
              const items = filteredLibrary.filter((n) => n.type === type);
              if (!items.length) return null;
              return (
                <div key={type}>
                  <div className="nodes-section-title">
                    {type === "trigger" ? "Network triggers" : type === "logic" ? "Conditions & routing" : "Network actions"}
                  </div>
                  {items.map((item) => (
                    <button className="node-item" key={item.name} onClick={() => addNode(item)}>
                      <span className={`node-icon type-${item.type}`}><NodeGlyph icon={item.icon} size={17} /></span>
                      <span className="node-item-text">
                        <strong>{item.name}</strong>
                        <small>{item.description}</small>
                      </span>
                      <span className="node-item-plus">+</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </aside>
      )}

      <div
        ref={canvasRef}
        className={`canvas ${running ? "is-running" : ""}`}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => { dragRef.current = null; }}
      >
        <div className="canvas-viewport" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}>
          <svg className="edges-layer">
            {nodes.slice(0, -1).map((node, i) => {
              const next = nodes[i + 1];
              const size = nodeDimensions(node);
              const nextSize = nodeDimensions(next);
              const d = edgePath(node.x + size.width, node.y + size.height / 2, next.x, next.y + nextSize.height / 2);
              return (
                <g key={node.id}>
                  <path d={d} className={`edge-path ${running ? "running" : ""}`} />
                  {running && <circle r={5} className="edge-pulse"><animateMotion dur="1.1s" repeatCount="indefinite" path={d} /></circle>}
                </g>
              );
            })}
          </svg>

          {nodes.map((node) => {
            const wide = node.icon === "ai";
            const { width: nodeWidth, height: nodeHeight } = nodeDimensions(node);
            return (
              <div
                key={node.id}
                className={`wf-node wf-node-compact ${wide ? "wf-node-agent" : "wf-node-card"} type-${node.type} ${selectedNode === node.id ? "selected" : ""} ${running ? "running" : ""}`}
                style={{ left: node.x, top: node.y, width: nodeWidth, height: nodeHeight }}
                onPointerDown={(e) => onNodePointerDown(e, node)}
                title={`${node.name} — ${node.description}`}
                aria-label={`${node.name}. ${node.description}`}
              >
                <span className="handle handle-in" />
                <div className="wf-node-surface">
                  <span className={`wf-node-icon type-${node.type}`}><NodeGlyph icon={node.icon} size={wide ? 30 : 34} /></span>
                  {wide && (
                    <div className="wf-node-agent-copy">
                      <strong>{node.name}</strong>
                      <small>AI-assisted network diagnosis</small>
                    </div>
                  )}
                  {running && <span className="wf-node-pulse" />}
                </div>
                {!wide && <div className="wf-node-label">{node.name}</div>}
                {wide && (
                  <div className="wf-node-ports">
                    <span>AI Provider</span>
                    <span>Tools</span>
                  </div>
                )}

                <div className="wf-node-hover-card">
                  <div className="wf-node-hover-top">
                    <span className="wf-node-hover-icon"><NodeGlyph icon={node.icon} size={18} /></span>
                    <div><strong>{node.name}</strong><small>{typeLabel(node.type)} node</small></div>
                  </div>
                  <p>{node.description}</p>
                  {node.name === "Send Gmail" && <span className="wf-node-hover-meta">Google SMTP · Nodemailer</span>}
                  {node.name === "AI Message" && <span className="wf-node-hover-meta">AI provider · API key</span>}
                </div>

                <button className="node-delete node-delete-compact" aria-label={`Delete ${node.name}`} onPointerDown={(e) => e.stopPropagation()} onClick={() => removeNode(node.id)}>
                  <X size={12} />
                </button>
                <span className="handle handle-out" />
                <button className="quick-add quick-add-compact" aria-label={`Add node after ${node.name}`} onPointerDown={(e) => e.stopPropagation()} onClick={() => insertAfter(node.id)}>
                  <Plus size={12} />
                </button>
              </div>
            );
          })}

          <div className="wf-support-connection ai-support-line" aria-hidden="true" />
          <button className="wf-support-node wf-support-ai" type="button" onClick={() => {
            const aiNode = nodes.find((n) => n.name === "AI Message");
            if (aiNode) {
              openNodeInspector(aiNode.id);
            }
          }} title="Configure AI provider">
            <span><Sparkles size={25} /></span>
            <strong>{aiProvider}</strong>
            <small>AI provider</small>
          </button>

          <div className="wf-support-connection smtp-support-line" aria-hidden="true" />
          <button className="wf-support-node wf-support-mail" type="button" onClick={() => {
            const mailNode = nodes.find((n) => n.name === "Send Gmail");
            if (mailNode) {
              openNodeInspector(mailNode.id);
            }
          }} title="Configure Gmail SMTP">
            <span><Mail size={25} /></span>
            <strong>Gmail SMTP</strong>
            <small>Nodemailer</small>
          </button>

          <div className="wf-support-connection device-support-line" aria-hidden="true" />
          <button className="wf-support-node wf-support-device" type="button" onClick={() => { setActiveSection("Devices"); setLeftOpen(true); setRightOpen(false); }} title="Open monitored devices">
            <span><Network size={25} /></span>
            <strong>Devices</strong>
            <small>Network source</small>
          </button>
        </div>

        {!leftOpen && <button className="reopen-library" onClick={() => setLeftOpen(true)} title="Show node library"><Network size={15} /> Nodes</button>}
        <div className="canvas-workflow-badge"><span className="canvas-live-dot" /> Live network workflow</div>
        <div className="canvas-controls">
          <button onClick={() => zoomAtCenter(1.2)}>+</button>
          <button onClick={() => zoomAtCenter(1 / 1.2)}>−</button>
          <span className="zoom-readout">{Math.round(viewport.zoom * 100)}%</span>
          <button onClick={fitView}>⛶</button>
          <button onClick={() => setViewport(DEFAULT_VIEWPORT)}>1:1</button>
        </div>
        <div className="canvas-hint">
          <span><kbd>Scroll</kbd> zoom</span>
          <span><kbd>Drag</kbd> pan / move</span>
          <span><kbd>Del</kbd> remove</span>
        </div>
      </div>

      {rightOpen && selected && (
        <aside className="inspector">
          <div className="inspector-head">
            <div className={`inspector-icon type-${selected.type}`}><NodeGlyph icon={selected.icon} size={20} /></div>
            <div className="inspector-title">
              <input
                value={selected.name}
                onChange={(e) => setNodes((cur) => cur.map((n) => n.id === selected.id ? { ...n, name: e.target.value } : n))}
              />
              <small>{typeLabel(selected.type)} node</small>
            </div>
            <button className="icon-btn" onClick={closeNodeInspector} title="Close node configuration"><X size={17} /></button>
          </div>

          <div className="inspector-tabs">
            {(["Parameters", "Settings"] as const).map((tab) => (
              <button key={tab} className={inspectorTab === tab ? "active" : ""} onClick={() => setInspectorTab(tab)}>{tab}</button>
            ))}
          </div>

          <div className="inspector-body">
            {inspectorTab === "Parameters" ? (
              <>
                {selected.type === "trigger" && (
                  <div className="field">
                    <label>Trigger event</label>
                    <select
                      value={selected.config?.event ?? "fault"}
                      onChange={(e) => setNodes((cur) => cur.map((n) => n.id === selected.id ? { ...n, config: { ...n.config, event: e.target.value } } : n))}
                    >
                      <option value="fault">Device failure detected</option>
                      <option value="status">Device status changed</option>
                      <option value="packet-loss">Packet loss threshold exceeded</option>
                      <option value="response-time">Response time threshold exceeded</option>
                    </select>
                    <label>Minimum severity</label>
                    <select
                      value={selected.config?.severity ?? "critical"}
                      onChange={(e) => setNodes((cur) => cur.map((n) => n.id === selected.id ? { ...n, config: { ...n.config, severity: e.target.value } } : n))}
                    >
                      <option value="critical">Critical</option>
                      <option value="warning">Warning</option>
                      <option value="any">Any</option>
                    </select>
                  </div>
                )}

                {selected.type === "logic" && (
                  <div className="field">
                    <label>Fault condition</label>
                    <textarea
                      rows={4}
                      value={selected.config?.condition ?? ""}
                      onChange={(e) => setNodes((cur) => cur.map((n) => n.id === selected.id ? { ...n, config: { ...n.config, condition: e.target.value } } : n))}
                    />
                    <small className="field-note">Available fields: status, severity, deviceName, ipAddress, packetLoss, responseTime.</small>
                  </div>
                )}

                {selected.name === "AI Message" && (
                  <div className="ai-config-panel">
                    <div className="ai-node-banner">
                      <span className="ai-node-badge"><Sparkles size={16} /></span>
                      <div>
                        <strong>AI provider</strong>
                        <small>Connect Gemini, Groq, OpenAI, Anthropic, Mistral or a custom endpoint.</small>
                      </div>
                    </div>

                    <div className="field">
                      <label>Provider</label>
                      <select
                        value={aiProvider}
                        onChange={(e) => {
                          const provider = e.target.value;
                          setAiProvider(provider);
                          setAiKeyState("");
                          setNodes((cur) => cur.map((n) => n.id === selected.id
                            ? { ...n, config: { ...n.config, provider, model: aiModels[provider] ?? "" } }
                            : n
                          ));
                        }}
                      >
                        <option>Gemini</option>
                        <option>Groq</option>
                        <option>OpenAI</option>
                        <option>Anthropic</option>
                        <option>Mistral</option>
                        <option>Custom</option>
                      </select>
                    </div>

                    <div className="ai-credential-card">
                      <div className="ai-credential-head">
                        <div className="ai-provider-mark"><Sparkles size={18} /></div>
                        <div>
                          <strong>{aiProvider} API connection</strong>
                          <small>API keys are represented in the editor; production secrets should be stored server-side.</small>
                        </div>
                      </div>

                      <label className="ai-secret-label">
                        API key
                        <div className="ai-secret-input">
                          <input
                            type="password"
                            value={aiKeys[aiProvider] ?? ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              setAiKeys((cur) => ({ ...cur, [aiProvider]: value }));
                              setAiKeyState("");
                              setNodes((cur) => cur.map((n) => n.id === selected.id
                                ? { ...n, config: { ...n.config, provider: aiProvider, hasApiKey: value ? "true" : "false" } }
                                : n
                              ));
                            }}
                            placeholder={`Paste ${aiProvider} API key`}
                            autoComplete="off"
                          />
                          <CheckCircle2 size={16} className={aiKeys[aiProvider] ? "credential-ok" : ""} />
                        </div>
                      </label>

                      <label>
                        Model
                        <input
                          value={aiModels[aiProvider] ?? ""}
                          onChange={(e) => {
                            const model = e.target.value;
                            setAiModels((cur) => ({ ...cur, [aiProvider]: model }));
                            setNodes((cur) => cur.map((n) => n.id === selected.id
                              ? { ...n, config: { ...n.config, provider: aiProvider, model } }
                              : n
                            ));
                          }}
                          placeholder="Model name"
                        />
                      </label>

                      {aiProvider === "Custom" && (
                        <label>
                          Base URL
                          <input
                            value={aiBaseUrls.Custom ?? ""}
                            onChange={(e) => setAiBaseUrls({ Custom: e.target.value })}
                            placeholder="https://your-ai-endpoint/v1"
                          />
                        </label>
                      )}

                      <button
                        type="button"
                        className="btn primary full"
                        onClick={() => setAiKeyState(aiKeys[aiProvider] ? `${aiProvider} API key added to this node.` : "Add an API key before saving this AI connection.")}
                      >
                        {aiKeys[aiProvider] ? "API key added" : "Add API key"}
                      </button>
                      {aiKeyState && <small className="field-note">{aiKeyState}</small>}
                    </div>

                    <div className="field">
                      <label>Message instruction</label>
                      <textarea
                        rows={6}
                        value={aiInstruction}
                        onChange={(e) => {
                          setAiInstruction(e.target.value);
                          setNodes((cur) => cur.map((n) => n.id === selected.id
                            ? { ...n, config: { ...n.config, instruction: e.target.value } }
                            : n
                          ));
                        }}
                      />
                    </div>

                    <div className="ai-fields">
                      <span><strong>deviceName</strong><small>affected node</small></span>
                      <span><strong>ipAddress</strong><small>network address</small></span>
                      <span><strong>severity</strong><small>fault level</small></span>
                      <span><strong>recommendation</strong><small>AI-generated action</small></span>
                    </div>

                    <div className="expr-hint ai-hint">
                      <Sparkles size={15} />
                      <div>The AI node receives the fault event and produces the message consumed by the Gmail node.</div>
                    </div>
                  </div>
                )}

                {selected.name === "Send Gmail" && (
                  <form className="credential-form" onSubmit={saveSmtp}>
                    <div className="field-note">Nodemailer / Google SMTP</div>
                    <label>SMTP host<input value="smtp.gmail.com" readOnly /></label>
                    <div className="form-grid-2">
                      <label>Port<input value="465" readOnly /></label>
                      <label>Secure<input value="true" readOnly /></label>
                    </div>
                    <label>Google / Gmail account<input type="email" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="monitoring@gmail.com" required /></label>
                    <label>Google App Password<input type="password" value={smtpAppPassword} onChange={(e) => setSmtpAppPassword(e.target.value)} placeholder="16-character app password" required /></label>
                    <label>From<input value={smtpFrom} onChange={(e) => setSmtpFrom(e.target.value)} /></label>
                    <div className="admin-recipient"><CheckCircle2 size={15} /><span>Automatic recipient: <strong>{adminEmail}</strong></span></div>
                    <label>Admin Gmail recipient<input value={smtpRecipients || adminEmail} onChange={(e) => setSmtpRecipients(e.target.value)} placeholder={adminEmail} /></label>
                    <label>Subject<input defaultValue="[Network Alert] {{$json.deviceName}} is {{$json.status}}" /></label>
                    <label>Message<textarea rows={7} defaultValue={"Network fault detected.\n\nDevice: {{$json.deviceName}}\nIP: {{$json.ipAddress}}\nStatus: {{$json.status}}\nSeverity: {{$json.severity}}\nResponse: {{$json.responseTime}} ms\nPacket loss: {{$json.packetLoss}}%\n\nPlease investigate the affected node."} /></label>
                    <button type="submit" className="btn primary full">{smtpState ? "SMTP configured" : "Save SMTP settings"}</button>
                    {smtpState && <small className="field-note">{smtpState}</small>}
                  </form>
                )}

                {selected.type === "action" && selected.name !== "Send Fault Email" && (
                  <div className="field">
                    <label>Action parameters</label>
                    <input placeholder="Network event or API configuration" />
                    <textarea rows={4} placeholder="Map values from the fault event..." />
                  </div>
                )}

                <div className="expr-hint">
                  <span>fx</span>
                  <div>Use expressions such as <code>{"{{$json.deviceName}}"}</code> and <code>{"{{$json.ipAddress}}"}</code> in notification fields.</div>
                </div>
              </>
            ) : (
              <div className="field">
                <label>Execution settings</label>
                <label className="toggle-row"><span><strong>Execute once</strong><small>Run this node once for each network event.</small></span><input type="checkbox" defaultChecked /><span className="switch" /></label>
                <label className="toggle-row"><span><strong>Retry on failure</strong><small>Retry SMTP dispatch if delivery fails.</small></span><input type="checkbox" defaultChecked /><span className="switch" /></label>
                <label className="toggle-row"><span><strong>Record execution</strong><small>Keep the event for network reports.</small></span><input type="checkbox" defaultChecked /><span className="switch" /></label>
              </div>
            )}
          </div>
          <div className="inspector-footer">
            <button type="button" className="btn ghost" onClick={closeNodeInspector}>Cancel / close</button>
            <button type="button" className="btn primary" onClick={() => { setSaveState("saving"); window.setTimeout(() => setSaveState("saved"), 500); showNotice(`${selected.name} configuration saved.`); }}>Save node</button>
          </div>
        </aside>
      )}
    </div>
  );

  const renderPage = () => {
    if (activeSection === "Workflows") return renderWorkflow();

    if (activeSection === "Devices") {
      return <section className="section-panel"><div className="section-panel-inner wide-panel">
        <div className="section-heading-row">
          <div><span className="overline">NETWORK / DEVICES</span><h1>Registered devices</h1><p>Administrators add network nodes here. IP address is required; subnet mask and MAC address are optional.</p></div>
          <button className="btn primary" onClick={() => setDeviceFormOpen(true)}><Plus size={16} /> Add device</button>
        </div>

        <div className="device-registry">
          {devices.map((d) => <article className="device-row" key={d.ip}>
            <div className="device-node-icon"><DeviceGlyph type={d.type} size={24} /></div>
            <div className="device-main"><strong>{d.name}</strong><small>{d.ip}</small></div>
            <div className="device-meta"><span>Subnet</span><strong>{d.subnet || "Not set"}</strong></div>
            <div className="device-meta"><span>MAC</span><strong>{d.mac || "Not set"}</strong></div>
            <div className={`device-status ${d.status.toLowerCase()}`}><span />{d.status}</div>
            <button className="icon-btn danger" title="Remove device" onClick={() => removeDevice(d.ip)}><Trash2 size={16} /></button>
          </article>)}
        </div>

        {deviceFormOpen && <div className="modal-backdrop" onMouseDown={() => setDeviceFormOpen(false)}>
          <div className="device-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head"><div><span className="overline">NETWORK / DEVICE</span><h2>Add monitoring node</h2></div><button className="icon-btn" onClick={() => setDeviceFormOpen(false)}><X size={18} /></button></div>
            <form className="credential-form" onSubmit={addDevice}>
              <label>Device name<input value={deviceForm.name} onChange={(e) => setDeviceForm((v) => ({ ...v, name: e.target.value }))} placeholder="Core Router" required /></label>
              <div className="form-grid-2">
                <label>IP address<input value={deviceForm.ip} onChange={(e) => setDeviceForm((v) => ({ ...v, ip: e.target.value }))} placeholder="192.168.1.1" required /></label>
                <label>Device type<select value={deviceForm.type} onChange={(e) => setDeviceForm((v) => ({ ...v, type: e.target.value }))}><option value="router">Router / AP</option><option value="switch">Switch</option><option value="server">Server</option></select></label>
              </div>
              <div className="form-grid-2">
                <label>Subnet mask <span className="optional">(optional)</span><input value={deviceForm.subnet} onChange={(e) => setDeviceForm((v) => ({ ...v, subnet: e.target.value }))} placeholder="255.255.255.0" /></label>
                <label>MAC address <span className="optional">(optional)</span><input value={deviceForm.mac} onChange={(e) => setDeviceForm((v) => ({ ...v, mac: e.target.value }))} placeholder="00:1B:44:11:3A:B7" /></label>
              </div>
              <div className="database-choice"><strong><Network size={16} /> Workflow node</strong><span>This device becomes available to monitoring and network fault automation.</span></div>
              <button className="btn primary full" type="submit"><Plus size={16} /> Add device to network</button>
            </form>
          </div>
        </div>}
      </div></section>;
    }

    if (activeSection === "Alerts") {
      const active = devices.filter((d) => d.status !== "Online");
      return <section className="section-panel"><div className="section-panel-inner wide-panel">
        <span className="overline">NETWORK / ALERTS</span><h1>Fault notifications</h1>
        <p>Events generated by the monitoring workflow and dispatched through the configured email node.</p>
        {active.map((d) => <article className="dashboard-integration-card" key={d.ip}><div className="dashboard-integration-icon">!</div><div><strong>{d.name} — {d.status}</strong><small>{d.ip}</small><p>Workflow: Network Fault → AI Message → Gmail</p></div></article>)}
        {!active.length && <p>No active faults.</p>}
      </div></section>;
    }

    if (activeSection === "Executions") {
      return <section className="section-panel"><div className="section-panel-inner wide-panel">
        <span className="overline">AUTOMATION / EXECUTIONS</span><h1>Workflow executions</h1>
        <p>Monitor each network event as it moves through detection, condition checks and notification dispatch.</p>
        <div className="dashboard-integration-grid">
          {executionHistory.length ? executionHistory.map((run, i) => (
            <article className="dashboard-integration-card" key={run.id}>
              <div className="dashboard-integration-icon">{String(i + 1).padStart(2, "0")}</div>
              <div><strong>{run.status} · {run.time}</strong><small>{run.detail}</small><p>Network Fault → Check Severity → AI Message → Send Gmail</p></div>
            </article>
          )) : <article className="dashboard-integration-card"><div className="dashboard-integration-icon">—</div><div><strong>No executions yet</strong><small>Run Test workflow from the header.</small><p>Your workflow test history will appear here.</p></div></article>}
        </div>
      </div></section>;
    }

    if (activeSection === "Settings") {
      return <section className="section-panel"><div className="section-panel-inner api-panel">
        <span className="overline">NETWORK / SETTINGS</span><h1>Monitoring and notification settings</h1>
        <p>Configure thresholds used by network events and the notification workflow.</p>
        <div className="credential-form">
          <label>Polling interval<select value={settingsState.pollingInterval} onChange={(e) => setSettingsState((v) => ({ ...v, pollingInterval: e.target.value }))}><option value="15">15 seconds</option><option value="30">30 seconds</option><option value="60">60 seconds</option></select></label>
          <label>Failure threshold<select value={settingsState.failureThreshold} onChange={(e) => setSettingsState((v) => ({ ...v, failureThreshold: e.target.value }))}><option value="2">2 missed responses</option><option value="3">3 missed responses</option><option value="5">5 missed responses</option></select></label>
          <label>Default notification workflow<input value={workflowName} onChange={(e) => setWorkflowName(e.target.value)} /></label>
          <button className="btn primary" type="button" onClick={() => showNotice("Monitoring settings saved.")}>Save monitoring settings</button>
          <div className="database-choice"><strong>Google SMTP / Nodemailer</strong><span>The workflow sends the AI-generated message to the authenticated administrator Gmail. Google App Passwords and AI API keys must be stored server-side.</span></div>
        </div>
      </div></section>;
    }

    return <section className="section-panel"><div className="section-panel-inner wide-panel">
      <span className="overline">NETWORK / OVERVIEW</span><h1>Network automation workspace</h1>
      <p>Build event-driven automations for device failures, diagnosis and administrator notifications.</p>
      <button className="header-button section-action" onClick={() => setActiveSection("Workflows")}>Open automation canvas</button>
    </div></section>;
  };

  /* ---------------- entry screens ---------------- */
  if (entryStage !== "editor") {
    const step = entryStage === "login" ? "01 / ACCESS" : entryStage === "organization" ? "02 / ORGANIZATION" : "03 / DATA CONNECTION";
    return (
      <main className="entry-shell">
        <div className="entry-brand"><span className="softcape-logo">S</span><span>softcape</span></div>
        <div className="entry-frame">
          <div className="entry-aside">
            <span className="overline">NETWORK AUTOMATION</span>
            <h1>Monitor the network. Automate the response.</h1>
            <p>Detect failures, evaluate fault conditions and dispatch notifications through workflow automation.</p>
            <div className="entry-aside-line" />
            <small>Private by design. Your organization owns its data connections.</small>
          </div>
          <section className="entry-card">
            <span className="overline">{step}</span>
            {entryStage === "login" && <>
              <h2>Welcome back</h2><p className="entry-lede">Sign in to your Softcape workspace.</p>
              <form className="entry-form" onSubmit={login}>
                <label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required /></label>
                <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required /></label>
                {entryError && <div className="entry-error">{entryError}</div>}
                <button className="entry-submit" type="submit" disabled={entryBusy}>{entryBusy ? "Signing in..." : "Continue"}<span>{"->"}</span></button>
              </form>
              <div className="entry-foot">New to Softcape? <button type="button" onClick={() => { setEntryStage("organization"); setEntryError(""); }}>Create an organization</button></div>
            </>}
            {entryStage === "organization" && <>
              <h2>Create your organization</h2><p className="entry-lede">Your organization is the boundary for members, workflows, credentials, and data.</p>
              <form className="entry-form" onSubmit={createOrganization}>
                <label>Organization name<input value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} placeholder="Acme Ltd" required /></label>
                <div className="owner-section"><span className="owner-section-title">System owner</span><p>This account will manage members, credentials, and organization access.</p>
                  <label>Your name<input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Maya Chen" required /></label>
                  <label>Owner email<input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="you@company.com" required /></label>
                  <label>Create password<input type="password" minLength={8} value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} placeholder="At least 8 characters" required /></label>
                  <label>Confirm password<input type="password" minLength={8} value={confirmOwnerPassword} onChange={(e) => setConfirmOwnerPassword(e.target.value)} placeholder="Repeat your password" required /></label>
                </div>
                {entryError && <div className="entry-error">{entryError}</div>}
                <button className="entry-submit" type="submit" disabled={entryBusy}>{entryBusy ? "Creating owner account..." : "Create organization and owner"}<span>{"->"}</span></button>
              </form>
              <button className="back-link" type="button" onClick={() => setEntryStage("login")}>Back to sign in</button>
            </>}
            {entryStage === "database" && <>
              <h2>Connect your database</h2><p className="entry-lede">Softcape stores authentication centrally. Your workflows and organization data stay in this database.</p>
              <form className="entry-form" onSubmit={connectOrganizationDatabase}>
                <label>Organization database URL<input type="text" value={organizationDbUrl} onChange={(e) => setOrganizationDbUrl(e.target.value)} placeholder="file:./organization.db" required /></label>
                <div className="database-choice"><strong>SQLite is ready to use</strong><span>Use <code>file:</code> for local SQLite, or enter a <code>postgres://</code> or <code>mysql://</code> connection.</span></div>
                {entryError && <div className="entry-error">{entryError}</div>}
                <button className="entry-submit" type="submit" disabled={entryBusy}>{entryBusy ? "Connecting..." : "Connect and open workspace"}<span>{"->"}</span></button>
              </form>
              <button className="back-link" type="button" onClick={() => setEntryStage("organization")}>Back to organization</button>
            </>}
          </section>
        </div>
      </main>
    );
  }

  return (
    <>
      <style jsx global>{`
        .wf-node-compact {
          position: absolute;
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          overflow: visible !important;
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: grab;
          z-index: 3;
          user-select: none;
        }
        .wf-node-compact:active { cursor: grabbing; }

        .wf-node-surface {
          position: relative;
          width: 100%;
          height: 100%;
          border: 2px solid var(--border, rgba(148,163,184,.45));
          background: var(--panel, #242424);
          box-shadow: 0 10px 26px rgba(0,0,0,.18), inset 0 0 0 1px rgba(255,255,255,.025);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease, background .16s ease;
        }
        .wf-node-card .wf-node-surface {
          border-radius: 12px 12px 18px 18px;
        }
        .wf-node-agent .wf-node-surface {
          border-radius: 10px;
          justify-content: flex-start;
          padding: 0 28px;
          gap: 18px;
        }
        .wf-node-compact:hover .wf-node-surface,
        .wf-node-compact.selected .wf-node-surface {
          transform: translateY(-2px);
          border-color: var(--primary, #2563eb);
          box-shadow: 0 0 0 5px rgba(37,99,235,.10), 0 16px 34px rgba(0,0,0,.24);
        }
        .wf-node-icon {
          width: 58px !important;
          height: 58px !important;
          border-radius: 12px;
          background: transparent !important;
          border: 0 !important;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--foreground, currentColor);
        }
        .wf-node-card.type-trigger .wf-node-icon { color: #14b8a6; }
        .wf-node-card.type-logic .wf-node-icon { color: #22c55e; }
        .wf-node-card.type-action .wf-node-icon { color: #38bdf8; }
        .wf-node-agent .wf-node-icon { color: var(--foreground, #fff); flex: 0 0 auto; }
        .wf-node-agent-copy strong, .wf-node-agent-copy small { display: block; }
        .wf-node-agent-copy strong { font-size: 16px; letter-spacing: -.01em; }
        .wf-node-agent-copy small { margin-top: 5px; opacity: .55; font-size: 11px; }
        .wf-node-ports {
          position: absolute;
          left: 34px;
          right: 34px;
          bottom: -20px;
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: var(--muted-foreground, #94a3b8);
          pointer-events: none;
        }
        .wf-node-compact .handle {
          position: absolute;
          width: 11px;
          height: 11px;
          border-radius: 50%;
          border: 2px solid var(--background, #fff);
          background: var(--muted-foreground, #94a3b8);
          z-index: 8;
        }
        .wf-node-compact .handle-in { left: -5px; top: calc(50% - 5px); }
        .wf-node-compact .handle-out { right: -5px; top: calc(50% - 5px); }
        .wf-node-agent .handle-in { left: -5px; }
        .wf-node-agent .handle-out { right: -5px; }

        .wf-node-label {
          margin-top: 10px;
          max-width: 130px;
          text-align: center;
          font-size: 12px;
          font-weight: 650;
          line-height: 1.25;
          color: var(--foreground, currentColor);
          pointer-events: none;
        }

        .wf-node-hover-card {
          position: absolute;
          left: 50%;
          bottom: calc(100% + 15px);
          transform: translateX(-50%) translateY(5px);
          width: 245px;
          padding: 12px;
          border: 1px solid var(--border, rgba(148,163,184,.25));
          border-radius: 12px;
          background: var(--panel, rgba(15,23,42,.97));
          color: var(--foreground, #fff);
          box-shadow: 0 18px 45px rgba(0,0,0,.30);
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transition: opacity .15s ease, transform .15s ease;
          z-index: 60;
        }
        .wf-node-compact:hover .wf-node-hover-card {
          opacity: 1;
          visibility: visible;
          transform: translateX(-50%) translateY(0);
        }
        .wf-node-hover-top { display: flex; gap: 9px; align-items: center; }
        .wf-node-hover-icon {
          width: 34px; height: 34px; border-radius: 9px;
          display: grid; place-items: center;
          background: rgba(37,99,235,.13);
        }
        .wf-node-hover-card strong, .wf-node-hover-card small { display: block; }
        .wf-node-hover-card small { margin-top: 2px; opacity: .58; font-size: 10px; }
        .wf-node-hover-card p { margin: 9px 0 0; font-size: 11px; line-height: 1.45; opacity: .76; }
        .wf-node-hover-meta { display: block; margin-top: 8px; font-size: 10px; opacity: .65; }

        .node-delete-compact {
          position: absolute !important;
          top: -9px;
          right: -9px;
          opacity: 0;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          z-index: 20;
        }
        .wf-node-compact:hover .node-delete-compact,
        .wf-node-compact.selected .node-delete-compact { opacity: .75; }
        .quick-add-compact {
          position: absolute !important;
          right: -11px;
          bottom: -11px;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          z-index: 20;
        }

        .wf-support-node {
          position: absolute;
          width: 96px;
          height: 96px;
          border-radius: 50%;
          border: 2px solid var(--border, rgba(148,163,184,.45));
          background: var(--panel, #242424);
          color: var(--foreground, currentColor);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          box-shadow: 0 10px 28px rgba(0,0,0,.18);
          cursor: pointer;
          z-index: 4;
          transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease;
        }
        .wf-support-node:hover {
          transform: translateY(-3px);
          border-color: var(--primary, #2563eb);
          box-shadow: 0 0 0 5px rgba(37,99,235,.10), 0 15px 30px rgba(0,0,0,.22);
        }
        .wf-support-node > span { display: grid; place-items: center; opacity: .92; }
        .wf-support-node strong { font-size: 10px; font-weight: 700; }
        .wf-support-node small { font-size: 9px; opacity: .55; }
        .wf-support-ai { left: 800px; top: 345px; }
        .wf-support-mail { left: 1110px; top: 345px; }
        .wf-support-device { left: 105px; top: 345px; }
        .wf-support-connection {
          position: absolute;
          height: 1px;
          border-top: 2px dashed var(--muted-foreground, rgba(148,163,184,.48));
          transform-origin: left center;
          opacity: .7;
          z-index: 1;
          pointer-events: none;
        }
        .ai-support-line { width: 145px; left: 735px; top: 315px; transform: rotate(18deg); }
        .smtp-support-line { width: 145px; left: 1038px; top: 315px; transform: rotate(20deg); }
        .device-support-line { width: 105px; left: 160px; top: 315px; transform: rotate(-18deg); }

        .wf-node-pulse {
          position: absolute;
          inset: -8px;
          border-radius: 10px;
          border: 2px solid var(--primary, #2563eb);
          animation: network-node-pulse 1.35s ease-out infinite;
          pointer-events: none;
        }
        .wf-node-card .wf-node-pulse { border-radius: 14px; }
        .wf-node-agent .wf-node-pulse { border-radius: 12px; }
        @keyframes network-node-pulse {
          0% { transform: scale(.97); opacity: .72; }
          100% { transform: scale(1.04); opacity: 0; }
        }

        .network-theme-dark { color-scheme: dark; }
        .network-theme-light { color-scheme: light; }
        .network-theme-light .canvas {
          background-color: var(--background, #f7f8fa);
          background-image: radial-gradient(circle, rgba(100,116,139,.25) 1px, transparent 1px);
          background-size: 24px 24px;
        }
        .network-theme-light .canvas::before {
          opacity: .55;
        }
        .network-theme-light .wf-node-surface,
        .network-theme-light .wf-support-node {
          box-shadow: 0 8px 24px rgba(15,23,42,.10), inset 0 0 0 1px rgba(255,255,255,.55);
        }
        .network-theme-light .wf-node-hover-card {
          box-shadow: 0 18px 45px rgba(15,23,42,.16);
        }
        .theme-toggle { min-width: 82px; justify-content: center; gap: 6px; }

        .ai-credential-card {
          margin: 12px 0 16px;
          padding: 13px;
          border: 1px solid rgba(148,163,184,.2);
          border-radius: 12px;
          background: rgba(127,127,127,.055);
        }
        .ai-credential-head { display: flex; gap: 10px; align-items: center; margin-bottom: 13px; }
        .ai-provider-mark {
          width: 36px; height: 36px; border-radius: 10px;
          display: grid; place-items: center;
          background: rgba(37,99,235,.13);
        }
        .ai-credential-head strong, .ai-credential-head small { display: block; }
        .ai-credential-head small { margin-top: 3px; font-size: 10px; line-height: 1.35; opacity: .6; }
        .ai-secret-label { display: block; }
        .ai-secret-input { display: flex; align-items: center; gap: 7px; }
        .ai-secret-input input { flex: 1; }
        .credential-ok { opacity: .9; }
        /* ================================================================
           WHOLE DASHBOARD THEME
           The mode switch applies to the complete authenticated workspace:
           rail, header, tabs, panels, forms, canvas, inspector, modals,
           cards, controls and workflow nodes.
        ================================================================ */
        .app-shell.network-theme-dark {
          --network-bg: #111315;
          --network-surface: #17191c;
          --network-surface-2: #1d2024;
          --network-surface-3: #24282d;
          --network-border: #30353c;
          --network-border-strong: #424954;
          --network-text: #f3f5f7;
          --network-text-2: #c3c8cf;
          --network-muted: #8d949d;
          --network-canvas: #111315;
          --network-canvas-dot: rgba(255,255,255,.14);
          --network-input: #121417;
          --network-hover: rgba(255,255,255,.055);
          --network-active: rgba(37,99,235,.13);
          --network-shadow: 0 16px 45px rgba(0,0,0,.30);
          --network-shadow-soft: 0 8px 25px rgba(0,0,0,.18);
          color-scheme: dark;
        }

        .app-shell.network-theme-light {
          --network-bg: #f5f7fa;
          --network-surface: #ffffff;
          --network-surface-2: #f8fafc;
          --network-surface-3: #eef2f6;
          --network-border: #d8dee7;
          --network-border-strong: #b9c2ce;
          --network-text: #17202a;
          --network-text-2: #4b5563;
          --network-muted: #6b7280;
          --network-canvas: #f7f9fb;
          --network-canvas-dot: rgba(71,85,105,.22);
          --network-input: #ffffff;
          --network-hover: rgba(15,23,42,.045);
          --network-active: rgba(37,99,235,.09);
          --network-shadow: 0 16px 45px rgba(15,23,42,.12);
          --network-shadow-soft: 0 8px 25px rgba(15,23,42,.08);
          color-scheme: light;
        }

        .app-shell.network-theme-dark,
        .app-shell.network-theme-light {
          background: var(--network-bg) !important;
          color: var(--network-text) !important;
          min-height: 100vh;
          transition: background-color .2s ease, color .2s ease;
        }

        .app-shell.network-theme-dark *,
        .app-shell.network-theme-light * {
          scrollbar-color: var(--network-border-strong) transparent;
        }

        /* Left navigation */
        .app-shell.network-theme-dark .app-rail,
        .app-shell.network-theme-light .app-rail {
          background: var(--network-surface) !important;
          border-right: 1px solid var(--network-border) !important;
          color: var(--network-text) !important;
          transition: background-color .2s ease, border-color .2s ease;
        }
        .app-shell.network-theme-dark .rail-item,
        .app-shell.network-theme-light .rail-item {
          color: var(--network-muted) !important;
          border-color: transparent !important;
          background: transparent !important;
        }
        .app-shell.network-theme-dark .rail-item:hover,
        .app-shell.network-theme-light .rail-item:hover {
          color: var(--network-text) !important;
          background: var(--network-hover) !important;
        }
        .app-shell.network-theme-dark .rail-item.active,
        .app-shell.network-theme-light .rail-item.active {
          color: var(--primary, #2563eb) !important;
          background: var(--network-active) !important;
        }
        .app-shell.network-theme-dark .rail-user,
        .app-shell.network-theme-light .rail-user {
          background: var(--network-surface-3) !important;
          border: 1px solid var(--network-border) !important;
          color: var(--network-text) !important;
        }

        /* Main header + tabs */
        .app-shell.network-theme-dark .editor-main,
        .app-shell.network-theme-light .editor-main {
          background: var(--network-bg) !important;
          color: var(--network-text) !important;
        }
        .app-shell.network-theme-dark .editor-header,
        .app-shell.network-theme-light .editor-header {
          background: var(--network-surface) !important;
          border-bottom: 1px solid var(--network-border) !important;
          color: var(--network-text) !important;
        }
        .app-shell.network-theme-dark .editor-tabs,
        .app-shell.network-theme-light .editor-tabs {
          background: var(--network-surface) !important;
          border-bottom: 1px solid var(--network-border) !important;
        }
        .app-shell.network-theme-dark .editor-tab,
        .app-shell.network-theme-light .editor-tab {
          color: var(--network-muted) !important;
          background: transparent !important;
          border-color: transparent !important;
        }
        .app-shell.network-theme-dark .editor-tab:hover,
        .app-shell.network-theme-light .editor-tab:hover {
          color: var(--network-text) !important;
        }
        .app-shell.network-theme-dark .editor-tab.active,
        .app-shell.network-theme-light .editor-tab.active {
          color: var(--network-text) !important;
          border-bottom-color: var(--primary, #2563eb) !important;
        }
        .app-shell.network-theme-dark .crumb,
        .app-shell.network-theme-light .crumb,
        .app-shell.network-theme-dark .save-state,
        .app-shell.network-theme-light .save-state {
          color: var(--network-muted) !important;
        }
        .app-shell.network-theme-dark .wf-name-input,
        .app-shell.network-theme-light .wf-name-input {
          color: var(--network-text) !important;
          background: transparent !important;
        }

        /* Generic controls */
        .app-shell.network-theme-dark .btn.ghost,
        .app-shell.network-theme-light .btn.ghost,
        .app-shell.network-theme-dark .icon-btn,
        .app-shell.network-theme-light .icon-btn,
        .app-shell.network-theme-dark .reopen-library,
        .app-shell.network-theme-light .reopen-library {
          color: var(--network-text-2) !important;
          background: var(--network-surface) !important;
          border-color: var(--network-border) !important;
        }
        .app-shell.network-theme-dark .btn.ghost:hover,
        .app-shell.network-theme-light .btn.ghost:hover,
        .app-shell.network-theme-dark .icon-btn:hover,
        .app-shell.network-theme-light .icon-btn:hover,
        .app-shell.network-theme-dark .reopen-library:hover,
        .app-shell.network-theme-light .reopen-library:hover {
          color: var(--network-text) !important;
          background: var(--network-hover) !important;
          border-color: var(--network-border-strong) !important;
        }
        .app-shell.network-theme-dark .btn.primary,
        .app-shell.network-theme-light .btn.primary {
          color: #fff !important;
        }

        /* Workflow workspace */
        .app-shell.network-theme-dark .editor-body,
        .app-shell.network-theme-light .editor-body {
          background: var(--network-bg) !important;
        }
        .app-shell.network-theme-dark .nodes-panel,
        .app-shell.network-theme-light .nodes-panel,
        .app-shell.network-theme-dark .inspector {
          background: var(--network-surface) !important;
          border-color: var(--network-border) !important;
          color: var(--network-text) !important;
        }
        .app-shell.network-theme-light .inspector {
          background: var(--network-surface) !important;
          border-color: var(--network-border) !important;
          color: var(--network-text) !important;
        }
        .app-shell.network-theme-dark .nodes-panel-head,
        .app-shell.network-theme-light .nodes-panel-head,
        .app-shell.network-theme-dark .inspector-head,
        .app-shell.network-theme-light .inspector-head {
          border-color: var(--network-border) !important;
          background: var(--network-surface) !important;
        }
        .app-shell.network-theme-dark .nodes-panel-body,
        .app-shell.network-theme-light .nodes-panel-body,
        .app-shell.network-theme-dark .inspector-body,
        .app-shell.network-theme-light .inspector-body {
          color: var(--network-text) !important;
        }
        .app-shell.network-theme-dark .nodes-search input,
        .app-shell.network-theme-light .nodes-search input,
        .app-shell.network-theme-dark .field input,
        .app-shell.network-theme-light .field input,
        .app-shell.network-theme-dark .field select,
        .app-shell.network-theme-light .field select,
        .app-shell.network-theme-dark .field textarea,
        .app-shell.network-theme-light .field textarea {
          color: var(--network-text) !important;
          background: var(--network-input) !important;
          border-color: var(--network-border) !important;
        }
        .app-shell.network-theme-dark input::placeholder,
        .app-shell.network-theme-light input::placeholder,
        .app-shell.network-theme-dark textarea::placeholder,
        .app-shell.network-theme-light textarea::placeholder {
          color: var(--network-muted) !important;
        }
        .app-shell.network-theme-dark .node-item,
        .app-shell.network-theme-light .node-item {
          color: var(--network-text-2) !important;
          background: transparent !important;
          border-color: transparent !important;
        }
        .app-shell.network-theme-dark .node-item:hover,
        .app-shell.network-theme-light .node-item:hover {
          color: var(--network-text) !important;
          background: var(--network-hover) !important;
        }
        .app-shell.network-theme-dark .nodes-section-title,
        .app-shell.network-theme-light .nodes-section-title,
        .app-shell.network-theme-dark .field-note,
        .app-shell.network-theme-light .field-note,
        .app-shell.network-theme-dark .expr-hint,
        .app-shell.network-theme-light .expr-hint {
          color: var(--network-muted) !important;
        }
        .app-shell.network-theme-dark .inspector-tabs,
        .app-shell.network-theme-light .inspector-tabs {
          border-color: var(--network-border) !important;
        }
        .app-shell.network-theme-dark .inspector-tabs button,
        .app-shell.network-theme-light .inspector-tabs button {
          color: var(--network-muted) !important;
          background: transparent !important;
        }
        .app-shell.network-theme-dark .inspector-tabs button.active,
        .app-shell.network-theme-light .inspector-tabs button.active {
          color: var(--network-text) !important;
        }

        /* Canvas */
        .app-shell.network-theme-dark .canvas,
        .app-shell.network-theme-light .canvas {
          background-color: var(--network-canvas) !important;
          background-image: radial-gradient(circle, var(--network-canvas-dot) 1px, transparent 1px) !important;
          background-size: 24px 24px !important;
        }
        .app-shell.network-theme-dark .canvas::before,
        .app-shell.network-theme-light .canvas::before {
          opacity: .55;
        }
        .app-shell.network-theme-dark .canvas-controls,
        .app-shell.network-theme-light .canvas-controls,
        .app-shell.network-theme-dark .canvas-workflow-badge,
        .app-shell.network-theme-light .canvas-workflow-badge,
        .app-shell.network-theme-dark .canvas-hint,
        .app-shell.network-theme-light .canvas-hint {
          color: var(--network-text-2) !important;
          background: var(--network-surface) !important;
          border-color: var(--network-border) !important;
          box-shadow: var(--network-shadow-soft) !important;
        }
        .app-shell.network-theme-dark .zoom-readout,
        .app-shell.network-theme-light .zoom-readout {
          color: var(--network-text) !important;
        }

        /* Workflow nodes + hover cards */
        .app-shell.network-theme-dark .wf-node-surface,
        .app-shell.network-theme-light .wf-node-surface,
        .app-shell.network-theme-dark .wf-support-node,
        .app-shell.network-theme-light .wf-support-node {
          background: var(--network-surface-2) !important;
          border-color: var(--network-border-strong) !important;
          color: var(--network-text) !important;
        }
        .app-shell.network-theme-dark .wf-node-compact.selected .wf-node-surface,
        .app-shell.network-theme-light .wf-node-compact.selected .wf-node-surface {
          border-color: var(--primary, #2563eb) !important;
        }
        .app-shell.network-theme-dark .wf-node-hover-card,
        .app-shell.network-theme-light .wf-node-hover-card {
          background: var(--network-surface) !important;
          border-color: var(--network-border) !important;
          color: var(--network-text) !important;
          box-shadow: var(--network-shadow) !important;
        }
        .app-shell.network-theme-dark .wf-node-label,
        .app-shell.network-theme-light .wf-node-label,
        .app-shell.network-theme-dark .wf-node-agent-copy strong,
        .app-shell.network-theme-light .wf-node-agent-copy strong {
          color: var(--network-text) !important;
        }
        .app-shell.network-theme-dark .wf-node-agent-copy small,
        .app-shell.network-theme-light .wf-node-agent-copy small,
        .app-shell.network-theme-dark .wf-node-hover-card small,
        .app-shell.network-theme-light .wf-node-hover-card small,
        .app-shell.network-theme-dark .wf-node-hover-card p,
        .app-shell.network-theme-light .wf-node-hover-card p {
          color: var(--network-text-2) !important;
        }
        .app-shell.network-theme-dark .wf-support-node small,
        .app-shell.network-theme-light .wf-support-node small {
          color: var(--network-muted) !important;
        }
        .app-shell.network-theme-dark .wf-support-connection,
        .app-shell.network-theme-light .wf-support-connection {
          border-color: var(--network-border-strong) !important;
        }

        /* Dashboard pages: Overview, Devices, Alerts, Executions, Settings */
        .app-shell.network-theme-dark .section-panel,
        .app-shell.network-theme-light .section-panel {
          background: var(--network-bg) !important;
          color: var(--network-text) !important;
        }
        .app-shell.network-theme-dark .section-panel-inner,
        .app-shell.network-theme-light .section-panel-inner {
          color: var(--network-text) !important;
        }
        .app-shell.network-theme-dark .section-panel-inner h1,
        .app-shell.network-theme-light .section-panel-inner h1,
        .app-shell.network-theme-dark .section-panel-inner h2,
        .app-shell.network-theme-light .section-panel-inner h2,
        .app-shell.network-theme-dark .section-panel-inner strong,
        .app-shell.network-theme-light .section-panel-inner strong {
          color: var(--network-text) !important;
        }
        .app-shell.network-theme-dark .section-panel-inner p,
        .app-shell.network-theme-light .section-panel-inner p,
        .app-shell.network-theme-dark .section-panel-inner small,
        .app-shell.network-theme-light .section-panel-inner small {
          color: var(--network-text-2) !important;
        }
        .app-shell.network-theme-dark .device-registry,
        .app-shell.network-theme-light .device-registry,
        .app-shell.network-theme-dark .device-row,
        .app-shell.network-theme-light .device-row,
        .app-shell.network-theme-dark .dashboard-integration-card,
        .app-shell.network-theme-light .dashboard-integration-card {
          background: var(--network-surface) !important;
          border-color: var(--network-border) !important;
          color: var(--network-text) !important;
          box-shadow: none;
        }
        .app-shell.network-theme-dark .device-row:hover,
        .app-shell.network-theme-light .device-row:hover,
        .app-shell.network-theme-dark .dashboard-integration-card:hover,
        .app-shell.network-theme-light .dashboard-integration-card:hover {
          background: var(--network-surface-2) !important;
          border-color: var(--network-border-strong) !important;
        }
        .app-shell.network-theme-dark .device-meta span,
        .app-shell.network-theme-light .device-meta span,
        .app-shell.network-theme-dark .device-meta strong,
        .app-shell.network-theme-light .device-meta strong {
          color: var(--network-text-2) !important;
        }
        .app-shell.network-theme-dark .device-main strong,
        .app-shell.network-theme-light .device-main strong,
        .app-shell.network-theme-dark .device-main small,
        .app-shell.network-theme-light .device-main small {
          color: var(--network-text) !important;
        }

        /* AI/API credential area */
        .app-shell.network-theme-dark .ai-node-banner,
        .app-shell.network-theme-light .ai-node-banner,
        .app-shell.network-theme-dark .ai-credential-card,
        .app-shell.network-theme-light .ai-credential-card,
        .app-shell.network-theme-dark .database-choice,
        .app-shell.network-theme-light .database-choice {
          background: var(--network-surface-2) !important;
          border-color: var(--network-border) !important;
          color: var(--network-text) !important;
        }
        .app-shell.network-theme-dark .ai-credential-card span,
        .app-shell.network-theme-light .ai-credential-card span,
        .app-shell.network-theme-dark .database-choice span,
        .app-shell.network-theme-light .database-choice span {
          color: var(--network-text-2) !important;
        }

        /* Modals */
        .app-shell.network-theme-dark .modal-backdrop,
        .app-shell.network-theme-light .modal-backdrop {
          background: rgba(2,6,23,.55) !important;
          backdrop-filter: blur(4px);
        }
        .app-shell.network-theme-dark .device-modal,
        .app-shell.network-theme-light .device-modal {
          background: var(--network-surface) !important;
          color: var(--network-text) !important;
          border-color: var(--network-border) !important;
          box-shadow: var(--network-shadow) !important;
        }
        .app-shell.network-theme-dark .device-modal input,
        .app-shell.network-theme-light .device-modal input,
        .app-shell.network-theme-dark .device-modal select,
        .app-shell.network-theme-light .device-modal select {
          background: var(--network-input) !important;
          color: var(--network-text) !important;
          border-color: var(--network-border) !important;
        }

        .inspector-footer {
          display: flex;
          gap: 8px;
          padding: 12px 14px;
          border-top: 1px solid var(--network-border, rgba(148,163,184,.2));
          background: var(--network-surface, #17191c);
          position: sticky;
          bottom: 0;
        }
        .inspector-footer .btn { flex: 1; justify-content: center; }
        .ui-notice {
          position: fixed;
          right: 22px;
          bottom: 22px;
          z-index: 200;
          padding: 11px 14px;
          border: 1px solid var(--network-border, rgba(148,163,184,.25));
          border-radius: 10px;
          background: var(--network-surface, #17191c);
          color: var(--network-text, #f3f5f7);
          box-shadow: var(--network-shadow, 0 16px 45px rgba(0,0,0,.3));
          font-size: 12px;
        }
        .reopen-library { display: inline-flex; align-items: center; gap: 7px; }

        /* Theme button */
        .app-shell.network-theme-dark .theme-toggle,
        .app-shell.network-theme-light .theme-toggle {
          min-width: 88px;
        }

        /* Make the transition apply to the complete dashboard without touching auth */
        .app-shell.network-theme-dark,
        .app-shell.network-theme-light,
        .app-shell.network-theme-dark .app-rail,
        .app-shell.network-theme-light .app-rail,
        .app-shell.network-theme-dark .editor-header,
        .app-shell.network-theme-light .editor-header,
        .app-shell.network-theme-dark .editor-tabs,
        .app-shell.network-theme-light .editor-tabs,
        .app-shell.network-theme-dark .nodes-panel,
        .app-shell.network-theme-light .nodes-panel,
        .app-shell.network-theme-dark .inspector,
        .app-shell.network-theme-light .inspector,
        .app-shell.network-theme-dark .section-panel,
        .app-shell.network-theme-light .section-panel {
          transition: background-color .2s ease, border-color .2s ease, color .2s ease;
        }
      `}</style>
      <div className={`app-shell network-theme-${theme}`}>
      {uiNotice && <div className="ui-notice" role="status">{uiNotice}</div>}
      <aside className="app-rail">
        <div className="rail-brand"><div className="softcape-logo">S</div></div>
        <nav className="rail-nav">
          {([
            ["Overview", "overview"], ["Workflows", "workflow"], ["Executions", "execution"], ["Devices", "devices"], ["Alerts", "alerts"], ["Settings", "settings"],
          ] as [EditorSection, string][]).map(([section, icon]) => (
            <button key={section} className={`rail-item ${activeSection === section ? "active" : ""}`} onClick={() => setActiveSection(section)} title={section}>
  <span>{icon === "overview" ? <Activity size={18} /> : icon === "workflow" ? <Workflow size={18} /> : icon === "execution" ? <Zap size={18} /> : icon === "devices" ? <Network size={18} /> : icon === "alerts" ? <Bell size={18} /> : <Settings size={18} />}</span>
</button>
          ))}
        </nav>
        <div className="rail-spacer" />
        <button className="rail-item" title="Help"><span><CircleHelp size={18} /></span></button>
        <div className="rail-user" title={currentUser.email || "Owner"}>{(currentUser.name || "Owner").split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}</div>
      </aside>

      <main className="editor-main">
        <header className="editor-header">
          <div className="header-left">
            <div className="crumb"><span>{organizationName || "Organization"}</span><span className="crumb-sep">/</span><span>Network Automation</span></div>
            <div className="wf-title-row">
              <input className="wf-name-input" value={workflowName} onChange={(e) => setWorkflowName(e.target.value)} spellCheck={false} />
              <span className={`save-state ${saveState}`}><i />{saveState === "saved" ? "Saved" : "Saving…"}</span>
            </div>
          </div>
          <div className="header-actions">
            <button className="btn ghost theme-toggle" onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
              {theme === "dark" ? <Globe2 size={15} /> : <Zap size={15} />}
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            <button className="btn ghost" onClick={() => setActiveSection("Devices")}>Devices</button>
            <button className={`btn ghost ${published ? "is-published" : ""}`} onClick={() => setPublished(!published)}>{published ? "● Published" : "Publish"}</button>
            <button className="btn primary" onClick={executeWorkflow} disabled={running}><span className="play-icon">{running ? <Activity size={15} /> : <Play size={14} fill="currentColor" />}</span>{running ? "Executing…" : "Test workflow"}</button>
          </div>
        </header>

        <div className="editor-tabs">
          {(["Workflows", "Executions", "Devices", "Alerts"] as EditorSection[]).map((tab) => (
            <button key={tab} className={`editor-tab ${activeSection === tab ? "active" : ""}`} onClick={() => setActiveSection(tab)}>
              {tab === "Workflows" ? "Automation Editor" : tab}
            </button>
          ))}
        </div>

        {renderPage()}
      </main>
    </div>
    </>
  );
}
