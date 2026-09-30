"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  Globe2,
  Mail,
  MailCheck,
  Network,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Router,
  Server,
  Settings,
  Sparkles,
  Trash2,
  Wrench,
  X,
  Zap,
} from "lucide-react";

type DeviceKind = "router" | "switch" | "server" | "firewall" | "printer" | "access-point";
type DeviceStatus = "online" | "warning" | "offline" | "unknown";
type Severity = "critical" | "warning" | "info";
type ProbeTool = "ping" | "snmp" | "tcp" | "http" | "dns";

type Device = {
  id: string;
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
};

type ProbeResult = { tool: ProbeTool; target: string; ok: boolean; latencyMs?: number; detail: string; data?: Record<string, unknown> };

type ProbeRunDeviceResult = {
  deviceId: string;
  deviceName: string;
  ipAddress: string;
  ok: boolean;
  latencyMs?: number;
  packetLossPct?: number;
  status: DeviceStatus;
  probes: ProbeResult[];
};

type ProbeRun = {
  id: string;
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
  status: string;
};

type Alert = {
  id: string;
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
};

type Settings = {
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
};

type StatusSnapshot = {
  organizationId: string;
  databaseDialect: "postgres" | "mysql" | "sqlite";
  devices: Device[];
  alerts: Alert[];
  runs: ProbeRun[];
  settings: Settings;
  summary: {
    devicesTotal: number;
    devicesOnline: number;
    devicesWarning: number;
    devicesOffline: number;
    openAlerts: number;
    criticalAlerts: number;
    lastScanAt?: string;
    lastScanStatus?: string;
    avgLatencyMs?: number;
  };
};

type EntryStage = "login" | "organization" | "database" | "editor";
type EditorSection = "Overview" | "Network Tools" | "Devices" | "Alerts" | "Scan History" | "Settings";

const TOOL_LABELS: Record<ProbeTool, string> = {
  ping: "ICMP Ping",
  snmp: "SNMP v2c",
  tcp: "TCP Ports",
  http: "HTTP Service",
  dns: "DNS Lookup",
};

function DeviceGlyph({ type, size = 24 }: { type: string; size?: number }) {
  const props = { size, strokeWidth: 1.9 };
  if (type === "server") return <Server {...props} />;
  if (type === "switch") return <Network {...props} />;
  if (type === "firewall") return <Globe2 {...props} />;
  return <Router {...props} />;
}

function statusDot(status: DeviceStatus) {
  return <span className={`device-dot ${status}`} />;
}

