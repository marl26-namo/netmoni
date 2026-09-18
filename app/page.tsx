"use client";

import { useState, type FormEvent } from "react";
import { integrationDefinitions } from "@/integrations/definitions";

type NodeType = "trigger" | "action" | "logic";

type WorkflowNode = {
  id: string;
  type: NodeType;
  name: string;
  description: string;
  icon: string;
  x: number;
  y: number;
};
type EntryStage = "login" | "organization" | "database" | "editor";
type EditorSection =
  | "Overview"
  | "Workflows"
  | "Executions"
  | "Templates"
  | "Integrations"
  | "APIs"
  | "MCP"
  | "Settings";
type LibraryNode = {
  type: NodeType;
  name: string;
  description: string;
  icon: string;
};

const initialNodes: WorkflowNode[] = [
  {
    id: "1",
    type: "trigger",
    name: "Gmail Trigger",
    description: "Gmail Trigger",
    icon: "✉",
    x: 520,
    y: 210,
  },
];

const nodeLibrary = [
  {
    type: "trigger" as NodeType,
    name: "Gmail Trigger",
    description: "Start when a Gmail event occurs",
    icon: "✉",
  },
  {
    type: "trigger" as NodeType,
    name: "Webhook",
    description: "Start from an incoming webhook",
    icon: "⌁",
  },
  {
    type: "trigger" as NodeType,
    name: "Schedule",
    description: "Run automatically on a schedule",
    icon: "◷",
  },
  {
    type: "action" as NodeType,
    name: "HTTP Request",
    description: "Call an external API",
    icon: "↗",
  },
  {
    type: "action" as NodeType,
    name: "PostgreSQL",
    description: "Query your database",
    icon: "DB",
  },
  {
    type: "action" as NodeType,
    name: "Send Email",
    description: "Send an email",
    icon: "✉",
  },
  {
    type: "action" as NodeType,
    name: "Code",
    description: "Run custom JavaScript",
    icon: "</>",
  },
  {
    type: "logic" as NodeType,
    name: "IF",
    description: "Create a conditional branch",
    icon: "IF",
  },
  {
    type: "logic" as NodeType,
    name: "Switch",
    description: "Route data into branches",
    icon: "◇",
  },
];
const integrationNodes: LibraryNode[] = integrationDefinitions.map(
  (integration) => ({
    type: "action",
    name: integration.name,
    description: `${integration.setup} · ${integration.actions.slice(0, 2).join(", ")}`,
    icon:
      integration.category === "ai"
        ? "AI"
        : integration.name.slice(0, 2).toUpperCase(),
  }),
);
const allNodeLibrary: LibraryNode[] = [...nodeLibrary, ...integrationNodes];

