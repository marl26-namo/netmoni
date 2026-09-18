import { workflowRepository } from "@/core/runtime";

export function inspectWorkspace() {
  return { workflows: workflowRepository.list(), version: "0.1.0" };
}
