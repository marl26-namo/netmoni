# Softcape

**Softcape** is an event-driven automation platform designed to achieve a similar goal to n8n while taking a different architectural approach.

Instead of making the visual workflow builder the core of the platform, Softcape is built around **Events, Capabilities, Resources, Connectors, Workflows, and Executions**.

## Vision

Softcape allows organisations to automate business processes and expose those automations to **humans, applications, events, APIs, and AI agents** through a single automation engine.

The visual workflow builder is one interface to the engine—not the engine itself.

```text
                    Automation Engine
                           ▲
             ┌─────────────┼─────────────┐
             │             │             │
          Visual UI       MCP           SDK
             │             │             │
          Humans       AI Agents     Developers
```

## Key Features

* **Event-driven architecture** — automations can react to business and system events.
* **AI-native** — MCP is a first-class interface for AI agents.
* **Capabilities** — expose business actions without exposing internal workflow complexity.
* **BYO Database** — organisations can use PostgreSQL, MySQL, or SQLite.
* **Drizzle ORM** — provides a database abstraction across supported databases.
* **Multiple deployment models** — Vercel, organisation servers, or desktop/self-hosted environments.
* **Visual workflow builder** — users can visually create and manage automations.
* **Webhooks, APIs, events, and schedules** — multiple ways to trigger automations.
* **Connectors** — interact with databases, APIs, storage systems, queues, and external services.
* **Durable executions** — track workflow execution, state, errors, and results.

## Core Concepts

### Events

Events represent something that happened.

```text
customer.created
invoice.paid
file.uploaded
order.completed
```

### Capabilities

Capabilities represent actions Softcape can perform.

```text
create_customer
send_invoice
generate_report
check_inventory
```

### Workflows

Workflows compose capabilities into business processes.

### Resources

Resources are systems and data that automations can interact with.

```text
PostgreSQL
MySQL
SQLite
REST APIs
Storage
Queues
External Services
```

### Connectors

Connectors provide the interface between Softcape and external resources.

### Executions

Executions represent the runtime state and history of an automation.

## Architecture

```text
                         SOFTCAPE
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
       MCP                Events              API/Webhooks
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                    Automation Engine
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
     Capabilities        Workflows        Executions
          │                 │                 │
          └─────────────────┼─────────────────┘
                            │
                       Connectors
                            │
             ┌──────────────┼──────────────┐
             │              │              │
         PostgreSQL       MySQL          SQLite
```

## Folder Structure

```text
softcape/
├── app/
│   ├── api/
│   │   ├── mcp/                  # MCP interface
│   │   ├── webhooks/             # Webhook triggers
│   │   ├── events/               # Event API
│   │   └── automations/          # Automation API
│   └── dashboard/                # Web UI / visual builder
│
├── core/
│   ├── engine/                   # Automation execution engine
│   ├── events/                   # Event bus and routing
│   ├── capabilities/             # Business/action capabilities
│   ├── workflows/                # Workflow definitions
│   ├── executions/               # Execution state
│   └── registry/                 # Capability/node registry
│
├── connectors/
│   ├── database/                 # PostgreSQL, MySQL, SQLite
│   ├── http/                     # HTTP/API connectors
│   ├── storage/                  # Storage connectors
│   └── messaging/                # Queue/messaging connectors
│
├── auth/                         # Users, sessions and roles
├── db/
│   ├── schema/                   # Drizzle schemas
│   ├── migrations/               # Database migrations
│   └── repositories/             # Database access layer
│
├── nodes/                        # Built-in automation nodes
├── integrations/                 # External integrations
├── workers/                      # Background execution
├── security/                     # Secrets and permissions
├── sdk/                          # Developer SDK
├── cli/                          # CLI and initialization
└── config/                       # Runtime configuration
```

## Database

Softcape uses **Drizzle ORM** with two persistence boundaries:

* The Softcape-owned database stores only authentication and tenancy metadata: `users`, `sessions`, `organizations`, and `organization_members`.
* Each organization database stores its own workflows, resources, events, executions, and secrets.

