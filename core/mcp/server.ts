import { capabilityRegistry } from "@/core/registry";
import { automationEngine } from "@/core/registry";
import { publishEvent, workflowRepository } from "@/core/runtime";

export const MCP_PROTOCOL_VERSION = "2025-06-18";

export type JsonRpcRequest = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };

type JsonRpcResponse = { jsonrpc: "2.0"; id: string | number | null; result?: unknown; error?: { code: number; message: string; data?: unknown } };

const toolDefinitions = [
  { name: "netmoni_list_workflows", description: "List workflows available in this NetMoni workspace.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "netmoni_emit_event", description: "Publish an event and run every enabled workflow subscribed to it.", inputSchema: { type: "object", properties: { type: { type: "string", description: "Event name, for example customer.created" }, payload: { type: "object", additionalProperties: true }, source: { type: "string" } }, required: ["type"], additionalProperties: false } },
  { name: "netmoni_list_executions", description: "List workflow execution history, optionally filtered by workflow id.", inputSchema: { type: "object", properties: { workflowId: { type: "string" } }, additionalProperties: false } },
  { name: "netmoni_list_capabilities", description: "List the business capabilities registered with the automation engine.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
];

function response(id: JsonRpcRequest["id"], result: unknown): JsonRpcResponse { return { jsonrpc: "2.0", id: id ?? null, result }; }
function error(id: JsonRpcRequest["id"], code: number, message: string, data?: unknown): JsonRpcResponse { return { jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data === undefined ? {} : { data }) } }; }
function textResult(value: unknown, isError = false) { return { content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value, ...(isError ? { isError: true } : {}) }; }

export async function handleMcpRequest(request: JsonRpcRequest): Promise<JsonRpcResponse | null> {
  if (request.jsonrpc !== "2.0" || !request.method) return error(request.id, -32600, "Invalid JSON-RPC request");
  if (request.id === undefined && request.method.startsWith("notifications/")) return null;

  if (request.method === "initialize") {
    return response(request.id, { protocolVersion: MCP_PROTOCOL_VERSION, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "netmoni", version: "0.1.0" }, instructions: "Use NetMoni tools to inspect workflows and emit business events." });
  }
  if (request.method === "notifications/initialized") return null;
  if (request.method === "ping") return response(request.id, {});
  if (request.method === "tools/list") return response(request.id, { tools: toolDefinitions });
  if (request.method !== "tools/call") return error(request.id, -32601, `Method not found: ${request.method}`);

  const params = request.params ?? {};
  const name = typeof params.name === "string" ? params.name : "";
  const argumentsValue = params.arguments && typeof params.arguments === "object" ? params.arguments as Record<string, unknown> : {};
  try {
    if (name === "netmoni_list_workflows") return response(request.id, textResult(await workflowRepository.list()));
    if (name === "netmoni_list_capabilities") return response(request.id, textResult(capabilityRegistry.list()));
    if (name === "netmoni_list_executions") {
      const workflowId = typeof argumentsValue.workflowId === "string" ? argumentsValue.workflowId : undefined;
      return response(request.id, textResult(automationEngine.executions.list(workflowId)));
    }
    if (name === "netmoni_emit_event") {
      const type = typeof argumentsValue.type === "string" ? argumentsValue.type : "";
      if (!type) return response(request.id, textResult({ error: "arguments.type is required" }, true));
      const payload = argumentsValue.payload && typeof argumentsValue.payload === "object" ? argumentsValue.payload as Record<string, unknown> : {};
      const source = typeof argumentsValue.source === "string" ? argumentsValue.source : "mcp";
      return response(request.id, textResult(await publishEvent(type, payload, source)));
    }
    return response(request.id, textResult({ error: `Unknown tool: ${name}` }, true));
  } catch (caught) {
    return response(request.id, textResult({ error: caught instanceof Error ? caught.message : "Tool execution failed" }, true));
  }
}
