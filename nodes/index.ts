import type { Capability } from "@/core/types";

export const builtInCapabilities: Capability[] = [
  { name: "create_record", description: "Create a record in a connected resource", input: { resource: "string", data: "object" }, output: { id: "string" } },
  { name: "send_http_request", description: "Send an HTTP request to an external service", input: { url: "string", method: "string" }, output: { status: "number", body: "object" } },
  { name: "log_event", description: "Publish an event back to the Softcape event bus", input: { event: "string", payload: "object" }, output: { accepted: "boolean" } },
];
