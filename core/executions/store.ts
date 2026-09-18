import type { Execution } from "@/core/types";

export class ExecutionStore {
  private readonly executions = new Map<string, Execution>();

  save(execution: Execution) {
    this.executions.set(execution.id, execution);
    return execution;
  }

  get(id: string) {
    return this.executions.get(id);
  }

  list(workflowId?: string) {
    return [...this.executions.values()].filter((execution) => !workflowId || execution.workflowId === workflowId);
  }
}
