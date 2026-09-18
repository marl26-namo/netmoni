import { publishEvent } from "@/core/runtime";

export class ExecutionWorker {
  async process(eventType: string, payload: Record<string, unknown>) {
    return publishEvent(eventType, payload, "worker");
  }
}
