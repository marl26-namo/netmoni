/**
 * Email delivery for the notification module (proposal §3.2.2e).
 *
 * Uses Resend when RESEND_API_KEY is configured. Without a key the sender
 * degrades gracefully: alerts are still persisted in-app and every attempt
 * is logged, so the monitoring pipeline never breaks on email.
 */
import { monitoringStore } from "@/core/monitoring/store";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const FROM_ADDRESS = process.env.RESEND_FROM ?? "MUBAS NetWatch <onboarding@resend.dev>";

export type EmailResult = { sent: boolean; provider: "resend" | "skipped" | "failed"; id?: string; error?: string };

export async function sendAdminEmail(to: string | string[], subject: string, body: string): Promise<EmailResult> {
  const recipients = Array.isArray(to) ? to : [to];
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    await monitoringStore.logEvent({
      id: crypto.randomUUID(),
      kind: "email_skipped",
      message: `Email skipped (no RESEND_API_KEY): "${subject}" → ${recipients.join(", ")}`,
      payload: { subject, recipients, body },
    });
    return { sent: false, provider: "skipped", error: "RESEND_API_KEY not configured" };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: FROM_ADDRESS, to: recipients, subject, text: body }),
    });
    const data = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok) {
      await monitoringStore.logEvent({
        id: crypto.randomUUID(),
        kind: "email_failed",
        message: `Email failed: ${data.message ?? response.statusText}`,
        payload: { subject, recipients },
      });
      return { sent: false, provider: "failed", error: data.message ?? `HTTP ${response.status}` };
    }
    await monitoringStore.logEvent({
      id: crypto.randomUUID(),
      kind: "email_sent",
      message: `Email sent: "${subject}" → ${recipients.join(", ")}`,
      payload: { subject, recipients, providerId: data.id },
    });
    return { sent: true, provider: "resend", id: data.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email error";
    await monitoringStore.logEvent({ id: crypto.randomUUID(), kind: "email_failed", message: `Email error: ${message}`, payload: { subject, recipients } });
    return { sent: false, provider: "failed", error: message };
  }
}
