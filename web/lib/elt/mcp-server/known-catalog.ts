import type { McpServerConfig, McpTransport } from "./types";

export type KnownMcpServerCategory =
  | "payments"
  | "data"
  | "devtools"
  | "search"
  | "communication"
  | "platform";

export type KnownMcpEnvVar = {
  name: string;
  label: string;
  description: string;
  required?: boolean;
  /** Hint for HTTP Bearer auth — prepend when saving secret. */
  bearerPrefix?: boolean;
  /** When false, show a plain text input (e.g. organization slug). Default true. */
  secret?: boolean;
};

export type KnownMcpServerTemplate = {
  id: string;
  name: string;
  vendor: string;
  category: KnownMcpServerCategory;
  description: string;
  transport: McpTransport;
  config: McpServerConfig;
  docsUrl: string;
  envVars?: KnownMcpEnvVar[];
  /** Shown when stdio must run on gateway/worker, not control-plane discovery. */
  runtimeNote?: string;
};

/** Curated MCP integrations — pre-fill workspace registration; not auto-provisioned. */
export const KNOWN_MCP_SERVER_TEMPLATES: KnownMcpServerTemplate[] = [
  {
    id: "fastmcp-docs",
    name: "FastMCP Docs",
    vendor: "Prefect",
    category: "devtools",
    description: "Search FastMCP documentation via MCP — includes search_fast_mcp and llms.txt discovery.",
    transport: "http",
    config: { url: "https://gofastmcp.com/mcp" },
    docsUrl: "https://gofastmcp.com/getting-started/welcome",
  },
  {
    id: "prefect-horizon",
    name: "Prefect Horizon",
    vendor: "Prefect",
    category: "platform",
    description:
      "Production MCP URL from Horizon Deploy — OAuth 2.1, scaling, registry, and tool-level RBAC for enterprise agents.",
    transport: "http",
    config: {
      url: "https://YOUR-SERVER.horizon.prefect.io/mcp",
      headers_env: { Authorization: "HORIZON_MCP_AUTH" },
    },
    docsUrl: "https://www.prefect.io/horizon",
    envVars: [
      {
        name: "HORIZON_MCP_AUTH",
        label: "Authorization (optional)",
        description:
          "Bearer token or API key if your Horizon server accepts non-OAuth clients. Claude/Cursor often use OAuth directly.",
        required: false,
        bearerPrefix: true,
      },
    ],
    runtimeNote:
      "Replace the URL with your Horizon Deploy endpoint (*.horizon.prefect.io or *.fastmcp.app). Tool discovery works from this UI when auth is configured.",
  },
  {
    id: "fastmcp-local",
    name: "FastMCP (local stdio)",
    vendor: "Prefect",
    category: "platform",
    description: "Run a custom FastMCP Python server on the gateway/worker — prototype before Horizon Deploy.",
    transport: "stdio",
    config: {
      command: ["uv", "run", "fastmcp", "run", "server.py"],
    },
    docsUrl: "https://gofastmcp.com/getting-started/quickstart",
    runtimeNote:
      "Edit the command to point at your server module. When ready for production, git push to Horizon for a stable remote URL.",
  },
  {
    id: "dagster-plus",
    name: "Dagster+",
    vendor: "Dagster",
    category: "platform",
    description:
      "Dagster+ agent MCP — query runs, assets, and automation from Dagster Cloud via the official remote server.",
    transport: "http",
    config: {
      url: "https://mcp.agent.dagster.cloud/mcp/",
      headers_env: {
        Authorization: "DAGSTER_PLUS_TOKEN",
        "Dagster-Cloud-Organization": "DAGSTER_CLOUD_ORGANIZATION",
      },
    },
    docsUrl: "https://docs.dagster.io",
    envVars: [
      {
        name: "DAGSTER_PLUS_TOKEN",
        label: "User or service account token",
        description: "Create in Dagster+ Admin → User settings (or a service account). Bearer prefix added automatically.",
        required: true,
        bearerPrefix: true,
      },
      {
        name: "DAGSTER_CLOUD_ORGANIZATION",
        label: "Dagster Cloud organization",
        description: "Your organization slug — sent as the Dagster-Cloud-Organization header.",
        required: true,
        secret: false,
      },
    ],
    runtimeNote: "Tool discovery works from this UI once token and organization are saved.",
  },
  {
    name: "Stripe",
    vendor: "Stripe",
    category: "payments",
    description: "Hosted Stripe MCP — customers, payments, subscriptions, Connect, and more.",
    transport: "http",
    config: {
      url: "https://mcp.stripe.com",
      headers_env: { Authorization: "STRIPE_MCP_AUTH" },
    },
    docsUrl: "https://docs.stripe.com/mcp",
    envVars: [
      {
        name: "STRIPE_MCP_AUTH",
        label: "Authorization header",
        description: "Restricted secret key or OAuth token. Use Bearer sk_test_… or Bearer rk_live_…",
        required: true,
        bearerPrefix: true,
      },
    ],
  },
  {
    id: "stripe-stdio",
    name: "Stripe (local stdio)",
    vendor: "Stripe",
    category: "payments",
    description: "Run @stripe/mcp on the gateway/worker via npx (stdio).",
    transport: "stdio",
    config: {
      command: ["npx", "-y", "@stripe/mcp@latest"],
      env: { STRIPE_SECRET_KEY: "$STRIPE_SECRET_KEY" },
    },
    docsUrl: "https://www.npmjs.com/package/@stripe/mcp",
    envVars: [
      {
        name: "STRIPE_SECRET_KEY",
        label: "Stripe secret key",
        description: "sk_test_… or sk_live_… — stored encrypted, injected at worker runtime.",
        required: true,
      },
    ],
    runtimeNote: "Tool discovery runs on the gateway/worker (stdio), not from this UI.",
  },
  {
    id: "github",
    name: "GitHub",
    vendor: "GitHub",
    category: "devtools",
    description: "Repos, issues, PRs, and file contents via the official GitHub MCP server.",
    transport: "stdio",
    config: {
      command: ["npx", "-y", "@modelcontextprotocol/server-github"],
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: "$GITHUB_PERSONAL_ACCESS_TOKEN" },
    },
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/github",
    envVars: [
      {
        name: "GITHUB_PERSONAL_ACCESS_TOKEN",
        label: "GitHub PAT",
        description: "Fine-grained or classic token with repo scope.",
        required: true,
      },
    ],
    runtimeNote: "Tool discovery runs on the gateway/worker (stdio).",
  },
  {
    id: "postgres",
    name: "PostgreSQL",
    vendor: "Anthropic MCP",
    category: "data",
    description: "Read-only SQL against a Postgres database (schema + query tools).",
    transport: "stdio",
    config: {
      command: [
        "npx",
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://USER:PASSWORD@HOST:5432/DATABASE",
      ],
    },
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/postgres",
    envVars: [],
    runtimeNote: "Replace the connection URI in the command with your read-only Postgres URL.",
  },
  {
    id: "filesystem",
    name: "Filesystem",
    vendor: "Anthropic MCP",
    category: "platform",
    description: "Read/write files under allowed directories on the gateway host.",
    transport: "stdio",
    config: {
      command: ["npx", "-y", "@modelcontextprotocol/server-filesystem", "/data"],
    },
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem",
    runtimeNote: "Edit the path in the command to match a directory on your worker.",
  },
  {
    id: "fetch",
    name: "Fetch",
    vendor: "Anthropic MCP",
    category: "platform",
    description: "HTTP fetch for agents — retrieve and convert web pages to markdown.",
    transport: "stdio",
    config: {
      command: ["npx", "-y", "@modelcontextprotocol/server-fetch"],
    },
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/fetch",
    runtimeNote: "Tool discovery runs on the gateway/worker (stdio).",
  },
  {
    id: "brave-search",
    name: "Brave Search",
    vendor: "Brave",
    category: "search",
    description: "Web search for agents via Brave Search API.",
    transport: "stdio",
    config: {
      command: ["npx", "-y", "@modelcontextprotocol/server-brave-search"],
      env: { BRAVE_API_KEY: "$BRAVE_API_KEY" },
    },
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search",
    envVars: [
      {
        name: "BRAVE_API_KEY",
        label: "Brave API key",
        description: "From https://brave.com/search/api/",
        required: true,
      },
    ],
    runtimeNote: "Tool discovery runs on the gateway/worker (stdio).",
  },
  {
    id: "slack",
    name: "Slack",
    vendor: "Slack",
    category: "communication",
    description: "Post messages and list channels via Slack MCP.",
    transport: "stdio",
    config: {
      command: ["npx", "-y", "@modelcontextprotocol/server-slack"],
      env: { SLACK_BOT_TOKEN: "$SLACK_BOT_TOKEN" },
    },
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/slack",
    envVars: [
      {
        name: "SLACK_BOT_TOKEN",
        label: "Slack bot token",
        description: "xoxb-… from your Slack app.",
        required: true,
      },
    ],
    runtimeNote: "Tool discovery runs on the gateway/worker (stdio).",
  },
  {
    id: "google-drive",
    name: "Google Drive",
    vendor: "Google",
    category: "data",
    description: "Search and read Google Drive files.",
    transport: "stdio",
    config: {
      command: ["npx", "-y", "@modelcontextprotocol/server-gdrive"],
    },
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/gdrive",
    runtimeNote: "OAuth credentials must be configured on the worker host.",
  },
  {
    id: "puppeteer",
    name: "Puppeteer",
    vendor: "Anthropic MCP",
    category: "devtools",
    description: "Browser automation — screenshots, clicks, and page interaction.",
    transport: "stdio",
    config: {
      command: ["npx", "-y", "@modelcontextprotocol/server-puppeteer"],
    },
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer",
    runtimeNote: "Requires Chromium on the gateway/worker.",
  },
  {
    id: "memory",
    name: "Memory",
    vendor: "Anthropic MCP",
    category: "platform",
    description: "Persistent key-value memory graph for multi-step agents.",
    transport: "stdio",
    config: {
      command: ["npx", "-y", "@modelcontextprotocol/server-memory"],
    },
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/memory",
  },
  {
    id: "sentry",
    name: "Sentry",
    vendor: "Sentry",
    category: "devtools",
    description: "Query issues and events from Sentry projects.",
    transport: "stdio",
    config: {
      command: ["npx", "-y", "@sentry/mcp-server"],
      env: { SENTRY_AUTH_TOKEN: "$SENTRY_AUTH_TOKEN" },
    },
    docsUrl: "https://docs.sentry.io/product/sentry-mcp/",
    envVars: [
      {
        name: "SENTRY_AUTH_TOKEN",
        label: "Sentry auth token",
        description: "Organization auth token with project read access.",
        required: true,
      },
    ],
    runtimeNote: "Tool discovery runs on the gateway/worker (stdio).",
  },
];

