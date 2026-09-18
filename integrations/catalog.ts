import type { Connector } from "@/core/types";
import { databaseConnectors } from "@/connectors/database";
export { integrationDefinitions } from "@/integrations/definitions";
export type { IntegrationDefinition, IntegrationAuth, IntegrationCategory } from "@/integrations/definitions";

export const integrationCatalog: Connector[] = [...databaseConnectors, { id: "rest", name: "REST API", kind: "http", config: {} }, { id: "s3", name: "Object storage", kind: "storage", config: {} }, { id: "queue", name: "Message queue", kind: "queue", config: {} }];
