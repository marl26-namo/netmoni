/**
 * Engine smoke test: exercises the probe suite, fault analysis, alert
 * composition, and persistence against the default SQLite database.
 * Run with: bun run scripts/smoke-test.ts
 */
import { pingOnce, tcpConnect, dnsProbe, snmpGet } from "@/monitoring/probes";
import { analyzeDeviceFault, alertEmailSubject } from "@/monitoring/analyzer";
import { monitoringStore } from "@/monitoring/store";
import type { Device } from "@/monitoring/types";

const ORG = "smoke-test-org";

async function main() {
  console.log("== 1. probe suite ==");
  const ping = await pingOnce("127.0.0.1");
  console.log("ping 127.0.0.1:", ping.ok ? `OK ${ping.latencyMs}ms` : `FAIL (${ping.detail})`);
  const tcp = await tcpConnect("127.0.0.1", process.env.PORT ? Number(process.env.PORT) : 3000, 1000).catch(() => null);
  console.log("tcp localhost:", tcp?.ok ? `OK ${tcp.latencyMs}ms` : "skipped (no listener — fine)");
  const dnsr = await dnsProbe("localhost");
  console.log("dns localhost:", dnsr.ok ? `OK ${dnsr.detail}` : `FAIL (${dnsr.detail})`);
  const snmp = await snmpGet("127.0.0.1", "public", ["1.3.6.1.2.1.1.5.0"], 1200);
  console.log("snmp 127.0.0.1 (no agent expected):", snmp.ok ? "OK" : `unavailable as expected (${snmp.detail})`);

  console.log("\n== 2. settings persistence (BYO-DB sqlite) ==");
  const settings = await monitoringStore.getSettings(ORG);
  settings.adminEmails = "admin@example.com";
  settings.aiProvider = "gemini";
  await monitoringStore.saveSettings(settings);
  const reloaded = await monitoringStore.getSettings(ORG);
  console.log("settings round-trip:", reloaded.adminEmails === "admin@example.com" ? "OK" : "FAIL");

  console.log("\n== 3. device persistence ==");
  const device = await monitoringStore.saveDevice({ organizationId: ORG, name: "Smoke Router", ipAddress: "192.0.2.1", kind: "router", location: "Lab rack" });
  const devices = await monitoringStore.listDevices(ORG);
  console.log("device saved:", devices.length === 1 ? "OK" : "FAIL");
  await monitoringStore.updateDeviceStatus(ORG, device.id, { status: "offline", lastCheckedAt: new Date().toISOString() });
  const after = await monitoringStore.getDevice(ORG, device.id);
  console.log("status update:", after?.status === "offline" ? "OK" : "FAIL");

  console.log("\n== 4. fault analysis ==");
  const analysis = analyzeDeviceFault(after as Device, [
    { tool: "ping", target: "192.0.2.1", ok: false, packetLossPct: 100, detail: "No ICMP reply (100% packet loss)" },
  ], { warningLatencyMs: 300, packetLossThresholdPct: 5 });
  console.log("severity:", analysis.severity, "| faulted:", analysis.faulted);
  console.log("recommendation:", analysis.recommendation.slice(0, 90) + "…");
  if (analysis.severity !== "critical" || !analysis.recommendation.toLowerCase().includes("dispatch")) {
    console.log("analysis FAIL: expected critical + on-site instruction");
    process.exitCode = 1;
  }

  console.log("\n== 5. alert persistence + email fields ==");
  const alert = {
    id: "alert-smoke1", organizationId: ORG, deviceId: device.id, deviceName: device.name, ipAddress: device.ipAddress,
    severity: "critical" as const, status: "open" as const, title: "Smoke Router is unreachable",
    summary: analysis.summary, evidence: analysis.evidence, recommendation: analysis.recommendation,
    message: `${analysis.summary}\n\n${analysis.recommendation}`,
    probesFailed: ["ping"], emailDispatched: false,
    emailError: "SMTP credentials missing — set the SMTP user and app password in Monitoring settings (or SMTP_USER/SMTP_PASS env)",
    createdAt: new Date().toISOString(),
  };
  await monitoringStore.saveAlert(alert);
  const alerts = await monitoringStore.listAlerts(ORG);
  console.log("alert stored:", alerts.length === 1 && Array.isArray(alerts[0].evidence) && alerts[0].evidence.length > 0 ? "OK" : "FAIL");
  console.log("email subject:", alertEmailSubject(alerts[0]));

  console.log("\n== 6. runs persistence ==");
  await monitoringStore.saveRun({
    id: "run-smoke1", organizationId: ORG, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(),
    durationMs: 42, triggeredBy: "manual", devicesChecked: 1, devicesOnline: 0, devicesWarning: 0, devicesOffline: 1,
    results: [], alertsCreated: 1, emailsDispatched: 0, status: "completed",
  });
  const runs = await monitoringStore.listRuns(ORG);
  console.log("run stored:", runs.length === 1 && runs[0].devicesOffline === 1 ? "OK" : "FAIL");

  console.log("\nSmoke test finished.");
}

main().catch((error) => {
  console.error("Smoke test crashed:", error);
  process.exitCode = 1;
});
