import { NextResponse } from "next/server";
import { monitoringStore } from "@/monitoring/store";
import { parseRecipients, sendFaultEmail } from "@/monitoring/email";

/** GET /api/monitoring/settings?organizationId=… */
export async function GET(request: Request) {
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "local-workspace";
  const settings = await monitoringStore.getSettings(organizationId);
  return NextResponse.json({ settings });
}

/** POST /api/monitoring/settings — save thresholds, AI provider, SMTP and admin emails. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<{
      organizationId: string;
      pollingIntervalSeconds: number | string;
      failureThreshold: number | string;
      warningLatencyMs: number | string;
      packetLossThresholdPct: number | string;
      snmpCommunity: string;
      tcpPorts: string;
      tcpPortsEnabled: boolean;
      httpUrls: string;
      dnsHostname: string;
      dnsServer: string;
      aiProvider: string;
      aiModel: string;
      adminEmails: string;
      smtpHost: string;
      smtpPort: number | string;
      smtpSecure: boolean;
      smtpUser: string;
      smtpFrom: string;
    }>;
    const organizationId = body.organizationId ?? "local-workspace";
    const current = await monitoringStore.getSettings(organizationId);
    const toNumber = (value: unknown, fallback: number) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const settings = await monitoringStore.saveSettings({
      ...current,
      pollingIntervalSeconds: toNumber(body.pollingIntervalSeconds, current.pollingIntervalSeconds),
      failureThreshold: toNumber(body.failureThreshold, current.failureThreshold),
      warningLatencyMs: toNumber(body.warningLatencyMs, current.warningLatencyMs),
      packetLossThresholdPct: toNumber(body.packetLossThresholdPct, current.packetLossThresholdPct),
      snmpCommunity: body.snmpCommunity ?? current.snmpCommunity,
      tcpPorts: body.tcpPorts ?? current.tcpPorts,
      tcpPortsEnabled: body.tcpPortsEnabled ?? current.tcpPortsEnabled,
      httpUrls: body.httpUrls ?? current.httpUrls,
      dnsHostname: body.dnsHostname ?? current.dnsHostname,
      dnsServer: body.dnsServer ?? current.dnsServer,
      aiProvider: body.aiProvider ?? current.aiProvider,
      aiModel: body.aiModel ?? current.aiModel,
      adminEmails: body.adminEmails ?? current.adminEmails,
      smtpHost: body.smtpHost ?? current.smtpHost,
      smtpPort: toNumber(body.smtpPort, current.smtpPort),
      smtpSecure: body.smtpSecure ?? current.smtpSecure,
      smtpUser: body.smtpUser ?? current.smtpUser,
      smtpFrom: body.smtpFrom ?? current.smtpFrom,
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save settings" }, { status: 400 });
  }
}

/**
 * PUT /api/monitoring/settings — send a live test email to the administrators.
 * Confirms end-to-end SMTP delivery straight from the settings screen.
 */
export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { organizationId?: string };
    const organizationId = body.organizationId ?? "local-workspace";
    const settings = await monitoringStore.getSettings(organizationId);
    const to = parseRecipients(settings.adminEmails);
    const result = await sendFaultEmail({
      settings,
      to,
      subject: "[NetMoni] Test notification — monitoring email channel is live",
      body: [
        "This is a test notification from your NetMoni monitoring workspace.",
        "",
        `SMTP host: ${settings.smtpHost}:${settings.smtpPort} (${settings.smtpSecure ? "implicit TLS" : "STARTTLS/plain"})`,
        `AI composer: ${settings.aiProvider} / ${settings.aiModel}`,
        "",
        "If you received this message, fault alerts for unreachable or degraded devices will arrive on this address with the full diagnosis and on-site action list.",
      ].join("\n"),
    });
    return NextResponse.json(result, { status: result.sent ? 200 : 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Test email failed" }, { status: 500 });
  }
}