export const KNOWN_MCP_CATEGORY_LABELS: Record<KnownMcpServerCategory, string> = {
  payments: "Payments",
  data: "Data",
  devtools: "Dev tools",
  search: "Search",
  communication: "Communication",
  platform: "Platform",
};

export function getKnownMcpTemplate(id: string): KnownMcpServerTemplate | undefined {
  return KNOWN_MCP_SERVER_TEMPLATES.find((t) => t.id === id);
}

/** Build create payload from a catalog template + optional secret values. */
export function templateToCreatePayload(
  template: KnownMcpServerTemplate,
  secrets: Record<string, string> = {}
): {
  name: string;
  description: string;
  transport: McpTransport;
  config: McpServerConfig;
  secrets?: Record<string, string>;
} {
  const normalizedSecrets: Record<string, string> = {};
  for (const ev of template.envVars ?? []) {
    let val = (secrets[ev.name] ?? "").trim();
    if (!val) continue;
    if (ev.bearerPrefix && !val.toLowerCase().startsWith("bearer ")) {
      val = `Bearer ${val}`;
    }
    normalizedSecrets[ev.name] = val;
  }

  return {
    name: template.name,
    description: template.description,
    transport: template.transport,
    config: template.config,
    secrets: Object.keys(normalizedSecrets).length ? normalizedSecrets : undefined,
  };
}
