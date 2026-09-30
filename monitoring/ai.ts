import type { Alert } from "@/monitoring/types";
import { alertEmailSubject } from "@/monitoring/analyzer";

/**
 * AI incident-message composer. When the organization has configured an AI
 * provider key, the raw fault facts are sent to the model to produce a clear,
 * plain-language administrator message ("what happened, what to check, and to
 * travel to the device location"). Any failure falls back to the deterministic
 * message so alerting never depends on AI availability.
 */

type AiConfig = { provider: string; model: string };

export type ComposedMessage = { subject: string; body: string; composedBy: "ai" | "deterministic"; provider?: string; error?: string };

const SYSTEM_PROMPT = [
  "You are a senior network operations engineer writing incident notifications.",
  "Given the monitoring facts below, write an email to the on-site administrator.",
  "Requirements:",
  "1. Start with a one-paragraph, jargon-free explanation of what is wrong and the customer impact.",
  "2. Then a short 'Evidence' list quoting the probe results.",
  "3. Then an 'Action required' section that explicitly instructs the administrator to GO TO THE DEVICE LOCATION and lists concrete on-site checks (power, cabling, link lights, upstream port, device reboot, firewall/ACL).",
  "4. Close with severity and a suggested response time (critical: immediately; warning: same day).",
  "Be concise, factual, and professional. Plain text only — no markdown symbols.",
].join(" ");

function factsFor(alert: Pick<Alert, "deviceName" | "ipAddress" | "severity" | "status" | "probesFailed" | "latencyMs" | "packetLossPct" | "summary" | "evidence" | "recommendation">): string {
  return [
    `Device: ${alert.deviceName}`,
    `IP: ${alert.ipAddress}`,
    `Severity: ${alert.severity}`,
    `Monitoring status: ${alert.status}`,
    `Failed probes: ${alert.probesFailed.join(", ") || "none"}`,
    `Latency: ${alert.latencyMs !== undefined ? `${alert.latencyMs} ms` : "n/a"}`,
    `Packet loss: ${alert.packetLossPct !== undefined ? `${alert.packetLossPct}%` : "n/a"}`,
    ``,
    `Diagnosis:`,
    alert.summary,
    ``,
    `Evidence:`,
    ...alert.evidence.map((line) => `- ${line}`),
    ``,
    `Baseline recommendation:`,
    alert.recommendation,
  ].join("\n");
}

async function callGemini(model: string, apiKey: string, facts: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${SYSTEM_PROMPT}\n\n---\n${facts}` }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 900 },
      }),
    },
  );
  if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);
  const data = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) throw new Error("Gemini returned an empty response");
  return text;
}

async function callOpenAiCompatible(model: string, apiKey: string, facts: string, baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: 900,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: facts },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Provider returned an empty response");
  return text;
}

async function callAnthropic(model: string, apiKey: string, facts: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model,
      max_tokens: 900,
      temperature: 0.3,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: facts }],
    }),
  });
  if (!response.ok) throw new Error(`Anthropic HTTP ${response.status}`);
  const data = (await response.json()) as { content?: Array<{ text?: string }> };
  const text = data.content?.map((block) => block.text ?? "").join("").trim();
  if (!text) throw new Error("Anthropic returned an empty response");
  return text;
}

export async function composeIncidentMessage(alert: Alert, config: AiConfig): Promise<ComposedMessage> {
  const fallback: ComposedMessage = {
    subject: alertEmailSubject(alert),
    body: [
      alert.summary,
      ``,
      `Evidence:`,
      ...alert.evidence.map((line) => ` - ${line}`),
      ``,
      `Action required:`,
      alert.recommendation,
    ].join("\n"),
    composedBy: "deterministic" as const,
  };

  const provider = config.provider.toLowerCase();
  const keys: Record<string, string | undefined> = {
    gemini: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    groq: process.env.GROQ_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    mistral: process.env.MISTRAL_API_KEY,
  };
  const apiKey = keys[provider];
  if (!apiKey) return { ...fallback, error: `No ${config.provider} API key configured — used the deterministic fault message.` };

  const facts = factsFor(alert);
  try {
    let text: string;
    if (provider === "gemini") text = await callGemini(config.model || "gemini-2.5-flash", apiKey, facts);
    else if (provider === "anthropic") text = await callAnthropic(config.model || "claude-sonnet-4-5", apiKey, facts);
    else if (provider === "openai") text = await callOpenAiCompatible(config.model || "gpt-4o-mini", apiKey, facts, "https://api.openai.com/v1");
    else if (provider === "groq") text = await callOpenAiCompatible(config.model || "llama-3.3-70b-versatile", apiKey, facts, "https://api.groq.com/openai/v1");
    else if (provider === "mistral") text = await callOpenAiCompatible(config.model || "mistral-large-latest", apiKey, facts, "https://api.mistral.ai/v1");
    else return { ...fallback, error: `Unknown AI provider "${config.provider}" — used the deterministic fault message.` };
    return { subject: alertEmailSubject(alert), body: text, composedBy: "ai", provider: config.provider };
  } catch (error) {
    return { ...fallback, error: `AI composition failed (${error instanceof Error ? error.message : "unknown"}), used the deterministic fault message.` };
  }
}