```text
                 Softcape
                     │
              Repository Layer
                     │
                 Drizzle ORM
                     │
          ┌──────────┼──────────┐
          │          │          │
      PostgreSQL    MySQL     SQLite
```

The organization database is configured from the dashboard. The URL is accepted by `/api/organizations/[organizationId]/database`, and the server keeps credentials out of API responses. SQLite is available as the default choice for organizations without an existing database.

### Database Setup

The Softcape auth database defaults to SQLite and requires no external service:

```bash
npm run db:migrate
```

For an organization-managed auth database, set `AUTH_DATABASE_URL` before generating and applying auth migrations:

```bash
AUTH_DATABASE_URL=postgresql://user:password@host:5432/softcape-auth npm run db:generate:auth
AUTH_DATABASE_URL=postgresql://user:password@host:5432/softcape-auth npm run db:migrate:auth
```

Organization tenant migrations use `ORGANIZATION_DATABASE_URL` when running the tenant migration commands. `postgresql://` selects PostgreSQL, `mysql://` selects MySQL, and `file:` selects SQLite. The database client and Drizzle schema are selected from the URL at runtime.

## Deployment

Softcape is designed to support:

* **Vercel** for cloud/serverless deployment
* **Self-hosted servers** inside organisations
* **Desktop/local environments**
* **Organisation-managed infrastructure**

The same core engine should operate across these environments.

## Status

Softcape is currently in the **architecture and core-engine development stage**.

The initial implementation focuses on:

1. Core automation engine
2. Event bus
3. Capability registry
4. Workflow execution
5. Drizzle database layer
6. PostgreSQL / MySQL / SQLite support
7. Authentication
8. MCP interface
9. Webhooks and event triggers
10. Visual automation builder

## Goal

Softcape aims to provide a flexible automation runtime where **business systems, developers, users, and AI agents can all interact with the same underlying capabilities and event-driven engine**.

## MCP Server

Softcape exposes a stateless MCP Streamable HTTP endpoint at `/api/mcp`. It supports the MCP JSON-RPC handshake, tool discovery, tool execution, CORS, and optional bearer-token authentication.

## Integrations

Organizations can connect external systems from **Resources**. The catalog includes Malawi-focused payment and banking integrations such as Airtel Money, TNM Mpamba, National Bank of Malawi, FDH Bank, NBS Bank, and Standard Bank Malawi, alongside WhatsApp, SMS gateways, Gmail, Google Drive, Google Sheets, Slack, OpenAI, Anthropic, Gemini, QuickBooks, Xero, and generic accounting APIs.

Each integration declares its authentication mode (`oauth2`, `api-key`, `basic`, or `custom`) and available workflow actions. Provider credentials belong to the organization and must be supplied through the organization’s approved API or OAuth process. Softcape does not assume undocumented bank endpoints or fake payment integrations; the provider adapter is enabled only after the organization supplies the relevant credentials, contracts, and permissions.

Run the app with `npm run dev`, then configure any MCP-capable client with:

```json
{
    "mcpServers": {
        "softcape": {
            "url": "http://localhost:3000/api/mcp"
        }
    }
}
```

Available tools:

* `softcape_list_workflows`
* `softcape_emit_event`
* `softcape_list_executions`
* `softcape_list_capabilities`

Set `MCP_API_KEY` in the environment to require `Authorization: Bearer <key>` or `x-api-key: <key>`. AI providers that do not support MCP natively can still use the same capabilities through `/api/events`, `/api/automations`, and `/api/webhooks/[workflowId]`.

## First-Run Access

The web app follows this sequence:

1. Sign in to Softcape.
2. Create an organization.
3. Connect the organization database using SQLite or an organization-owned PostgreSQL/MySQL URL.
4. Open the workflow editor and connect external integrations from Resources.

The owner flow stores password hashes, organizations, memberships, and sessions in the Softcape auth database. Login issues an HTTP-only `softcape_session` cookie, and `/api/auth/me` verifies it. SQLite auth persistence is active by default; PostgreSQL/MySQL auth deployments should run the auth migration and use the same repository boundary before production rollout.
