import { randomUUID } from "node:crypto";
import { automationEngine, capabilityRegistry, eventBus } from "@/core/registry";
import { createWorkflow } from "@/core/workflows/definition";
import { WorkflowRepository } from "@/db/repositories/workflow-repository";
import { builtInCapabilities } from "@/nodes";
import type { Event } from "@/core/types";

export const workflowRepository = new WorkflowRepository();

for (const capability of builtInCapabilities) {
  capabilityRegistry.register(capability);
  automationEngine.registerCapability(capability, async (input) => ({ ...input, accepted: true, id: randomUUID() }));
}

if (!workflowRepository.findById("customer-onboarding")) {
  workflowRepository.save(createWorkflow({
    id: "customer-onboarding",
    name: "Customer onboarding",
    description: "Create a workspace record and send a welcome email.",
    trigger: { event: "customer.created" },
    nodes: [
      { id: "create-record", kind: "action", name: "Create record", capability: "create_record", config: { resource: "sqlite" } },
      { id: "welcome-email", kind: "action", name: "Send welcome email", capability: "send_http_request" },
    ],
  }));
}

export async function publishEvent(type: string, payload: Record<string, unknown>, source = "api") {
  const event: Event = { id: randomUUID(), type, payload, source, occurredAt: new Date().toISOString() };
  await eventBus.publish(event);
  const workflows = workflowRepository.list().filter((workflow) => workflow.enabled && workflow.trigger.event === type);
  const executions = await Promise.all(workflows.map((workflow) => automationEngine.execute(workflow, event)));
  return { event, executions };
}