export default function WorkflowEditor() {
  const [entryStage, setEntryStage] = useState<EntryStage>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [confirmOwnerPassword, setConfirmOwnerPassword] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [currentUser, setCurrentUser] = useState({ name: "", email: "" });
  const [organizationDbUrl, setOrganizationDbUrl] = useState(
    "file:./organization.db",
  );
  const [entryError, setEntryError] = useState("");
  const [entryBusy, setEntryBusy] = useState(false);
  const [nodes, setNodes] = useState(initialNodes);
  const [selectedNode, setSelectedNode] = useState("1");
  const [zoom, setZoom] = useState(100);
  const [running, setRunning] = useState(false);
  const [published, setPublished] = useState(false);
  const [search, setSearch] = useState("");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [activeSection, setActiveSection] = useState<EditorSection>("Workflows");
  const [credentialIntegration, setCredentialIntegration] = useState("whatsapp-cloud");
  const [credentialName, setCredentialName] = useState("WhatsApp workspace key");
  const [credentialApiKey, setCredentialApiKey] = useState("");
  const [credentialModel, setCredentialModel] = useState("gpt-4o-mini");
  const [credentialBaseUrl, setCredentialBaseUrl] = useState("https://graph.facebook.com");
  const [credentialVariables, setCredentialVariables] = useState("PHONE_NUMBER_ID=\nBUSINESS_ACCOUNT_ID=");
  const [credentialState, setCredentialState] = useState("");
  const [apiEndpoint, setApiEndpoint] = useState("https://api.example.com/v1");
  const [apiMethod, setApiMethod] = useState("POST");
  const [apiState, setApiState] = useState("");
  const [mcpEnabled, setMcpEnabled] = useState(true);
  const [mcpAutoExpose, setMcpAutoExpose] = useState(false);
  const [mcpAuthMode, setMcpAuthMode] = useState<"oauth" | "api-key">("oauth");
  const [mcpClient, setMcpClient] = useState("Claude Desktop");
  const [mcpCallbackPolicy, setMcpCallbackPolicy] = useState("all");
  const [mcpCopied, setMcpCopied] = useState(false);
  const selected = nodes.find((node) => node.id === selectedNode);
  const selectSection = (section: EditorSection) => setActiveSection(section);
  const selectedIntegration = integrationDefinitions.find((integration) => integration.id === credentialIntegration) ?? integrationDefinitions[0];
  const selectedCredentialIsAi = selectedIntegration.category === "ai";
  const addNode = (item: LibraryNode) => {
    const id = crypto.randomUUID();
    setNodes((current) => [...current, { id, type: item.type, name: item.name, description: item.description, icon: item.icon, x: 520 + current.length * 40, y: 210 + current.length * 150 }]);
    setSelectedNode(id);
  };
  const executeWorkflow = async () => {
    setRunning(true);
    try { await fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "workflow.execute", payload: { workflowId: "customer-onboarding" } }) }); } finally { window.setTimeout(() => setRunning(false), 1000); }
  };
  const filteredNodes = allNodeLibrary.filter((node) => node.name.toLowerCase().includes(search.toLowerCase()));
  const saveCredential = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setCredentialState("Saving...");
    const variables = Object.fromEntries(credentialVariables.split("\n").map((line) => line.split("=")).filter(([key, value]) => key?.trim() && value !== undefined).map(([key, value]) => [key.trim(), value.trim()]));
    const response = await fetch("/api/integrations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId: organizationId || "organization-owner", integrationId: credentialIntegration, name: credentialName, credentials: { apiKey: credentialApiKey, baseUrl: credentialBaseUrl }, variables: { ...variables, ...(selectedCredentialIsAi ? { MODEL: credentialModel } : {}) } }) });
    setCredentialState(response.ok ? "Saved securely" : "Could not save");
    if (response.ok) setCredentialApiKey("");
  };
  const testApiEndpoint = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setApiState(`${apiMethod} step saved for ${apiEndpoint}`); };
  const renderSectionPanel = () => {
    if (false) {
      return (
        <section className="section-panel credentials-panel">
          <div className="section-panel-inner credential-manager">
            <span className="overline">ORGANIZATION / CREDENTIALS</span>
            <h1>Connect any API</h1>
            <p>
              Store an API key, endpoint, and reusable variables once. Workflow
              nodes can use this connection without exposing the secret.
            </p>
            <div className="provider-requirement">
              <strong>{selectedIntegration.name} setup</strong>
              <span>{selectedIntegration.setup}</span>
              <small>Required fields: {selectedIntegration.fields.join(", ")}</small>
              {selectedIntegration.category === "google" && <small>Google services use OAuth. Connect your Google account once, then choose Gmail, Drive, or Sheets actions separately in workflows.</small>}
              {selectedIntegration.category === "ai" && <small>AI providers require a model name and API key. Add a custom base URL only for compatible gateways.</small>}
            </div>
            <form className="credential-form" onSubmit={saveCredential}>
              <label>
                Integration or app
                <select
                  value={credentialIntegration}
                  onChange={(event) =>
                    setCredentialIntegration(event.target.value)
                  }
                >
                  <option value="whatsapp-cloud">WhatsApp Cloud API</option>
                  <option value="sms-http">SMS gateway</option>
                  <option value="airtel-money-mw">Airtel Money Malawi</option>
                  <option value="tnm-mpamba">TNM Mpamba</option>
                  <option value="gmail">Gmail</option>
                  <option value="google-sheets">Google Sheets</option>
                  <option value="slack">Slack</option>
                  <option value="openai">AI provider</option>
                  <option value="accounting-http">Custom accounting API</option>
                </select>
              </label>
              <label>
                Credential name
                <input
                  value={credentialName}
                  onChange={(event) => setCredentialName(event.target.value)}
                  placeholder="My API connection"
                  required
                />
              </label>
              <label>
                API key or access token
                <input
                  type="password"
                  value={credentialApiKey}
                  onChange={(event) => setCredentialApiKey(event.target.value)}
                  placeholder="Paste secret key"
                />
              </label>
              {selectedCredentialIsAi && <label>
                Model
                <input value={credentialModel} onChange={(event) => setCredentialModel(event.target.value)} placeholder="gpt-4o-mini, claude-3-5-sonnet, gemini-2.0-flash" required />
              </label>}
              {selectedIntegration.auth === "oauth2" && <div className="oauth-notice"><strong>OAuth connection</strong><span>Click connect to authorize this app. Google services share one account connection but expose separate Gmail, Drive, and Sheets workflow nodes.</span></div>}
              <label>
                Base URL
                <input
                  value={credentialBaseUrl}
                  onChange={(event) => setCredentialBaseUrl(event.target.value)}
                  placeholder="https://api.example.com"
                />
              </label>
              <label>
                Variables
                <small>
                  One KEY=value per line. Values are available to workflow
                  expressions.
                </small>
                <textarea
                  value={credentialVariables}
                  onChange={(event) =>
                    setCredentialVariables(event.target.value)
                  }
                  rows={4}
                  placeholder="ACCOUNT_ID=..."
                />
              </label>
              {credentialState && (
                <div className="entry-error">{credentialState}</div>
              )}
              <button className="entry-submit" type="submit">
                Save credential securely <span>{"->"}</span>
              </button>
            </form>
            <div className="credential-note">
              <strong>How this works</strong>
              <span>
                Use expressions like <code>{"{{$json.customerPhone}}"}</code> in
                node fields. Secrets are stored by Softcape and never returned
                to the browser.
              </span>
            </div>
          </div>
        </section>
      );
    }
    if (activeSection === "Integrations") {
      return (
        <section className="section-panel catalog-panel">
          <div className="section-panel-inner wide-panel">
            <span className="overline">ORGANIZATION / INTEGRATIONS</span>
            <h1>Apps and services</h1>
            <p>
              Connect the systems your organization uses, then select their
              credentials inside workflow nodes.
            </p>
            <div className="dashboard-integration-grid">
              {integrationDefinitions.map((integration) => (
                <article
                  className="dashboard-integration-card"
                  key={integration.id}
                >
                  <div className="dashboard-integration-icon">
                    {integration.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <strong>{integration.name}</strong>
                    <small>
                      {integration.category} / {integration.auth}
                    </small>
                    <p>{integration.description}</p>
                  </div>
                  <button onClick={() => { setCredentialIntegration(integration.id); setCredentialName(`${integration.name} connection`); selectSection("Workflows"); }}>
                    Configure
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>
      );
    }
    if (activeSection === "APIs") {
      return (
        <section className="section-panel">
          <div className="section-panel-inner api-panel">
            <span className="overline">ENGINE / API REQUESTS</span>
            <h1>Any API</h1>
            <p>
              Call any REST or JSON API from a workflow with a URL, method,
              headers, credentials, and mapped variables.
            </p>
            <form className="credential-form" onSubmit={testApiEndpoint}>
              <label>
                Request URL
                <input
                  value={apiEndpoint}
                  onChange={(event) => setApiEndpoint(event.target.value)}
                  placeholder="https://api.example.com/v1"
                  required
                />
              </label>
              <label>
                Method
                <select
                  value={apiMethod}
                  onChange={(event) => setApiMethod(event.target.value)}
                >
                  <option>GET</option>
                  <option>POST</option>
                  <option>PUT</option>
                  <option>PATCH</option>
                  <option>DELETE</option>
                </select>
              </label>
              <label>
                Request body
                <textarea
                  rows={4}
                  placeholder={'{"customer": "{{$json.customer}}"}'}
                />
              </label>
              <button className="entry-submit" type="submit">
                Save API step <span>{"->"}</span>
              </button>
              {apiState && <div className="entry-error">{apiState}</div>}
            </form>
          </div>
        </section>
      );
    }
    if (activeSection === "MCP") {
      return (
        <section className="section-panel mcp-page">
          <div className="mcp-page-inner">
            <div className="mcp-page-heading"><div><span className="overline">INSTANCE / MCP</span><h1>Instance level MCP</h1><p>Let AI assistants and IDEs connect to this Softcape instance, then control which tools and workflows they can use.</p></div><span className={`mcp-status ${mcpEnabled ? "on" : ""}`}><i />{mcpEnabled ? "Connected" : "Disabled"}</span></div>
            <section className="mcp-section"><div className="mcp-section-heading"><div><h2>Connection details</h2><p>Connect AI assistants and IDEs like Claude, Cursor, and ChatGPT to this instance over MCP.</p></div><label className="switch-row"><input type="checkbox" checked={mcpEnabled} onChange={(event) => setMcpEnabled(event.target.checked)} /><span className="switch" /> {mcpEnabled ? "MCP enabled" : "MCP disabled"}</label></div><div className="mcp-client-row"><label>Connect your client<select value={mcpClient} onChange={(event) => setMcpClient(event.target.value)}><option>Claude Desktop</option><option>Claude.ai</option><option>Cursor</option><option>ChatGPT</option><option>Other MCP client</option></select></label><button className="button primary" onClick={() => setApiState(`${mcpClient} setup selected`)}>Show setup steps <span>{"->"}</span></button></div></section>
            <section className="mcp-section"><div className="mcp-section-heading"><div><h2>Access</h2><p>Choose what connected clients can use from this instance.</p></div></div><div className="mcp-access-grid"><div className="mcp-access-card"><span>Workflows exposed</span><strong>1 workflow</strong><small>Customer onboarding</small></div><label className="mcp-toggle-card"><span><strong>Auto-expose new workflows</strong><small>Automatically expose newly created workflows to connected clients</small></span><input type="checkbox" checked={mcpAutoExpose} onChange={(event) => setMcpAutoExpose(event.target.checked)} /><span className="switch" /></label></div><label className="mcp-callback">Allowed callback URLs<select value={mcpCallbackPolicy} onChange={(event) => setMcpCallbackPolicy(event.target.value)}><option value="all">All URLs</option><option value="trusted">Trusted URLs only</option></select><small>Restrict OAuth sign-in redirects to trusted URLs. Allowing all URLs is less secure.</small></label></section>
            <section className="mcp-section"><div className="mcp-section-heading"><div><h2>Connected clients</h2><p>Manage clients that have access to this instance.</p></div><strong className="mcp-client-count">0 clients</strong></div><div className="mcp-empty"><span className="mcp-empty-icon">AI</span><strong>No connected clients</strong><p>Connect a client below to grant it access to your workflows and tools.</p></div></section>
            <section className="mcp-section mcp-connect"><div className="mcp-section-heading"><div><h2>Connect a client</h2><p>Pick the client you want to connect, then follow the tailored setup steps.</p></div></div><div className="mcp-auth-tabs"><button className={mcpAuthMode === "oauth" ? "active" : ""} onClick={() => setMcpAuthMode("oauth")}>OAuth <small>recommended</small></button><button className={mcpAuthMode === "api-key" ? "active" : ""} onClick={() => setMcpAuthMode("api-key")}>API key</button></div><div className="mcp-setup-grid"><div><label>Your client<select value={mcpClient} onChange={(event) => setMcpClient(event.target.value)}><option>Claude Desktop</option><option>Claude.ai</option><option>Cursor</option><option>ChatGPT</option><option>Other MCP client</option></select></label>{mcpAuthMode === "oauth" ? <button className="button primary mcp-one-click" onClick={() => setApiState(`${mcpClient} OAuth setup ready`)}>One-click setup <span>{"->"}</span></button> : <label>API key<input type="password" placeholder="Paste MCP API key" /></label>}</div><div><label>Server URL<div className="mcp-url-field"><code>{typeof window === "undefined" ? "https://your-instance/api/mcp" : `${window.location.origin}/api/mcp`}</code><button onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/api/mcp`); setMcpCopied(true); }}>{mcpCopied ? "Copied" : "Copy"}</button></div></label><pre>{`{\n  "mcpServers": {\n    "softcape": {\n      "url": "${typeof window === "undefined" ? "https://your-instance/api/mcp" : `${window.location.origin}/api/mcp`}"\n    }\n  }\n}`}</pre></div></div>{apiState && <div className="entry-error">{apiState}</div>}</section>
          </div>
        </section>
      );
    }
    const titles: Record<
      Exclude<
        EditorSection,
        "Workflows" | "Integrations" | "APIs" | "MCP"
      >,
      string
    > = {
      Overview: "Workspace overview",
      Executions: "Execution history",
      Templates: "Workflow templates",
      Settings: "Workspace settings",
    };
    return (
      <section className="section-panel">
        <div className="section-panel-inner">
          <span className="overline">
            WORKSPACE / {activeSection.toUpperCase()}
          </span>
          <h1>{titles[activeSection as keyof typeof titles]}</h1>
          <p>
            Use the sidebar to move between your organization workspace and
            automation controls.
          </p>
          <button
            className="header-button section-action"
            onClick={() => selectSection("Workflows")}
          >
            Back to workflows
          </button>
        </div>
      </section>
    );
  };

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEntryBusy(true);
    setEntryError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = (await response.json()) as {
      user?: { name: string; email: string };
      organization?: { id: string; name: string };
      session?: { workspaceId: string };
      error?: string;
    };
    if (!response.ok || !data.session) {
      setEntryError("Enter an email and password to continue.");
      setEntryBusy(false);
      return;
    }
    setOrganizationId(data.session.workspaceId);
    if (data.user) setCurrentUser(data.user);
    if (data.organization) setOrganizationName(data.organization.name);
    setEntryStage("editor");
    setEntryBusy(false);
  };

  const createOrganization = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEntryBusy(true);
    setEntryError("");
    const response = await fetch("/api/organizations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: organizationName,
        ownerName,
        ownerEmail,
        ownerPassword,
        confirmPassword: confirmOwnerPassword,
      }),
    });
    const data = (await response.json()) as {
      organization?: { id: string };
      owner?: { name: string; email: string };
      error?: string;
    };
    if (!response.ok || !data.organization) {
      setEntryError(data.error ?? "Could not create organization.");
      setEntryBusy(false);
      return;
    }
    setOrganizationId(data.organization.id);
    if (data.owner) setCurrentUser(data.owner);
    setEntryStage("database");
    setEntryBusy(false);
  };

  const connectOrganizationDatabase = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setEntryBusy(true);
    setEntryError("");
    const response = await fetch(
      `/api/organizations/${organizationId}/database`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: organizationDbUrl }),
      },
    );
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setEntryError(data.error ?? "We could not connect to that database.");
      setEntryBusy(false);
      return;
    }
    setEntryStage("editor");
    setEntryBusy(false);
  };

  if (entryStage !== "editor") {
    const step =
      entryStage === "login"
        ? "01 / ACCESS"
        : entryStage === "organization"
          ? "02 / ORGANIZATION"
          : "03 / DATA CONNECTION";
    return (
      <main className="entry-shell">
        <div className="entry-brand">
          <span className="softcape-logo">S</span>
          <span>softcape</span>
        </div>
        <div className="entry-frame">
          <div className="entry-aside">
            <span className="overline">EVENT-DRIVEN AUTOMATION</span>
            <h1>Build the systems your organization runs on.</h1>
            <p>
              Connect your tools, define capabilities, and let workflows move
              work forward.
            </p>
            <div className="entry-aside-line" />
            <small>
              Private by design. Your organization owns its data connections.
            </small>
          </div>
          <section className="entry-card">
            <span className="overline">{step}</span>
            {entryStage === "login" && (
              <>
                <h2>Welcome back</h2>
                <p className="entry-lede">
                  Sign in to your Softcape workspace.
                </p>
                <form className="entry-form" onSubmit={login}>
                  <label>
                    Email address
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@company.com"
                      required
                    />
                  </label>
                  <label>
                    Password
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter your password"
                      required
                    />
                  </label>
                  {entryError && (
                    <div className="entry-error">{entryError}</div>
                  )}
                  <button
                    className="entry-submit"
                    type="submit"
                    disabled={entryBusy}
                  >
                    {entryBusy ? "Signing in..." : "Continue"}
                    <span>{"->"}</span>
                  </button>
                </form>
                <div className="entry-foot">
                  New to Softcape?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setEntryStage("organization");
                      setEntryError("");
                    }}
                  >
                    Create an organization
                  </button>
                </div>
              </>
            )}
            {entryStage === "organization" && (
              <>
                <h2>Create your organization</h2>
                <p className="entry-lede">
                  Your organization is the boundary for members, workflows,
                  credentials, and data.
                </p>
                <form className="entry-form" onSubmit={createOrganization}>
                  <label>
                    Organization name
                    <input
                      value={organizationName}
                      onChange={(event) =>
                        setOrganizationName(event.target.value)
                      }
                      placeholder="Acme Ltd"
                      required
                    />
                  </label>
                  <div className="owner-section">
                    <span className="owner-section-title">System owner</span>
                    <p>
                      This account will manage members, credentials, and
                      organization access.
                    </p>
                    <label>
                      Your name
                      <input
                        value={ownerName}
                        onChange={(event) => setOwnerName(event.target.value)}
                        placeholder="Maya Chen"
                        required
                      />
                    </label>
                    <label>
                      Owner email
                      <input
                        type="email"
                        value={ownerEmail}
                        onChange={(event) => setOwnerEmail(event.target.value)}
                        placeholder="you@company.com"
                        required
                      />
                    </label>
                    <label>
                      Create password
                      <input
                        type="password"
                        minLength={8}
                        value={ownerPassword}
                        onChange={(event) =>
                          setOwnerPassword(event.target.value)
                        }
                        placeholder="At least 8 characters"
                        required
                      />
                    </label>
                    <label>
                      Confirm password
                      <input
                        type="password"
                        minLength={8}
                        value={confirmOwnerPassword}
                        onChange={(event) =>
                          setConfirmOwnerPassword(event.target.value)
                        }
                        placeholder="Repeat your password"
                        required
                      />
                    </label>
                  </div>
                  {entryError && (
                    <div className="entry-error">{entryError}</div>
                  )}
                  <button
                    className="entry-submit"
                    type="submit"
                    disabled={entryBusy}
                  >
                    {entryBusy
                      ? "Creating owner account..."
                      : "Create organization and owner"}
                    <span>{"->"}</span>
                  </button>
                </form>
                <button
                  className="back-link"
                  type="button"
                  onClick={() => setEntryStage("login")}
                >
                  Back to sign in
                </button>
              </>
            )}
            {entryStage === "database" && (
              <>
                <h2>Connect your database</h2>
                <p className="entry-lede">
                  Softcape stores authentication centrally. Your workflows and
                  organization data stay in this database.
                </p>
                <form
                  className="entry-form"
                  onSubmit={connectOrganizationDatabase}
                >
                  <label>
                    Organization database URL
                    <input
                      type="text"
                      value={organizationDbUrl}
                      onChange={(event) =>
                        setOrganizationDbUrl(event.target.value)
                      }
                      placeholder="file:./organization.db"
                      required
                    />
                  </label>
                  <div className="database-choice">
                    <strong>SQLite is ready to use</strong>
                    <span>
                      Use <code>file:</code> for local SQLite, or enter a{" "}
                      <code>postgres://</code> or <code>mysql://</code>{" "}
                      connection.
                    </span>
                  </div>
                  {entryError && (
                    <div className="entry-error">{entryError}</div>
                  )}
                  <button
                    className="entry-submit"
                    type="submit"
                    disabled={entryBusy}
                  >
                    {entryBusy ? "Connecting..." : "Connect and open workspace"}
                    <span>{"->"}</span>
                  </button>
                </form>
                <button
                  className="back-link"
                  type="button"
                  onClick={() => setEntryStage("organization")}
                >
                  Back to organization
                </button>
              </>
            )}
          </section>
        </div>
      </main>
    );
  }

  return (
    <div className="n8n-editor">
      {/* LEFT APPLICATION SIDEBAR */}
      <aside className={`app-sidebar ${leftOpen ? "" : "collapsed"}`}>
        <div className="sidebar-brand">
          <div className="softcape-logo">S</div>

          {leftOpen && <span className="softcape-name">softcape</span>}
        </div>

        <div className="sidebar-section">
          <button
            className={`sidebar-item ${activeSection === "Overview" ? "active" : ""}`}
            onClick={() => selectSection("Overview")}
          >
            <span>⌂</span>
            {leftOpen && "Overview"}
          </button>

          <button
            className={`sidebar-item ${activeSection === "Workflows" ? "active" : ""}`}
            onClick={() => selectSection("Workflows")}
          >
            <span>⌘</span>
            {leftOpen && "Workflows"}
          </button>

          <button
            className={`sidebar-item ${activeSection === "Executions" ? "active" : ""}`}
            onClick={() => selectSection("Executions")}
          >
            <span>↯</span>
            {leftOpen && "Executions"}
          </button>

          <button
            className={`sidebar-item ${activeSection === "Templates" ? "active" : ""}`}
            onClick={() => selectSection("Templates")}
          >
            <span>◈</span>
            {leftOpen && "Templates"}
          </button>

          <button
            className={`sidebar-item ${activeSection === "Integrations" ? "active" : ""}`}
            onClick={() => selectSection("Integrations")}
          >
            <span>◌</span>
            {leftOpen && "Integrations"}
          </button>

          <button
            className={`sidebar-item ${activeSection === "APIs" ? "active" : ""}`}
            onClick={() => selectSection("APIs")}
          >
            <span>↗</span>
            {leftOpen && "APIs"}
          </button>

          <button
            className={`sidebar-item ${activeSection === "MCP" ? "active" : ""}`}
            onClick={() => selectSection("MCP")}
          >
            <span>AI</span>
            {leftOpen && "MCP servers"}
          </button>

        </div>

        <div className="sidebar-spacer" />

        <div className="sidebar-section">
          <button
            className="sidebar-item"
            onClick={() => selectSection("Overview")}
          >
            <span>?</span>
            {leftOpen && "Help"}
          </button>

          <button
            className={`sidebar-item ${activeSection === "Settings" ? "active" : ""}`}
            onClick={() => selectSection("Settings")}
          >
            <span>⚙</span>
            {leftOpen && "Settings"}
          </button>
        </div>

        <div className="user-profile">
          <div className="user-avatar">
            {(currentUser.name || "Owner")
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>

          {leftOpen && (
            <div>
              <strong>{currentUser.name || "System owner"}</strong>
              <small>{currentUser.email || "Owner"}</small>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN AREA */}
      <main className="workflow-main">
        {/* TOP HEADER */}
        <header className="workflow-header">
          <div className="breadcrumb">
            <span className="workspace">
              {organizationName || "Organization"}
            </span>

            <span className="separator">/</span>

            <span>{activeSection}</span>

            <button className="more-button">...</button>
          </div>

          <div className="workflow-title">
            <span className="status-dot" />

            <strong>
              {activeSection === "Workflows"
                ? "Customer onboarding"
                : activeSection}
            </strong>
          </div>

          <div className="header-actions">
            <button className="header-button">Share</button>

            <button
              className={`publish-button ${published ? "published" : ""}`}
              onClick={() => setPublished(!published)}
            >
              {published ? "Published" : "Publish"}
            </button>

            <button className="publish-dropdown">▾</button>
          </div>
        </header>

        {/* WORKFLOW TABS */}
        <div className="workflow-tabs">
          <button
            className={`workflow-tab ${activeSection === "Workflows" ? "active" : ""}`}
            onClick={() => selectSection("Workflows")}
          >
            Editor
          </button>

          <button
            className={`workflow-tab ${activeSection === "Executions" ? "active" : ""}`}
            onClick={() => selectSection("Executions")}
          >
            Executions
          </button>

          <button
            className={`workflow-tab ${activeSection === "Templates" ? "active" : ""}`}
            onClick={() => selectSection("Templates")}
          >
            Evaluations
          </button>
        </div>

        {/* CANVAS */}
        {activeSection === "Workflows" ? (
          <section className="editor-area">
            {/* NODE LIBRARY */}
            {leftOpen && (
              <aside className="node-library">
                <div className="library-header">
                  <strong>Add nodes</strong>

                  <button onClick={() => setLeftOpen(false)}>×</button>
                </div>

                <div className="node-search">
                  <span>⌕</span>

                  <input
                    placeholder="Search nodes..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="library-content">
                  <div className="library-category">TRIGGERS</div>

                  {filteredNodes
                    .filter((node) => node.type === "trigger")
                    .map((node) => (
                      <button
                        className="library-node"
                        key={node.name}
                        onClick={() => addNode(node)}
                      >
                        <span className={`library-icon ${node.type}`}>
                          {node.icon}
                        </span>

                        <span className="library-text">
                          <strong>{node.name}</strong>

                          <small>{node.description}</small>
                        </span>

                        <span className="library-plus">+</span>
                      </button>
                    ))}

                  <div className="library-category">ACTIONS &amp; CONNECTED APPS</div>

                  {filteredNodes
                    .filter((node) => node.type === "action")
                    .map((node) => (
                      <button
                        className="library-node"
                        key={node.name}
                        onClick={() => addNode(node)}
                      >
                        <span className={`library-icon ${node.type}`}>
                          {node.icon}
                        </span>

                        <span className="library-text">
                          <strong>{node.name}</strong>

                          <small>{node.description}</small>
                        </span>

                        <span className="library-plus">+</span>
                      </button>
                    ))}

                  <div className="library-category">LOGIC</div>

                  {filteredNodes
                    .filter((node) => node.type === "logic")
                    .map((node) => (
                      <button
                        className="library-node"
                        key={node.name}
                        onClick={() => addNode(node)}
                      >
                        <span className={`library-icon ${node.type}`}>
                          {node.icon}
                        </span>

                        <span className="library-text">
                          <strong>{node.name}</strong>

                          <small>{node.description}</small>
                        </span>

                        <span className="library-plus">+</span>
                      </button>
                    ))}
                </div>
              </aside>
            )}

            {/* GRAPH CANVAS */}
            <div className="workflow-canvas">
              <div className="canvas-grid" />

              {/* CANVAS TOP CONTROLS */}
              <div className="canvas-controls">
                <button onClick={() => setZoom(Math.min(200, zoom + 10))}>
                  +
                </button>

                <div className="zoom-value">{zoom}%</div>

                <button onClick={() => setZoom(Math.max(25, zoom - 10))}>
                  −
                </button>

                <button>⛶</button>

                <button>◫</button>
              </div>

              {/* OPEN LIBRARY BUTTON */}
              {!leftOpen && (
                <button
                  className="floating-control left-control"
                  onClick={() => setLeftOpen(true)}
                >
                  ☰
                </button>
              )}

              {/* CANVAS NODES */}
              <div
                className="graph"
                style={{
                  transform: `translate(-50%, -50%) scale(${zoom / 100})`,
                }}
              >
                {nodes.map((node, index) => (
                  <div
                    key={node.id}
                    className={`graph-node-wrapper ${
                      selectedNode === node.id ? "selected" : ""
                    }`}
                    style={{
                      left: node.x,
                      top: node.y,
                    }}
                  >
                    {/* CONNECTION LINE */}
                    {index > 0 && (
                      <div className="connection-line">
                        <div className="connection-arrow">↓</div>
                      </div>
                    )}

                    <div
                      className={`graph-node ${node.type}`}
                      onClick={() => setSelectedNode(node.id)}
                    >
                      <div className="node-top">
                        <div className={`node-main-icon ${node.type}`}>
                          {node.icon}
                        </div>

                        <button className="node-options">...</button>
                      </div>

                      <div className="node-info">
                        <strong>{node.name}</strong>

                        <small>{node.description}</small>
                      </div>

                      {/* INPUT */}
                      <div className="node-input-handle" />

                      {/* OUTPUT */}
                      <div className="node-output-handle" />
                    </div>

                    {/* QUICK ADD */}
                    <button
                      className="quick-add"
                      onClick={(e) => {
                        e.stopPropagation();
                        addNode(allNodeLibrary[3]);
                      }}
                    >
                      +
                    </button>
                  </div>
                ))}

                {/* EMPTY CANVAS ADD */}
                <button
                  className="canvas-add-node"
                  onClick={() => addNode(allNodeLibrary[3])}
                >
                  <span>+</span>
                  Add node
                </button>
              </div>

              {/* MINIMAP */}
              <div className="minimap">
                <div className="mini-node one" />
                <div className="mini-node two" />
                <div className="mini-node three" />

                <div className="minimap-view" />
              </div>

              {/* CANVAS LEGEND */}
              <div className="canvas-help">
                <span>
                  <kbd>Space</kbd> pan
                </span>

                <span>
                  <kbd>Scroll</kbd> zoom
                </span>

                <span>
                  <kbd>Drag</kbd> move
                </span>
              </div>
            </div>

            {/* INSPECTOR */}
            {rightOpen && (
              <aside className="inspector">
                <div className="inspector-header">
                  <strong>Parameters</strong>

                  <button onClick={() => setRightOpen(false)}>×</button>
                </div>

                {selected ? (
                  <>
                    <div className="selected-node">
                      <div className={`selected-icon ${selected.type}`}>
                        {selected.icon}
                      </div>

                      <div>
                        <strong>{selected.name}</strong>

                        <small>{selected.description}</small>
                      </div>
                    </div>

                    <div className="inspector-tabs">
                      <button className="active">Parameters</button>

                      <button>Settings</button>
                    </div>

                    <div className="parameter-section">
                      <label>App or service</label>

                      <select value={credentialIntegration} onChange={(event) => setCredentialIntegration(event.target.value)}>
                        {integrationDefinitions.map((integration) => <option value={integration.id} key={integration.id}>{integration.name}</option>)}
                      </select>
                    </div>

                    <div className="parameter-section provider-parameters">
                      <label>Connection parameters</label>
                      <small>{selectedIntegration.setup}</small>
                      <input value={credentialName} onChange={(event) => setCredentialName(event.target.value)} placeholder="Credential name" />
                      {selectedIntegration.auth !== "oauth2" && <input type="password" value={credentialApiKey} onChange={(event) => setCredentialApiKey(event.target.value)} placeholder="API key or access token" />}
                      {selectedCredentialIsAi && <input value={credentialModel} onChange={(event) => setCredentialModel(event.target.value)} placeholder="Model name" />}
                      <input value={credentialBaseUrl} onChange={(event) => setCredentialBaseUrl(event.target.value)} placeholder="Base URL (optional)" />
                      <textarea value={credentialVariables} onChange={(event) => setCredentialVariables(event.target.value)} placeholder="KEY=value" rows={3} />
                      <button type="button" className="save-parameter-button" onClick={() => saveCredential()}>Save connection</button>
                      {credentialState && <small>{credentialState}</small>}
                    </div>

                    <div className="parameter-section">
                      <label>Operation</label>

                      <select>
                        <option>Select operation...</option>

                        <option>Create</option>

                        <option>Update</option>

                        <option>Delete</option>
                      </select>
                    </div>

                    <div className="parameter-section">
                      <label>Resource</label>

                      <input placeholder="Enter resource" />
                    </div>

                    <div className="parameter-section">
                      <label>Notes</label>

                      <textarea placeholder="Add notes..." rows={4} />
                    </div>

                    <div className="expression-box">
                      <span>fx</span>

                      <div>
                        Expressions can use workflow variables and previous node
                        data.
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="empty-inspector">
                    Select a node to configure it.
                  </div>
                )}
              </aside>
            )}
          </section>
        ) : (
          renderSectionPanel()
        )}

        {/* EXECUTION BAR */}
        {activeSection === "Workflows" && <footer className="execution-bar">
          <div className="execution-left">
            <span className="execution-status">
              <i />
              Ready
            </span>

            <span className="execution-separator" />

            <span>Last execution: never</span>
          </div>

          <div className="execution-center">
            <button
              className="execute-button"
              onClick={executeWorkflow}
              disabled={running}
            >
              <span>{running ? "◌" : "▶"}</span>

              {running ? "Executing workflow..." : "Execute workflow"}
            </button>
          </div>

          <div className="execution-right">
            <button>Undo</button>

            <button>Redo</button>

            <button>Save</button>
          </div>
        </footer>}
      </main>
    </div>
  );
}
