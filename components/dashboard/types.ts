export type NodeType = "trigger" | "action" | "logic";

export type WorkflowNode = {
  id: string;
  type: NodeType;
  name: string;
  description: string;
  icon: string;
  x: number;
  y: number;
  config?: Record<string, string>;
};

export type SavedWorkflow = {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EntryStage = "login" | "organization" | "editor";

export type EditorSection = "Overview" | "Workflows" | "Executions" | "Devices" | "Alerts" | "Settings";

export type Viewport = { x: number; y: number; zoom: number };

export type NodeLibraryItem = { type: NodeType; name: string; description: string; icon: string };

export type DeviceEntry = { name: string; ip: string; subnet: string; mac: string; type: string; status: string };

export type DeviceForm = { name: string; ip: string; subnet: string; mac: string; type: string };

export type BackendAlert = {
  id: string;
  deviceName: string;
  ipAddress: string;
  severity: string;
  status: string;
  summary: string;
  emailStatus: string;
  createdAt: string;
};

export type BackendResult = {
  id: string;
  deviceName: string;
  ipAddress: string;
  probe: string;
  ok: boolean;
  latencyMs: number | null;
  packetLossPercent: number;
  bandwidthInMbps: number | null;
  bandwidthOutMbps: number | null;
  checkedAt: string;
};

export type ExecutionRun = { id: string; time: string; status: string; detail: string };

export type SettingsForm = { pollingInterval: string; failureThreshold: string };

export type EntryField =
  | "email"
  | "password"
  | "organizationName"
  | "ownerName"
  | "ownerEmail"
  | "ownerPassword"
  | "confirmOwnerPassword";
