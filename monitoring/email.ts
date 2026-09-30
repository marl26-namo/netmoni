import nodemailer from "nodemailer";
import type { MonitoringSettings } from "@/monitoring/types";

/**
 * SMTP dispatch of administrator fault notifications. Credentials come from
 * the organization's monitoring settings (SMTP user/app password) with the
 * platform environment (SMTP_USER / SMTP_PASS) as fallback.
 */

export type DispatchResult = { sent: boolean; messageId?: string; recipients: string; error?: string };

export function parseRecipients(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(/[\s,;]+/)
    .map((value) => value.trim())
    .filter((value) => value.includes("@"));
}

export async function sendFaultEmail(options: {
  settings: MonitoringSettings;
  to: string[];
  subject: string;
  body: string;
}): Promise<DispatchResult> {
  const { settings, to, subject, body } = options;
  if (!to.length) return { sent: false, recipients: "", error: "No administrator email address configured" };

  const user = settings.smtpUser || process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.GMAIL_APP_PASSWORD;
  const from = settings.smtpFrom || user || process.env.SMTP_FROM || user;
  if (!user || !pass) {
    return {
      sent: false,
      recipients: to.join(", "),
      error: "SMTP credentials missing — set the SMTP user and app password in Monitoring settings (or SMTP_USER/SMTP_PASS env)",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost || "smtp.gmail.com",
      port: settings.smtpPort || 465,
      secure: settings.smtpSecure ?? true,
      auth: { user, pass },
    });
    const info = await transporter.sendMail({
      from: from ? (from.includes("<") ? from : `"NetMoni Monitoring" <${from}>`) : `"NetMoni Monitoring" <${user}>`,
      to: to.join(", "),
      subject,
      text: body,
    });
    return { sent: true, messageId: info.messageId, recipients: to.join(", ") };
  } catch (error) {
    return { sent: false, recipients: to.join(", "), error: error instanceof Error ? error.message : "SMTP dispatch failed" };
  }
}
