import type { Event, Workflow } from "@/core/types";

export class SoftcapeClient {
  constructor(private readonly baseUrl = "") {}

  async emit(type: string, payload: Record<string, unknown>) {
    const response = await fetch(`${this.baseUrl}/api/events`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, payload }) });
    if (!response.ok) throw new Error(`Softcape event failed with ${response.status}`);
    return response.json() as Promise<{ event: Event }>;
  }

  async workflows() {
    const response = await fetch(`${this.baseUrl}/api/automations`);
    return response.json() as Promise<{ workflows: Workflow[] }>;
  }
}
