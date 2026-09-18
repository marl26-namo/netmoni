import { integrationDefinitions } from "@/integrations/definitions";

type SavedConnection = { id: string; organizationId: string; integrationId: string; name: string; auth: string; status: "connected" | "needs-credentials"; variableNames: string[]; createdAt: string };
const connections = new Map<string, SavedConnection>();
const secrets = new Map<string, Record<string, string>>();

export function saveConnection(input: { organizationId: string; integrationId: string; name?: string; credentials?: Record<string, string>; variables?: Record<string, string> }) {
  const definition = integrationDefinitions.find((item) => item.id === input.integrationId);
  if (!definition) throw new Error("Integration not found");
  const id = `${input.organizationId}:${input.integrationId}`;
  const credentials = input.credentials ?? {};
  const variables = input.variables ?? {};
  const hasCredentials = Object.values(credentials).some((value) => value.trim().length > 0);
  const connection = { id, organizationId: input.organizationId, integrationId: definition.id, name: input.name || definition.name, auth: definition.auth, status: hasCredentials || definition.status === "adapter-ready" ? "connected" : "needs-credentials", variableNames: Object.keys(variables), createdAt: new Date().toISOString() } as SavedConnection;
  connections.set(id, connection);
  secrets.set(id, { ...credentials, ...variables });
  return connection;
}

export function listConnections(organizationId: string) { return [...connections.values()].filter((connection) => connection.organizationId === organizationId); }
export function getConnectionSecret(organizationId: string, integrationId: string, key: string) { return secrets.get(`${organizationId}:${integrationId}`)?.[key]; }
