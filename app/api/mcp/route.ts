import { NextResponse } from "next/server";
import { handleMcpRequest, MCP_PROTOCOL_VERSION } from "@/core/mcp/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, mcp-protocol-version, mcp-session-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function authorized(request: Request) {
  const expected = process.env.MCP_API_KEY;
  if (!expected) return true;
  return request.headers.get("authorization") === `Bearer ${expected}` || request.headers.get("x-api-key") === expected;
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized" } }, { status: 401, headers: corsHeaders });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400, headers: corsHeaders }); }
  const result = await handleMcpRequest(body as Parameters<typeof handleMcpRequest>[0]);
  if (!result) return new NextResponse(null, { status: 202, headers: corsHeaders });
  return NextResponse.json(result, { headers: { ...corsHeaders, "MCP-Protocol-Version": request.headers.get("mcp-protocol-version") ?? MCP_PROTOCOL_VERSION } });
}

export function OPTIONS() { return new NextResponse(null, { status: 204, headers: corsHeaders }); }

export function GET() { return NextResponse.json({ name: "softcape", transport: "Streamable HTTP", endpoint: "/api/mcp", protocolVersion: MCP_PROTOCOL_VERSION }, { headers: corsHeaders }); }