function probeChip(probe: ProbeResult) {
  return (
    <span key={probe.tool + probe.target} className={`probe-chip ${probe.ok ? "ok" : "fail"}`} title={`${probe.target}: ${probe.detail}`}>
      {probe.ok ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
      {TOOL_LABELS[probe.tool] ?? probe.tool}
      {probe.latencyMs !== undefined && <em>{probe.latencyMs} ms</em>}
    </span>
  );
}

function AlertCard({
  alert,
  onAcknowledge,
  onResolve,
  busy,
}: {
  alert: Alert;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <article className={`alert-card severity-${alert.severity} status-${alert.status}`}>
      <button className="alert-summary" onClick={() => setOpen((value) => !value)}>
        <span className="alert-severity">{alert.severity}</span>
        <span className="alert-title">
          <strong>{alert.title}</strong>
          <small>
            {alert.ipAddress} · {new Date(alert.createdAt).toLocaleString()} · {alert.status}
            {alert.emailDispatched ? " · email sent" : alert.emailError ? " · email pending" : ""}
          </small>
        </span>
        {alert.latencyMs !== undefined && <span className="alert-metric">{alert.latencyMs} ms</span>}
        {alert.packetLossPct !== undefined && <span className="alert-metric">{alert.packetLossPct}% loss</span>}
      </button>
      {open && (
        <div className="alert-detail">
          <p className="alert-paragraph">{alert.summary}</p>
          <div className="alert-block">
            <h4>Evidence</h4>
            <ul>{alert.evidence.map((line) => <li key={line}>{line}</li>)}</ul>
          </div>
          <div className="alert-block">
            <h4>Recommended on-site action</h4>
            <p>{alert.recommendation}</p>
          </div>
          <div className="alert-block">
            <h4>
              <Sparkles size={13} /> AI administrator message {alert.emailDispatched ? "(emailed)" : "(ready)"}
            </h4>
            <pre className="alert-message">{alert.message || alert.summary}</pre>
            {alert.emailError && <small className="alert-email-error">{alert.emailError}</small>}
            {!alert.emailError && alert.emailDispatched && <small className="alert-email-ok">Delivered to {alert.emailRecipients}</small>}
          </div>
          <div className="alert-actions">
            {alert.status === "open" && (
              <button className="btn ghost" disabled={busy} onClick={() => onAcknowledge(alert.id)}>Acknowledge</button>
            )}
            {alert.status !== "resolved" && (
              <button className="btn primary" disabled={busy} onClick={() => onResolve(alert.id)}>Mark resolved</button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

export default function NetworkMonitoringPlatform() {
  /* ---------------- entry flow (existing API process) ---------------- */
  const [entryStage, setEntryStage] = useState<EntryStage>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [confirmOwnerPassword, setConfirmOwnerPassword] = useState("");
  const [organizationId, setOrganizationId] = useState("local-workspace");
  const [currentUser, setCurrentUser] = useState({ name: "", email: "" });
  const [organizationDbUrl, setOrganizationDbUrl] = useState("file:./organization.db");
  const [entryError, setEntryError] = useState("");
  const [entryBusy, setEntryBusy] = useState(false);

  /* ---------------- monitoring workspace state ---------------- */
  const [snapshot, setSnapshot] = useState<StatusSnapshot | null>(null);
  const [activeSection, setActiveSection] = useState<EditorSection>("Overview");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeKind, setNoticeKind] = useState<"ok" | "error">("ok");
  const [testingDevice, setTestingDevice] = useState<string>("");
  const [deviceTest, setDeviceTest] = useState<{ deviceId: string; probes: ProbeResult[]; ok: boolean } | null>(null);
  const [deviceFormOpen, setDeviceFormOpen] = useState(false);
  const [deviceForm, setDeviceForm] = useState({ name: "", ipAddress: "", kind: "router" as DeviceKind, location: "", subnet: "", mac: "" });
  const [settingsDraft, setSettingsDraft] = useState<Settings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [expandedRun, setExpandedRun] = useState<string>("");
  const noticeTimer = useRef<number | null>(null);

  const settings = snapshot?.settings;

  const showNotice = useCallback((message: string, kind: "ok" | "error" = "ok") => {
    setNotice(message);
    setNoticeKind(kind);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 4000);
  }, []);

  const refreshStatus = useCallback(
    async (organization = organizationId) => {
      setLoading(true);
      try {
        const response = await fetch(`/api/monitoring/status?organizationId=${encodeURIComponent(organization)}`);
        const data = (await response.json()) as StatusSnapshot & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "Status request failed");
        setSnapshot(data);
        setSettingsDraft(data.settings);
        return data;
      } catch (error) {
        showNotice(error instanceof Error ? error.message : "Monitoring API unreachable", "error");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [organizationId, showNotice],
  );

  useEffect(() => {
    void refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the dashboard in sync while the background scheduler runs scans.
  useEffect(() => {
    if (entryStage !== "editor") return;
    const interval = window.setInterval(() => {
      if (!scanning && document.visibilityState === "visible") void refreshStatus();
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [entryStage, scanning, refreshStatus]);

  /* ---------------- entry flows (existing API process) ---------------- */
  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEntryBusy(true);
    setEntryError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = (await response.json()) as { user?: { name: string; email: string }; organization?: { id: string; name: string }; session?: { workspaceId: string }; error?: string };
    if (!response.ok || !data.session) {
      setEntryError(data.error ?? "Enter an email and password to continue.");
      setEntryBusy(false);
      return;
    }
    setOrganizationId(data.session.workspaceId);
    if (data.user) setCurrentUser(data.user);
    setEntryStage("editor");
    setEntryBusy(false);
    void refreshStatus(data.session.workspaceId);
  };

  const createOrganization = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEntryBusy(true);
    setEntryError("");
    const response = await fetch("/api/organizations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: organizationName, ownerName, ownerEmail, ownerPassword, confirmPassword: confirmOwnerPassword }),
    });
    const data = (await response.json()) as { organization?: { id: string }; owner?: { name: string; email: string }; error?: string };
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
    void refreshStatus();
  };

  /* ---------------- monitoring actions (API wired) ---------------- */
  const runScanNow = async () => {
    setScanning(true);
    try {
      const response = await fetch(`/api/monitoring/status?organizationId=${encodeURIComponent(organizationId)}`, { method: "POST" });
      const data = (await response.json()) as { run?: ProbeRun; error?: string };
      if (!response.ok || !data.run) throw new Error(data.error ?? "Scan failed");
      const summary = `${data.run.devicesOnline} online · ${data.run.devicesWarning} degraded · ${data.run.devicesOffline} offline`;
      showNotice(
        data.run.alertsCreated > 0
          ? `Scan complete — ${summary}. ${data.run.alertsCreated} fault alert(s) created${data.run.emailsDispatched ? `, ${data.run.emailsDispatched} admin email(s) dispatched` : ""}.`
          : `Scan complete — ${summary}. No faults detected.`,
        data.run.devicesOffline + data.run.devicesWarning > 0 ? "error" : "ok",
      );
      await refreshStatus();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Scan failed", "error");
    } finally {
      setScanning(false);
    }
  };

  const addDevice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!deviceForm.name.trim() || !deviceForm.ipAddress.trim()) return;
    const response = await fetch("/api/monitoring/devices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...deviceForm, organizationId }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      showNotice(data.error ?? "Could not add device", "error");
      return;
    }
    setDeviceForm({ name: "", ipAddress: "", kind: "router", location: "", subnet: "", mac: "" });
    setDeviceFormOpen(false);
    showNotice(`${deviceForm.name} registered. Run a scan to check it.`);
    await refreshStatus();
  };

  const removeDevice = async (device: Device) => {
    const response = await fetch(`/api/monitoring/devices?organizationId=${encodeURIComponent(organizationId)}&deviceId=${encodeURIComponent(device.id)}`, { method: "DELETE" });
    if (!response.ok) {
      showNotice("Could not remove device", "error");
      return;
    }
    showNotice(`${device.name} removed from monitoring.`);
    await refreshStatus();
  };

  const testDevice = async (device: Device) => {
    setTestingDevice(device.id);
    setDeviceTest(null);
    try {
      const response = await fetch("/api/monitoring/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, deviceId: device.id }),
      });
      const data = (await response.json()) as { probes?: ProbeResult[]; ok?: boolean; error?: string };
      if (!response.ok || !data.probes) throw new Error(data.error ?? "Device test failed");
      setDeviceTest({ deviceId: device.id, probes: data.probes, ok: Boolean(data.ok) });
      showNotice(data.ok ? `${device.name}: all probes answered.` : `${device.name}: fault detected — see probe results.`, data.ok ? "ok" : "error");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Device test failed", "error");
    } finally {
      setTestingDevice("");
    }
  };

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settingsDraft) return;
    setSavingSettings(true);
    try {
      const response = await fetch("/api/monitoring/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...settingsDraft, organizationId }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not save settings");
      showNotice("Monitoring settings saved.");
      await refreshStatus();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Could not save settings", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  const sendTestEmail = async () => {
    setTestingEmail(true);
    try {
      const response = await fetch("/api/monitoring/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      const data = (await response.json()) as { sent?: boolean; error?: string; recipients?: string };
      if (!response.ok || !data.sent) throw new Error(data.error ?? "Test email failed");
      showNotice(`Test notification delivered to ${data.recipients}.`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Test email failed", "error");
    } finally {
      setTestingEmail(false);
    }
  };

  const updateAlertStatus = async (alertId: string, status: "acknowledged" | "resolved") => {
    const response = await fetch("/api/monitoring/alerts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizationId, alertId, status }),
    });
    if (!response.ok) {
      showNotice("Could not update alert", "error");
      return;
    }
    showNotice(`Alert ${status}.`);
    await refreshStatus();
  };

  const summary = snapshot?.summary;
  const openAlerts = snapshot?.alerts.filter((alert) => alert.status !== "resolved") ?? [];
  const recentRuns = snapshot?.runs ?? [];
  const devices = snapshot?.devices ?? [];

  const renderOverview = () => (
    <section className="section-panel"><div className="section-panel-inner wide-panel">
      <div className="section-heading-row">
        <div>
          <span className="overline">NETWORK / OVERVIEW</span>
          <h1>Network health</h1>
          <p>Live status from the monitoring engine — {snapshot?.databaseDialect ?? "sqlite"} database, automatic scanning every {settings?.pollingIntervalSeconds ?? 30}s.</p>
        </div>
        <div className="header-actions">
          <button className="btn ghost" onClick={() => refreshStatus()} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""} /> Refresh</button>
          <button className="btn primary" onClick={runScanNow} disabled={scanning}><Play size={14} fill="currentColor" /> {scanning ? "Scanning network…" : "Scan network now"}</button>
        </div>
      </div>

      <div className="metric-grid">
        <article className="metric-card">
          <header><Network size={15} /> Devices monitored</header>
          <strong>{summary?.devicesTotal ?? 0}</strong>
          <footer>
            <span className="device-dot online" /> {summary?.devicesOnline ?? 0} online
            <span className="device-dot warning" style={{ marginLeft: 10 }} /> {summary?.devicesWarning ?? 0} degraded
            <span className="device-dot offline" style={{ marginLeft: 10 }} /> {summary?.devicesOffline ?? 0} offline
          </footer>
        </article>
        <article className="metric-card">
          <header><Gauge size={15} /> Average response</header>
          <strong>{summary?.avgLatencyMs !== undefined ? `${summary.avgLatencyMs} ms` : "—"}</strong>
          <footer>Threshold {settings?.warningLatencyMs ?? 300} ms</footer>
        </article>
        <article className={`metric-card ${summary?.criticalAlerts ? "metric-alert" : ""}`}>
          <header><Bell size={15} /> Open faults</header>
          <strong>{summary?.openAlerts ?? 0}</strong>
          <footer>{summary?.criticalAlerts ?? 0} critical · {openAlerts.length - (summary?.criticalAlerts ?? 0)} warning</footer>
        </article>
        <article className="metric-card">
          <header><Clock3 size={15} /> Last scan</header>
          <strong>{summary?.lastScanAt ? new Date(summary.lastScanAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}</strong>
          <footer>{summary?.lastScanStatus ?? "no scans yet"} · scheduler every {settings?.pollingIntervalSeconds ?? 30}s</footer>
        </article>
      </div>

      <div className="overview-columns">
        <div>
          <div className="panel-title"><Radio size={15} /> Fault notifications</div>
          {openAlerts.length === 0 && <p className="panel-empty">No open faults. All monitored devices answered their probes.</p>}
          {openAlerts.slice(0, 4).map((alert) => (
            <AlertCard key={alert.id} alert={alert} busy={scanning} onAcknowledge={(id) => updateAlertStatus(id, "acknowledged")} onResolve={(id) => updateAlertStatus(id, "resolved")} />
          ))}
          {openAlerts.length > 4 && <button className="btn ghost panel-more" onClick={() => setActiveSection("Alerts")}>View all {openAlerts.length} alerts</button>}
        </div>
        <div>
          <div className="panel-title"><Activity size={15} /> Device status</div>
          <div className="mini-device-list">
            {devices.map((device) => (
              <div className="mini-device-row" key={device.id}>
                <DeviceGlyph type={device.kind} size={17} />
                <span className="mini-device-name"><strong>{device.name}</strong><small>{device.ipAddress}</small></span>
                {statusDot(device.status)}
                <em>{device.responseTimeMs !== undefined ? `${device.responseTimeMs} ms` : "—"}</em>
              </div>
            ))}
            {!devices.length && <p className="panel-empty">No devices registered yet — add your routers, switches and servers from Devices.</p>}
          </div>
        </div>
      </div>
    </div></section>
  );

  const renderDevices = () => (
    <section className="section-panel"><div className="section-panel-inner wide-panel">
      <div className="section-heading-row">
        <div>
          <span className="overline">NETWORK / DEVICES</span>
          <h1>Registered devices</h1>
          <p>Routers, switches, servers and access points checked by the monitoring engine. Location helps the fault emails dispatch technicians to the right place.</p>
        </div>
        <div className="header-actions">
          <button className="btn ghost" onClick={() => refreshStatus()} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""} /> Refresh</button>
          <button className="btn primary" onClick={() => setDeviceFormOpen(true)}><Plus size={16} /> Add device</button>
        </div>
      </div>

      <div className="device-registry">
        {devices.map((device) => {
          const test = deviceTest?.deviceId === device.id ? deviceTest : null;
          return (
            <article className="device-block" key={device.id}>
              <div className="device-row">
                <div className="device-node-icon"><DeviceGlyph type={device.kind} size={24} /></div>
                <div className="device-main"><strong>{device.name}</strong><small>{device.ipAddress}{device.location ? ` · ${device.location}` : ""}</small></div>
                <div className="device-meta"><span>Response</span><strong>{device.responseTimeMs !== undefined ? `${device.responseTimeMs} ms` : "—"}</strong></div>
                <div className="device-meta"><span>Loss</span><strong>{device.packetLossPct !== undefined ? `${device.packetLossPct}%` : "—"}</strong></div>
                <div className="device-meta"><span>Last seen</span><strong>{device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</strong></div>
                <div className={`device-status ${device.status}`}><span />{device.status}</div>
                <div className="device-row-actions">
                  <button className="btn ghost" title="Run ping, SNMP, TCP, HTTP and DNS probes against this device" onClick={() => testDevice(device)} disabled={testingDevice === device.id}>
                    <Wrench size={14} /> {testingDevice === device.id ? "Testing…" : "Test"}
                  </button>
                  <button className="icon-btn danger" title="Remove device" onClick={() => removeDevice(device)}><Trash2 size={16} /></button>
                </div>
              </div>
              {test && (
                <div className="probe-results">
                  {test.probes.map(probeChip)}
                  <small className="probe-note">
                    {test.ok ? "Device reachable — SNMP, TCP and service probes answered where applicable." : "Fault evidence collected — if this persists the engine will open an alert and email the administrator."}
                  </small>
                </div>
              )}
            </article>
          );
        })}
        {!devices.length && <p className="panel-empty">No devices yet. Add your first router or switch to start monitoring.</p>}
      </div>

      {deviceFormOpen && (
        <div className="modal-backdrop" onMouseDown={() => setDeviceFormOpen(false)}>
          <div className="device-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div><span className="overline">NETWORK / DEVICE</span><h2>Add monitoring device</h2></div>
              <button className="icon-btn" onClick={() => setDeviceFormOpen(false)}><X size={18} /></button>
            </div>
            <form className="credential-form" onSubmit={addDevice}>
              <label>Device name<input value={deviceForm.name} onChange={(event) => setDeviceForm((v) => ({ ...v, name: event.target.value }))} placeholder="Core Router" required /></label>
              <div className="form-grid-2">
                <label>IP address / hostname<input value={deviceForm.ipAddress} onChange={(event) => setDeviceForm((v) => ({ ...v, ipAddress: event.target.value }))} placeholder="192.168.1.1" required /></label>
                <label>Device type<select value={deviceForm.kind} onChange={(event) => setDeviceForm((v) => ({ ...v, kind: event.target.value as DeviceKind }))}>
                  <option value="router">Router / AP</option>
                  <option value="switch">Switch</option>
                  <option value="server">Server</option>
                  <option value="firewall">Firewall</option>
                  <option value="printer">Printer</option>
                  <option value="access-point">Access point</option>
                </select></label>
              </div>
              <div className="form-grid-2">
                <label>Location <span className="optional">(used in fault emails)</span><input value={deviceForm.location} onChange={(event) => setDeviceForm((v) => ({ ...v, location: event.target.value }))} placeholder="Library, rack B2" /></label>
                <label>Subnet mask <span className="optional">(optional)</span><input value={deviceForm.subnet} onChange={(event) => setDeviceForm((v) => ({ ...v, subnet: event.target.value }))} placeholder="255.255.255.0" /></label>
              </div>
              <label>MAC address <span className="optional">(optional)</span><input value={deviceForm.mac} onChange={(event) => setDeviceForm((v) => ({ ...v, mac: event.target.value }))} placeholder="00:1B:44:11:3A:B7" /></label>
              <div className="database-choice">
                <strong><Network size={16} /> Monitoring probes</strong>
                <span>This device is checked with ICMP ping{settings?.snmpCommunity ? ` and SNMP v2c (community "${settings.snmpCommunity}")` : ""}{settings?.tcpPortsEnabled ? `, TCP ports ${settings.tcpPorts}` : ""}{settings?.httpUrls ? ", the configured HTTP checks" : ""}{settings?.dnsHostname ? " and DNS resolution" : ""} on every scan.</span>
              </div>
              <button className="btn primary full" type="submit"><Plus size={16} /> Add device to network</button>
            </form>
          </div>
        </div>
      )}
    </div></section>
  );

  const renderAlerts = () => (
    <section className="section-panel"><div className="section-panel-inner wide-panel">
      <div className="section-heading-row">
        <div>
          <span className="overline">NETWORK / ALERTS</span>
          <h1>Fault notifications</h1>
          <p>Every fault the engine detects is diagnosed, composed into an administrator email and stored here. Open an alert to read the AI message and on-site instructions.</p>
        </div>
        <button className="btn ghost" onClick={() => refreshStatus()} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""} /> Refresh</button>
      </div>
      <div className="alert-list">
        {snapshot?.alerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} busy={scanning} onAcknowledge={(id) => updateAlertStatus(id, "acknowledged")} onResolve={(id) => updateAlertStatus(id, "resolved")} />
        ))}
        {!snapshot?.alerts.length && (
          <p className="panel-empty">No alerts recorded. When a device goes offline or degrades, the engine creates an alert here, composes the administrator message with {settings?.aiProvider ?? "AI"} and emails {settings?.adminEmails || "the administrator"}.</p>
        )}
      </div>
    </div></section>
  );

  const renderScanHistory = () => (
    <section className="section-panel"><div className="section-panel-inner wide-panel">
      <div className="section-heading-row">
        <div>
          <span className="overline">NETWORK / SCAN HISTORY</span>
          <h1>Scan runs</h1>
          <p>Each run records the probe results for every device — the raw evidence behind alerts and emails.</p>
        </div>
        <button className="btn primary" onClick={runScanNow} disabled={scanning}><Play size={14} fill="currentColor" /> {scanning ? "Scanning…" : "Scan now"}</button>
      </div>
      <div className="run-list">
        {recentRuns.map((run) => (
          <article className="run-card" key={run.id}>
            <button className="run-head" onClick={() => setExpandedRun(expandedRun === run.id ? "" : run.id)}>
              <span className={`run-status ${run.status}`}><span />{run.status}</span>
              <strong>{new Date(run.startedAt).toLocaleString()}</strong>
              <small>{run.triggeredBy === "scheduler" ? "scheduled" : "manual"} · {run.durationMs ?? 0} ms</small>
              <span className="run-totals">
                <em className="online">{run.devicesOnline} up</em>
                <em className="warning">{run.devicesWarning} degraded</em>
                <em className="offline">{run.devicesOffline} down</em>
                {run.alertsCreated > 0 && <em className="alerts">{run.alertsCreated} alerts</em>}
                {run.emailsDispatched > 0 && <em className="emails"><MailCheck size={11} /> {run.emailsDispatched}</em>}
              </span>
            </button>
            {expandedRun === run.id && (
              <div className="run-detail">
                {run.results.map((result) => (
                  <div className="run-device" key={result.deviceId}>
                    <div className="run-device-head">
                      <strong>{result.deviceName}</strong>
                      <small>{result.ipAddress}</small>
                      <span className={`device-dot ${result.status}`} />
                      <span className={`run-device-status ${result.status}`}>{result.status}</span>
                    </div>
                    <div className="probe-results">{result.probes.map(probeChip)}</div>
                  </div>
                ))}
                {!run.results.length && <p className="panel-empty">No device results recorded for this run.</p>}
              </div>
            )}
          </article>
        ))}
        {!recentRuns.length && <p className="panel-empty">No scans yet — run one with "Scan network now".</p>}
      </div>
    </div></section>
  );

  const renderNetworkTools = () => (
    <section className="section-panel"><div className="section-panel-inner wide-panel">
      <span className="overline">NETWORK / TOOLS</span>
      <h1>Network testing tools</h1>
      <p>The engine runs these probes on every scan and on-demand from the Devices screen. Configure each tool below — settings are saved to the organization database.</p>
      <div className="tool-grid">
        <article className="tool-card">
          <div className="tool-head"><span className="tool-icon"><Radio size={17} /></span><div><strong>ICMP Ping</strong><small>Reachability, latency and packet loss</small></div></div>
          <p>Sends echo requests to every device. A device that misses its replies is marked offline after {settings?.failureThreshold ?? 3} failed checks; slow replies above {settings?.warningLatencyMs ?? 300} ms are flagged as degraded.</p>
          <div className="tool-fields">
            <label>Latency threshold (ms)<input type="number" min={10} max={5000} value={settingsDraft?.warningLatencyMs ?? 300} onChange={(event) => setSettingsDraft((v) => v ? { ...v, warningLatencyMs: Number(event.target.value) } : v)} /></label>
            <label>Failure threshold (scans)<input type="number" min={1} max={20} value={settingsDraft?.failureThreshold ?? 3} onChange={(event) => setSettingsDraft((v) => v ? { ...v, failureThreshold: Number(event.target.value) } : v)} /></label>
          </div>
        </article>
        <article className="tool-card">
          <div className="tool-head"><span className="tool-icon"><Server size={17} /></span><div><strong>SNMP v2c</strong><small>Device health via sysDescr / sysUpTime</small></div></div>
          <p>Queries each device's SNMP agent over UDP 161 for description, uptime and hostname — evidence that distinguishes a reboot from a link failure. Disabled by default; enter your community string to switch it on for every device.</p>
          <div className="tool-fields">
            <label>Community string <span className="optional">(empty = disabled)</span><input value={settingsDraft?.snmpCommunity ?? ""} onChange={(event) => setSettingsDraft((v) => v ? { ...v, snmpCommunity: event.target.value } : v)} placeholder="public" /></label>
          </div>
        </article>
        <article className="tool-card">
          <div className="tool-head"><span className="tool-icon"><Globe2 size={17} /></span><div><strong>TCP port check</strong><small>Service-level reachability</small></div></div>
          <p>Connects to the configured service ports on every device. Open ports prove the host is up even when ICMP is blocked by policy. Disabled by default — some hosting networks sit behind transparent proxies that accept every connection, which would produce false positives.</p>
          <div className="tool-fields">
            <label className="toggle-row"><span><strong>Enable TCP port checks</strong><small>Run on every scan for every device</small></span><input type="checkbox" checked={settingsDraft?.tcpPortsEnabled ?? false} onChange={(event) => setSettingsDraft((v) => v ? { ...v, tcpPortsEnabled: event.target.checked } : v)} /><span className="switch" /></label>
            <label>TCP ports (comma separated)<input value={settingsDraft?.tcpPorts ?? "22,80,443"} onChange={(event) => setSettingsDraft((v) => v ? { ...v, tcpPorts: event.target.value } : v)} placeholder="22,80,443" /></label>
          </div>
        </article>
        <article className="tool-card">
          <div className="tool-head"><span className="tool-icon"><Activity size={17} /></span><div><strong>HTTP service check</strong><small>Web interfaces and APIs</small></div></div>
          <p>Fetches the configured URLs (device admin panels, dashboards) and measures status code and response time. 5xx or timeouts count as faults.</p>
          <div className="tool-fields">
            <label>URLs to check<input value={settingsDraft?.httpUrls ?? ""} onChange={(event) => setSettingsDraft((v) => v ? { ...v, httpUrls: event.target.value } : v)} placeholder="http://192.168.1.1, https://intranet.local" /></label>
          </div>
        </article>
        <article className="tool-card">
          <div className="tool-head"><span className="tool-icon"><Zap size={17} /></span><div><strong>DNS lookup</strong><small>Resolver health</small></div></div>
          <p>Resolves the configured hostname through the configured server on every scan — catches a dead DNS server even when every other device is up.</p>
          <div className="tool-fields">
            <div className="form-grid-2">
              <label>Hostname<input value={settingsDraft?.dnsHostname ?? ""} onChange={(event) => setSettingsDraft((v) => v ? { ...v, dnsHostname: event.target.value } : v)} placeholder="gateway.local" /></label>
              <label>DNS server <span className="optional">(optional)</span><input value={settingsDraft?.dnsServer ?? ""} onChange={(event) => setSettingsDraft((v) => v ? { ...v, dnsServer: event.target.value } : v)} placeholder="192.168.1.1" /></label>
            </div>
          </div>
        </article>
        <article className="tool-card tool-card-action">
          <div className="tool-head"><span className="tool-icon"><Gauge size={17} /></span><div><strong>Scan interval</strong><small>Background scheduler frequency</small></div></div>
          <p>The engine rescans the whole network automatically. Changes apply after you save settings.</p>
          <div className="tool-fields">
            <label>Interval (seconds)<select value={settingsDraft?.pollingIntervalSeconds ?? 30} onChange={(event) => setSettingsDraft((v) => v ? { ...v, pollingIntervalSeconds: Number(event.target.value) } : v)}>
              <option value={15}>15 seconds</option>
              <option value={30}>30 seconds</option>
              <option value={60}>60 seconds</option>
              <option value={120}>2 minutes</option>
              <option value={300}>5 minutes</option>
            </select></label>
          </div>
        </article>
      </div>
      <div className="settings-save-row">
        <button className="btn primary" onClick={saveSettings as unknown as () => void} disabled={savingSettings || !settingsDraft}>
          <CheckCircle2 size={15} /> {savingSettings ? "Saving…" : "Save tool configuration"}
        </button>
        <button className="btn ghost" onClick={() => testDevice(devices[0] ?? ({ id: "adhoc", name: "Ad-hoc host", ipAddress: "192.168.1.1" } as Device))} disabled={testingDevice !== ""}>
          <Wrench size={15} /> Run probes against {devices[0]?.ipAddress ?? "first device"}
        </button>
      </div>
      {deviceTest && (
        <div className="probe-results standalone">
          {deviceTest.probes.map(probeChip)}
        </div>
      )}
    </div></section>
  );

  const renderSettings = () => (
    <section className="section-panel"><div className="section-panel-inner api-panel">
      <span className="overline">NETWORK / SETTINGS</span>
      <h1>Notifications &amp; AI</h1>
      <p>Fault alerts are composed with AI and emailed to the administrators. The engine falls back to a deterministic message when no AI key is configured.</p>
      <form className="credential-form" onSubmit={saveSettings}>
        <div className="form-grid-2">
          <label>AI provider<select value={settingsDraft?.aiProvider ?? "gemini"} onChange={(event) => setSettingsDraft((v) => v ? { ...v, aiProvider: event.target.value } : v)}>
            <option value="gemini">Gemini</option>
            <option value="groq">Groq</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="mistral">Mistral</option>
          </select></label>
          <label>AI model<input value={settingsDraft?.aiModel ?? "gemini-2.5-flash"} onChange={(event) => setSettingsDraft((v) => v ? { ...v, aiModel: event.target.value } : v)} placeholder="gemini-2.5-flash" /></label>
        </div>
        <small className="field-note">
          Provider keys are read from the server environment (GEMINI_API_KEY, GROQ_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, MISTRAL_API_KEY). Without a key the deterministic fault message is emailed instead.
        </small>

        <label>Administrator email addresses<input value={settingsDraft?.adminEmails ?? ""} onChange={(event) => setSettingsDraft((v) => v ? { ...v, adminEmails: event.target.value } : v)} placeholder="admin@yourdomain.com, backup@yourdomain.com" required /></label>
        <small className="field-note">These recipients receive the fault email telling them to travel to the device location.</small>

        <div className="form-grid-2">
          <label>SMTP host<input value={settingsDraft?.smtpHost ?? "smtp.gmail.com"} onChange={(event) => setSettingsDraft((v) => v ? { ...v, smtpHost: event.target.value } : v)} /></label>
          <label>SMTP port<select value={settingsDraft?.smtpPort ?? 465} onChange={(event) => setSettingsDraft((v) => v ? { ...v, smtpPort: Number(event.target.value), smtpSecure: Number(event.target.value) === 465 } : v)}>
            <option value={465}>465 (implicit TLS)</option>
            <option value={587}>587 (STARTTLS)</option>
            <option value={25}>25 (plain)</option>
          </select></label>
        </div>
        <div className="form-grid-2">
          <label>SMTP user (Gmail address)<input type="email" value={settingsDraft?.smtpUser ?? ""} onChange={(event) => setSettingsDraft((v) => v ? { ...v, smtpUser: event.target.value } : v)} placeholder="monitoring@gmail.com" /></label>
          <label>SMTP app password <span className="optional">(stored server-side)</span><input type="password" value="" onChange={() => undefined} placeholder={settings?.smtpUser ? "•••••••••••• (configured)" : "16-character app password"} autoComplete="new-password" /></label>
        </div>
        <label>From address <span className="optional">(optional)</span><input value={settingsDraft?.smtpFrom ?? ""} onChange={(event) => setSettingsDraft((v) => v ? { ...v, smtpFrom: event.target.value } : v)} placeholder="network-monitor@yourdomain.com" /></label>
        <small className="field-note">The app password is written to the server environment (SMTP_PASS) — it is never stored in the browser or returned by the API.</small>

        <div className="settings-save-row">
          <button className="btn primary" type="submit" disabled={savingSettings || !settingsDraft}><CheckCircle2 size={15} /> {savingSettings ? "Saving…" : "Save settings"}</button>
          <button className="btn ghost" type="button" onClick={sendTestEmail} disabled={testingEmail}><Mail size={15} /> {testingEmail ? "Sending…" : "Send test notification"}</button>
        </div>
        <div className="database-choice">
          <strong><Database size={16} /> Data connection</strong>
          <span>Devices, alerts and scan history are stored in this organization's own database ({snapshot?.databaseDialect ?? "sqlite"} — Bring-Your-Own-DB), configured during onboarding.</span>
        </div>
      </form>
    </div></section>
  );

  /* ---------------- entry screens ---------------- */
  if (entryStage !== "editor") {
    const step = entryStage === "login" ? "01 / ACCESS" : entryStage === "organization" ? "02 / ORGANIZATION" : "03 / DATA CONNECTION";
    return (
      <main className="entry-shell">
        <div className="entry-brand"><span className="netmoni-logo">N</span><span>netmoni</span></div>
        <div className="entry-frame">
          <div className="entry-aside">
            <span className="overline">NETWORK MONITORING</span>
            <h1>See the fault. Fix the fault.</h1>
            <p>Ping, SNMP, TCP, HTTP and DNS probes watch every device. When something breaks, AI writes the diagnosis and emails the administrator with on-site instructions.</p>
            <div className="entry-aside-line" />
            <small>Bring your own database. Your network data stays in your PostgreSQL, MySQL or SQLite.</small>
          </div>
          <section className="entry-card">
            <span className="overline">{step}</span>
            {entryStage === "login" && <>
              <h2>Welcome back</h2><p className="entry-lede">Sign in to your NetMoni workspace.</p>
              <form className="entry-form" onSubmit={login}>
                <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" required /></label>
                <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required /></label>
                {entryError && <div className="entry-error">{entryError}</div>}
                <button className="entry-submit" type="submit" disabled={entryBusy}>{entryBusy ? "Signing in..." : "Continue"}<span>{"->"}</span></button>
              </form>
              <div className="entry-foot">New to NetMoni? <button type="button" onClick={() => { setEntryStage("organization"); setEntryError(""); }}>Create an organization</button></div>
            </>}
            {entryStage === "organization" && <>
              <h2>Create your organization</h2><p className="entry-lede">Your organization is the boundary for members, devices, alerts, and monitoring data.</p>
              <form className="entry-form" onSubmit={createOrganization}>
                <label>Organization name<input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} placeholder="Acme Ltd" required /></label>
                <div className="owner-section"><span className="owner-section-title">System owner</span><p>This account manages devices, monitoring settings, and administrator alerts.</p>
                  <label>Your name<input value={ownerName} onChange={(event) => setOwnerName(event.target.value)} placeholder="Maya Chen" required /></label>
                  <label>Owner email<input type="email" value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} placeholder="you@company.com" required /></label>
                  <label>Create password<input type="password" minLength={8} value={ownerPassword} onChange={(event) => setOwnerPassword(event.target.value)} placeholder="At least 8 characters" required /></label>
                  <label>Confirm password<input type="password" minLength={8} value={confirmOwnerPassword} onChange={(event) => setConfirmOwnerPassword(event.target.value)} placeholder="Repeat your password" required /></label>
                </div>
                {entryError && <div className="entry-error">{entryError}</div>}
                <button className="entry-submit" type="submit" disabled={entryBusy}>{entryBusy ? "Creating owner account..." : "Create organization and owner"}<span>{"->"}</span></button>
              </form>
              <button className="back-link" type="button" onClick={() => setEntryStage("login")}>Back to sign in</button>
            </>}
            {entryStage === "database" && <>
              <h2>Connect your database</h2><p className="entry-lede">Monitoring devices, alerts and scan history live in this database — bring your own PostgreSQL or MySQL, or use local SQLite.</p>
              <form className="entry-form" onSubmit={connectOrganizationDatabase}>
                <label>Organization database URL<input type="text" value={organizationDbUrl} onChange={(event) => setOrganizationDbUrl(event.target.value)} placeholder="file:./organization.db" required /></label>
                <div className="database-choice"><strong>SQLite is ready to use</strong><span>Use <code>file:</code> for local SQLite, or enter a <code>postgres://</code> or <code>mysql://</code> connection. Monitoring tables are created automatically.</span></div>
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
    <div className="app-shell network-theme-light">
      {notice && <div className={`ui-notice ${noticeKind}`} role="status">{notice}</div>}
      <aside className="app-rail">
        <div className="rail-brand"><div className="netmoni-logo">N</div></div>
        <nav className="rail-nav">
          {([
            ["Overview", "overview"], ["Network Tools", "tools"], ["Devices", "devices"], ["Alerts", "alerts"], ["Scan History", "history"], ["Settings", "settings"],
          ] as [EditorSection, string][]).map(([section, icon]) => (
            <button key={section} className={`rail-item ${activeSection === section ? "active" : ""}`} onClick={() => setActiveSection(section)} title={section}>
              <span>{icon === "overview" ? <Activity size={18} /> : icon === "tools" ? <Wrench size={18} /> : icon === "devices" ? <Network size={18} /> : icon === "alerts" ? <Bell size={18} /> : icon === "history" ? <Clock3 size={18} /> : <Settings size={18} />}</span>
            </button>
          ))}
        </nav>
        <div className="rail-spacer" />
        <div className="rail-user" title={currentUser.email || "Owner"}>{(currentUser.name || "Owner").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div>
      </aside>

      <main className="editor-main">
        <header className="editor-header">
          <div className="header-left">
            <div className="crumb"><span>NetMoni</span><span className="crumb-sep">/</span><span>Network Monitoring</span></div>
            <div className="wf-title-row">
              <span className="wf-name-static">Network Operations</span>
              <span className="save-state saved"><i />{summary ? `${summary.devicesOnline}/${summary.devicesTotal} up` : "connecting…"}</span>
            </div>
          </div>
          <div className="header-actions">
            <button className="btn ghost" onClick={() => refreshStatus()} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""} /> Refresh</button>
            <button className="btn primary" onClick={runScanNow} disabled={scanning}>
              {scanning ? <Activity size={15} className="spin" /> : <Play size={14} fill="currentColor" />}
              {scanning ? "Scanning…" : "Scan network"}
            </button>
          </div>
        </header>

        <div className="editor-tabs">
          {(["Overview", "Network Tools", "Devices", "Alerts", "Scan History", "Settings"] as EditorSection[]).map((tab) => (
            <button key={tab} className={`editor-tab ${activeSection === tab ? "active" : ""}`} onClick={() => setActiveSection(tab)}>{tab}</button>
          ))}
        </div>

        {activeSection === "Overview" && renderOverview()}
        {activeSection === "Network Tools" && renderNetworkTools()}
        {activeSection === "Devices" && renderDevices()}
        {activeSection === "Alerts" && renderAlerts()}
        {activeSection === "Scan History" && renderScanHistory()}
        {activeSection === "Settings" && renderSettings()}
      </main>
    </div>
  );
}
