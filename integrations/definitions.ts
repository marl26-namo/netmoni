export type IntegrationCategory = "payments" | "banking" | "messaging" | "google" | "collaboration" | "ai" | "accounting" | "generic";
export type IntegrationAuth = "api-key" | "oauth2" | "basic" | "custom";

export type IntegrationDefinition = {
  id: string;
  name: string;
  category: IntegrationCategory;
  region: "malawi" | "global";
  description: string;
  auth: IntegrationAuth;
  actions: string[];
  status: "adapter-ready" | "custom-credentials";
  setup: string;
  fields: string[];
};

const apiKeySetup = { setup: "API key or access token", fields: ["apiKey", "baseUrl"] };
const oauthSetup = { setup: "Sign in with OAuth", fields: ["oauthAccount"] };
const customSetup = { setup: "Organization-provided credentials", fields: ["apiKey", "baseUrl", "variables"] };

export const integrationDefinitions: IntegrationDefinition[] = [
  { id: "airtel-money-mw", name: "Airtel Money Malawi", category: "payments", region: "malawi", description: "Mobile money collections, disbursements, and transaction status.", auth: "custom", actions: ["collect payment", "send money", "check transaction"], status: "custom-credentials", ...customSetup },
  { id: "tnm-mpamba", name: "TNM Mpamba", category: "payments", region: "malawi", description: "Mpamba payment and disbursement workflows through your approved access.", auth: "custom", actions: ["collect payment", "send money", "check transaction"], status: "custom-credentials", ...customSetup },
  { id: "nbm", name: "National Bank of Malawi", category: "banking", region: "malawi", description: "Bank account and payment workflows for approved organization integrations.", auth: "custom", actions: ["payment instruction", "account lookup", "transaction status"], status: "custom-credentials", ...customSetup },
  { id: "fdh-bank", name: "FDH Bank", category: "banking", region: "malawi", description: "Banking and payment workflows using organization-provided access.", auth: "custom", actions: ["payment instruction", "account lookup", "transaction status"], status: "custom-credentials", ...customSetup },
  { id: "nbs-bank", name: "NBS Bank", category: "banking", region: "malawi", description: "Banking workflows for approved API or host-to-host access.", auth: "custom", actions: ["payment instruction", "account lookup", "transaction status"], status: "custom-credentials", ...customSetup },
  { id: "standard-bank-mw", name: "Standard Bank Malawi", category: "banking", region: "malawi", description: "Enterprise banking workflows using approved organization access.", auth: "custom", actions: ["payment instruction", "account lookup", "transaction status"], status: "custom-credentials", ...customSetup },
  { id: "whatsapp-cloud", name: "WhatsApp Cloud API", category: "messaging", region: "global", description: "Send templates, messages, and receive webhook events.", auth: "api-key", actions: ["send message", "send template", "receive webhook"], status: "adapter-ready", ...apiKeySetup },
  { id: "sms-http", name: "SMS gateway", category: "messaging", region: "global", description: "Connect any SMS provider through its HTTP API.", auth: "api-key", actions: ["send SMS", "check delivery"], status: "adapter-ready", ...apiKeySetup },
  { id: "gmail", name: "Gmail", category: "google", region: "global", description: "Send, search, and label email from workflows.", auth: "oauth2", actions: ["send email", "search email", "add label"], status: "adapter-ready", ...oauthSetup },
  { id: "google-drive", name: "Google Drive", category: "google", region: "global", description: "Create, find, and move files in shared drives.", auth: "oauth2", actions: ["upload file", "find file", "create folder"], status: "adapter-ready", ...oauthSetup },
  { id: "google-sheets", name: "Google Sheets", category: "google", region: "global", description: "Read and write rows in organization spreadsheets.", auth: "oauth2", actions: ["append row", "read rows", "update row"], status: "adapter-ready", ...oauthSetup },
  { id: "slack", name: "Slack", category: "collaboration", region: "global", description: "Post messages and react to workspace events.", auth: "oauth2", actions: ["send message", "create channel", "add reaction"], status: "adapter-ready", ...oauthSetup },
  { id: "openai", name: "OpenAI", category: "ai", region: "global", description: "Use organization-managed models in automation steps.", auth: "api-key", actions: ["generate text", "classify", "extract JSON"], status: "adapter-ready", setup: "API key, model, and optional base URL", fields: ["apiKey", "model", "baseUrl"] },
  { id: "anthropic", name: "Anthropic", category: "ai", region: "global", description: "Use organization-managed Claude models in workflows.", auth: "api-key", actions: ["generate text", "classify", "extract JSON"], status: "adapter-ready", setup: "API key, model, and optional base URL", fields: ["apiKey", "model", "baseUrl"] },
  { id: "google-gemini", name: "Google Gemini", category: "ai", region: "global", description: "Use Gemini models with organization credentials.", auth: "api-key", actions: ["generate text", "classify", "extract JSON"], status: "adapter-ready", setup: "API key and model", fields: ["apiKey", "model"] },
  { id: "quickbooks", name: "QuickBooks Online", category: "accounting", region: "global", description: "Sync customers, invoices, payments, and expenses.", auth: "oauth2", actions: ["create invoice", "find customer", "record payment"], status: "adapter-ready", ...oauthSetup },
  { id: "xero", name: "Xero", category: "accounting", region: "global", description: "Connect accounting records and reconciliation workflows.", auth: "oauth2", actions: ["create invoice", "find contact", "record payment"], status: "adapter-ready", ...oauthSetup },
  { id: "accounting-http", name: "Accounting package API", category: "accounting", region: "global", description: "Connect Sage or another accounting package through its API.", auth: "custom", actions: ["create record", "sync records", "send invoice"], status: "custom-credentials", ...customSetup },
];
