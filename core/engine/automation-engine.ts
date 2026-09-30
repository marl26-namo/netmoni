import { randomUUID } from "node:crypto";
import type { Capability, Event, Execution, Workflow } from "@/core/types";
import { ExecutionStore } from "@/core/executions/store";
import { validateWorkflow } from "@/core/workflows/definition";

export type CapabilityHandler = (input: Record<string, unknown>, event: Event) => Promise<Record<string, unknown>>;

export class AutomationEngine {
  private readonly handlers = new Map<string, CapabilityHandler>();
  readonly executions = new ExecutionStore();

  registerCapability(capability: Capability, handler: CapabilityHandler) {
    this.handlers.set(capability.name, handler);
  }

  async execute(workflow: Workflow, event: Event): Promise<Execution> {
    validateWorkflow(workflow);
    const execution: Execution = { id: randomUUID(), workflowId: workflow.id, status: "running", input: event.payload, startedAt: new Date().toISOString() };
    this.executions.save(execution);
    try {
      let output = event.payload;
      for (const node of workflow.nodes) {
        if (!node.capability) continue;
        if (node.kind === "logic") {
          const condition = String((node.config as Record<string, unknown> | undefined)?.condition ?? "");
          const status = String(output.status ?? "");
          const severity = String(output.severity ?? "");
          const passes = !condition || /offline|critical/i.test(condition) ? status === "Offline" || severity.toLowerCase() === "critical" : true;
          if (!passes) break;
          continue;
        }
        const handler = this.handlers.get(node.capability);
        if (!handler) throw new Error(`Capability not registered: ${node.capability}`);
        output = await handler({ ...output, ...(node.config ?? {}) }, event);
      }
      const finished: Execution = { ...execution, status: "succeeded", output, finishedAt: new Date().toISOString() };
      return this.executions.save(finished);
    } catch (error) {
      const failed: Execution = { ...execution, status: "failed", error: error instanceof Error ? error.message : "Unknown execution error", finishedAt: new Date().toISOString() };
      return this.executions.save(failed);
    }
  }
}
