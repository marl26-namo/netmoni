import { Activity, AlertTriangle, BrainCircuit, Clock3, Database, GitBranch, Globe2, Mail, Network, Router, Server, ShieldAlert, Zap } from "lucide-react";
import type { NodeType, NodeLibraryItem, Viewport, WorkflowNode } from "./types";

export const NODE_W = 112;
export const NODE_H = 132;
export const DEFAULT_VIEWPORT: Viewport = { x: 160, y: 80, zoom: 0.9 };

export const nodeLibrary: NodeLibraryItem[] = [
  { type: "trigger", name: "Network Fault", description: "Start when a device fails", icon: "fault" },
  { type: "trigger", name: "Status Changed", description: "Start on device status change", icon: "status" },
  { type: "trigger", name: "Schedule Monitor", description: "Run monitoring on a schedule", icon: "schedule" },
  { type: "logic", name: "IF Severity", description: "Branch by severity or status", icon: "if" },
  { type: "logic", name: "Switch Device", description: "Route by device type", icon: "switch" },
  { type: "action", name: "AI Message", description: "Generate the fault message with AI", icon: "ai" },
  { type: "action", name: "Send Gmail", description: "Send through Google SMTP", icon: "mail" },
  { type: "action", name: "Create Alert", description: "Create a monitoring incident", icon: "alert" },
  { type: "action", name: "HTTP Request", description: "Call a notification API", icon: "http" },
  { type: "action", name: "Record Incident", description: "Save the network event", icon: "db" },
];

export function edgePath(x1: number, y1: number, x2: number, y2: number) {
  const dx = Math.max(70, Math.abs(x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

export function NodeGlyph({ icon, size = 18 }: { icon: string; size?: number }) {
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

export function DeviceGlyph({ type = "router", size = 24 }: { type?: string; size?: number }) {
  const props = { size, strokeWidth: 1.9 };
  if (type.toLowerCase().includes("server")) return <Server {...props} />;
  if (type.toLowerCase().includes("switch")) return <Network {...props} />;
  return <Router {...props} />;
}

export function typeLabel(type: NodeType) {
  return type === "trigger" ? "Trigger" : type === "logic" ? "Logic" : "Action";
}

export function nodeDimensions(node: WorkflowNode) {
  return node.icon === "ai" ? { width: 260, height: 108 } : { width: 116, height: 116 };
}
