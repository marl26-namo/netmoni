import { NextResponse } from "next/server";
import { sessionWorkspaceId } from "@/auth/store";
import { renderTemplate, sendFaultEmail, smtpConfigFromEnv } from "@/core/monitoring/mailer";
import { tenantMonitorStore } from "@/core/monitoring/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const smtp = smtpConfigFromEnv();
  return NextResponse.json({
    smtpConfigured: Boolean(smtp),
    host: smtp?.host ?? "smtp.gmail.com",
    port: smtp?.port ?? 465,
    secure: smtp?.secure ?? true,
    user: smtp?.user ?? null,
    from: smtp?.from ?? null,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { to?: string; subject?: string; message?: string; values?: Record<string, unknown>; alertId?: string };
    const smtp = smtpConfigFromEnv();
    if (!smtp) return NextResponse.json({ error: "SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASSWORD in the environment." }, { status: 400 });
    const to = body.to?.trim();
    if (!to) return NextResponse.json({ error: "A recipient email address is required" }, { status: 400 });
    const values = { ...(body.values ?? {}) };
    const subject = renderTemplate(body.subject?.trim() || "[Network Alert] {{deviceName}} is {{status}}", values);
    const text = body.message?.trim() || "Network fault detected. Please investigate the affected node.";
    const sent = await sendFaultEmail(smtp, { to, subject, text });
    if (body.alertId) await tenantMonitorStore.updateAlertEmailStatus(sessionWorkspaceId(request), body.alertId, "sent");
    return NextResponse.json({ sent: true, messageId: sent.messageId, accepted: sent.accepted });
  } catch (error) {
    return NextResponse.json({ sent: false, error: error instanceof Error ? error.message : "SMTP dispatch failed" }, { status: 502 });
  }
}
