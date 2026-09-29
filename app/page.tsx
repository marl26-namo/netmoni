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

const NODE_W = 214;
const NODE_H = 108;
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
  const [activeSection, setActiveSection] = useState<EditorSection>("Workflows");
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

  const onNodePointerDown = (e: ReactPointerEvent, node: WorkflowNode) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    canvasRef.current?.setPointerCapture(e.pointerId);
    const p = toCanvas(e.clientX, e.clientY);
    dragRef.current = { kind: "node", id: node.id, offX: p.x - node.x, offY: p.y - node.y };
    setSelectedNode(node.id);
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
    const x = anchor ? anchor.x + NODE_W + 90 : 250;
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
    setSelectedNode(id);
  };

  const insertAfter = (id: string) => {
    const index = nodes.findIndex((n) => n.id === id);
    if (index < 0) return;
    const anchor = nodes[index];
    const item = nodeLibrary.find((n) => n.type === "action")!;
    const newId = crypto.randomUUID();
    setNodes((cur) => {
      const next = cur.map((n, i) => i > index ? { ...n, x: n.x + NODE_W + 90 } : n);
      next.splice(index + 1, 0, { id: newId, type: item.type, name: item.name, description: item.description, icon: item.icon, x: anchor.x + NODE_W + 90, y: anchor.y });
      return next;
    });
    setSelectedNode(newId);
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
    const maxX = Math.max(...nodes.map((n) => n.x + NODE_W)) + 100;
    const minY = Math.min(...nodes.map((n) => n.y)) - 100;
    const maxY = Math.max(...nodes.map((n) => n.y + NODE_H)) + 100;
    const zoom = Math.min(1.4, Math.max(0.3, Math.min(rect.width / (maxX - minX), rect.height / (maxY - minY))));
    setViewport({ zoom, x: (rect.width - (maxX - minX) * zoom) / 2 - minX * zoom, y: (rect.height - (maxY - minY) * zoom) / 2 - minY * zoom });
  };

  const executeWorkflow = async () => {
    setRunning(true);
    try {
      await fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "workflow.execute",
          payload: { workflowId: "network-fault-notification", organizationId, nodes },
        }),
      });
    } finally {
      window.setTimeout(() => setRunning(false), 1600);
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
            <button className="icon-btn" onClick={() => setLeftOpen(false)}>×</button>
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
                    setSelectedNode(id);
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
              const d = edgePath(node.x + NODE_W, node.y + NODE_H / 2, next.x, next.y + NODE_H / 2);
              return (
                <g key={node.id}>
                  <path d={d} className={`edge-path ${running ? "running" : ""}`} />
                  {running && <circle r={5} className="edge-pulse"><animateMotion dur="1.1s" repeatCount="indefinite" path={d} /></circle>}
                </g>
              );
            })}
          </svg>

          {nodes.map((node) => (
            <div
              key={node.id}
              className={`wf-node type-${node.type} ${selectedNode === node.id ? "selected" : ""} ${running ? "running" : ""}`}
              style={{ left: node.x, top: node.y, width: NODE_W }}
              onPointerDown={(e) => onNodePointerDown(e, node)}
            >
              <span className="handle handle-in" />
              <div className="wf-node-strip" />
              <div className="wf-node-head">
                <span className={`wf-node-icon type-${node.type}`}><NodeGlyph icon={node.icon} size={18} /></span>
                <div className="wf-node-title">
                  <strong>{node.name}</strong>
                  <small>{typeLabel(node.type)} node</small>
                </div>
                <button className="node-delete" onPointerDown={(e) => e.stopPropagation()} onClick={() => removeNode(node.id)}><X size={14} /></button>
              </div>
              <div className="wf-node-desc">{node.description}</div>
              {node.name === "Send Fault Email" && <div className="wf-node-meta">Google SMTP · Nodemailer</div>}
              {node.name === "Network Fault Detected" && <div className="wf-node-meta">Device monitoring event</div>}
              <span className="handle handle-out" />
              <button className="quick-add" onPointerDown={(e) => e.stopPropagation()} onClick={() => insertAfter(node.id)}><Plus size={13} /></button>
            </div>
          ))}
        </div>

        {!leftOpen && <button className="reopen-library" onClick={() => setLeftOpen(true)}>☰ Nodes</button>}
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
            <button className="icon-btn" onClick={() => setRightOpen(false)}><X size={17} /></button>
          </div>

          <div className="inspector-tabs">
            {(["Parameters", "Settings"] as const).map((tab) => (
              <button key={tab} className={inspectorTab === tab ? "active" : ""} onClick={() => setInspectorTab(tab)}>{tab}</button>
            ))}
          </div>

          <div className="inspector-body">
            {inspectorTab === "Parameters" ? (
              <>
                {selected.name === "Network Fault Detected" && (
                  <div className="field">
                    <label>Trigger event</label>
                    <select defaultValue="fault">
                      <option value="fault">Device failure detected</option>
                      <option>Device status changed</option>
                      <option>Packet loss threshold exceeded</option>
                      <option>Response time threshold exceeded</option>
                    </select>
                    <label>Minimum severity</label>
                    <select defaultValue="critical">
                      <option value="critical">Critical</option>
                      <option>Warning</option>
                      <option>Any</option>
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
                        <strong>AI message composer</strong>
                        <small>Turns raw network events into an administrator-ready message.</small>
                      </div>
                    </div>
                    <div className="field">
                      <label>AI provider</label>
                      <select value={aiProvider} onChange={(e) => {
                        setAiProvider(e.target.value);
                        setNodes((cur) => cur.map((n) => n.id === selected.id ? { ...n, config: { ...n.config, model: e.target.value.toLowerCase() } } : n));
                      }}>
                        <option>Gemini</option>
                        <option>OpenAI</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>Message instruction</label>
                      <textarea
                        rows={6}
                        value={aiInstruction}
                        onChange={(e) => {
                          setAiInstruction(e.target.value);
                          setNodes((cur) => cur.map((n) => n.id === selected.id ? { ...n, config: { ...n.config, instruction: e.target.value } } : n));
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
          {["Network Fault Detected", "Check Fault Severity", "Send Fault Email"].map((step, i) => <article className="dashboard-integration-card" key={step}><div className="dashboard-integration-icon">{String(i + 1).padStart(2, "0")}</div><div><strong>{step}</strong><small>{step === "Send Gmail" ? "Google SMTP / Nodemailer" : step === "AI Message" ? "AI message generation" : "Network automation"}</small><p>{step === "Send Gmail" ? "Administrator email dispatch node ready." : step === "AI Message" ? "Generates a clear fault notification." : "Waiting for network event."}</p></div></article>)}
        </div>
      </div></section>;
    }

    if (activeSection === "Settings") {
      return <section className="section-panel"><div className="section-panel-inner api-panel">
        <span className="overline">NETWORK / SETTINGS</span><h1>Monitoring and notification settings</h1>
        <p>Configure thresholds used by network events and the notification workflow.</p>
        <div className="credential-form">
          <label>Polling interval<select defaultValue="30"><option value="15">15 seconds</option><option value="30">30 seconds</option><option value="60">60 seconds</option></select></label>
          <label>Failure threshold<select defaultValue="3"><option value="2">2 missed responses</option><option value="3">3 missed responses</option><option value="5">5 missed responses</option></select></label>
          <label>Default notification workflow<input value="Network Fault Notification" readOnly /></label>
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
    <div className="app-shell">
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
  );
}
