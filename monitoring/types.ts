export type DeviceKind = "router" | "switch" | "server" | "firewall" | "printer" | "access-point";

export type DeviceStatus = "online" | "warning" | "offline" | "unknown";

export type ProbeTool = "ping" | "snmp" | "tcp" | "http" | "dns";

export type Severity = "critical" | "warning" | "info";

export type Device = {
  id: string;
  organizationId: string;
  name: string;
  ipAddress: string;
  subnet?: string;
  mac?: string;
  kind: DeviceKind;
  location?: string;
  status: DeviceStatus;
  responseTimeMs?: number;
  packetLossPct?: number;
  lastSeenAt?: string;
  lastCheckedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProbeResult = {
  tool: ProbeTool;
  target: string;
  ok: boolean;
  latencyMs?: number;
  packetLossPct?: number;
  detail: string;
  data?: Record<string, unknown>;
};

export type ProbeRunDeviceResult = {
  deviceId: string;
  deviceName: string;
  ipAddress: string;
  ok: boolean;
  latencyMs?: number;
  packetLossPct?: number;
  status: DeviceStatus;
  probes: ProbeResult[];
};

export type ProbeRun = {
  id: string;
  organizationId: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  triggeredBy: "manual" | "scheduler";
  devicesChecked: number;
  devicesOnline: number;
  devicesWarning: number;
  devicesOffline: number;
  results: ProbeRunDeviceResult[];
  alertsCreated: number;
  emailsDispatched: number;
  status: "running" | "completed" | "failed";
  error?: string;
};

export type Alert = {
  id: string;
  organizationId: string;
  deviceId: string;
  deviceName: string;
  ipAddress: string;
  severity: Severity;
  status: "open" | "acknowledged" | "resolved";
  title: string;
  summary: string;
  evidence: string[];
  recommendation: string;
  message: string;
  probesFailed: string[];
  latencyMs?: number;
  packetLossPct?: number;
  emailDispatched: boolean;
  emailRecipients?: string;
  emailError?: string;
  createdAt: string;
  resolvedAt?: string;
};

export type MonitoringSettings = {
  organizationId: string;
  pollingIntervalSeconds: number;
  failureThreshold: number;
  warningLatencyMs: number;
  packetLossThresholdPct: number;
  snmpCommunity: string;
  tcpPorts: string;
  tcpPortsEnabled: boolean;
  httpUrls: string;
  dnsHostname: string;
  dnsServer?: string;
  aiProvider: string;
  aiModel: string;
  adminEmails: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser?: string;
  smtpFrom?: string;
  updatedAt: string;
};
