import type { Workflow } from "@/core/types";

export function validateWorkflow(workflow: Workflow) {
  if (!workflow.id || !workflow.name) throw new Error("A workflow requires an id and name");
  if (!workflow.trigger.event) throw new Error("A workflow requires an event trigger");
  if (workflow.nodes.length === 0) throw new Error("A workflow requires at least one node");
  return workflow;
}

export function createWorkflow(input: Pick<Workflow, "id" | "name" | "description" | "trigger" | "nodes">): Workflow {
  const now = new Date().toISOString();
  return validateWorkflow({ ...input, enabled: true, createdAt: now, updatedAt: now });
}
