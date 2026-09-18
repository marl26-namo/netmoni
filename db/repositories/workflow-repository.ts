import type { Workflow } from "@/core/types";
import { WorkflowStore } from "@/core/workflows/store";

export class WorkflowRepository {
  constructor(private readonly store = new WorkflowStore()) {}
  findById(id: string) { return this.store.get(id); }
  list() { return this.store.list(); }
  save(workflow: Workflow) { return this.store.save(workflow); }
}
