import nodemailer from "nodemailer";

export type SmtpConfig = { host: string; port: number; secure: boolean; user: string; password: string; from?: string };

export function smtpConfigFromEnv(): SmtpConfig | null {
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  if (!user || !password) return null;
  return {
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: (process.env.SMTP_SECURE ?? "true") === "true",
    user,
    password,
    from: process.env.SMTP_FROM ?? user,
  };
}

export function renderTemplate(template: string, values: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const resolved = key.split(".").reduce<unknown>((acc, part) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[part] : undefined), values);
    return resolved === undefined || resolved === null ? "" : String(resolved);
  });
}

export async function sendFaultEmail(config: SmtpConfig, input: { to: string; subject: string; text: string }): Promise<{ messageId: string; accepted: string[] }> {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
  });
  try {
    const info = await transporter.sendMail({
      from: config.from ?? config.user,
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
    return { messageId: info.messageId, accepted: (info.accepted ?? []).map((entry) => (typeof entry === "string" ? entry : String(entry))) };
  } finally {
    transporter.close();
  }
}
