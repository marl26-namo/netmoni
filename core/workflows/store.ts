import type { Workflow } from "@/core/types";

export class WorkflowStore {
  private readonly workflows = new Map<string, Workflow>();

  save(workflow: Workflow) {
    this.workflows.set(workflow.id, workflow);
    return workflow;
  }

  get(id: string) {
    return this.workflows.get(id);
  }

  list() {
    return [...this.workflows.values()];
  }
}
