import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getCurrentDbUser } from "@/lib/auth/server";
import { DLT_HUB_SOURCES, getDltHubSource, getDltHubSourcesByCategory } from "@/lib/elt/dlt-hub-registry";
import { SOURCE_GROUPS, DESTINATION_GROUPS } from "@/lib/elt/catalog";
import { chooseTool } from "@/lib/elt/choose-tool";
import { generatePipelineArtifacts } from "@/lib/elt/generate-artifacts";
import type { CreatePipelineBody } from "@/lib/elt/types";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 4096;

const SYSTEM_PROMPT = `You are the eltPulse Pipeline Builder AI. Your ONLY job is to generate pipeline configs as fast as possible.

## Core rule: Generate immediately, don't interrogate

When a user describes a pipeline (e.g. "Load GitHub issues into Snowflake"), call generate_pipeline RIGHT AWAY using smart defaults. Do NOT ask clarifying questions first. Use these defaults:
- GitHub: repo_owner="your-org", repo_name="your-repo", resources=["issues","pull_requests"], github_token_env="GITHUB_TOKEN"
- Stripe: start_date="2024-01-01"
- REST API: base_url from context or placeholder, pagination_type="auto"
- Database sources: tables="public.users" as a placeholder

After generating, give ONE short sentence: "Pipeline ready — click Save, then edit the repo/credentials in the builder."

## Only ask questions when truly ambiguous
- If you genuinely cannot determine source OR destination, ask for just that one thing.
- For REST APIs with no URL at all: ask for the base URL only.
- Never ask about credentials, env vars, or optional config — use defaults.

## Format
- Be extremely brief. 1-3 sentences max after a generation.
- No bullet lists of questions. No "I just need a few details".
- No emojis.

Available source types: ${Object.values(SOURCE_GROUPS).flat().join(", ")}
Available destination types: ${Object.values(DESTINATION_GROUPS).flat().join(", ")}

Verified connectors: ${DLT_HUB_SOURCES.map(s => `${s.slug} (${s.name})`).join(", ")}`;


const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_sources",
    description: "Search the eltPulse connector registry for sources matching a query. Use this to find the right source for a user's data.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search term — e.g. 'stripe', 'payments', 'github', 'postgres database'",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_source_details",
    description: "Get detailed info about a specific source: auth requirements, config params, incremental support, and docs URL.",
    input_schema: {
      type: "object" as const,
      properties: {
        slug: {
          type: "string",
          description: "The source slug, e.g. 'github', 'stripe_analytics', 'rest_api'",
        },
      },
      required: ["slug"],
    },
  },
  {
    name: "list_registry",
    description: "List all available sources grouped by category from the eltPulse connector registry.",
    input_schema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          description: "Optional category filter: 'CRM & Sales', 'Marketing', 'Support & Ops', 'Developer & Code', 'Storage & Files', 'Databases', 'Analytics', 'Productivity', 'Other'",
        },
      },
      required: [],
    },
  },
  {
    name: "suggest_rest_api_config",
    description: "Given a REST API URL and optional docs snippet, suggest the dlt rest_api source configuration: pagination type, auth method, data_selector, and cursor field for incremental loading.",
    input_schema: {
      type: "object" as const,
      properties: {
        base_url: {
          type: "string",
          description: "The API base URL, e.g. https://api.example.com",
        },
        endpoint: {
          type: "string",
          description: "The specific endpoint path, e.g. /v1/events",
        },
        sample_response: {
          type: "string",
          description: "Optional: a sample JSON response snippet to help identify the data structure",
        },
        auth_hint: {
          type: "string",
          description: "Optional: hint about auth method (bearer, api_key, basic, none)",
        },
      },
      required: ["base_url"],
    },
  },
  {
    name: "generate_pipeline",
    description: "Generate a complete pipeline configuration ready to save. Call this once you have all required information from the user.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Pipeline name (snake_case, start with letter)",
        },
        source_type: {
          type: "string",
          description: "Source slug, e.g. 'github', 'stripe_analytics', 'rest_api', 'postgres'",
        },
        destination_type: {
          type: "string",
          description: "Destination slug, e.g. 'snowflake', 'bigquery', 'duckdb', 'postgres'",
        },
        description: {
          type: "string",
          description: "Human-readable description of what this pipeline does",
        },
        source_configuration: {
          type: "object",
          description: "Source-specific config. For github: {repo_owner, repo_name, resources, github_token_env}. For rest_api: {base_url, endpoint, resource_name, http_method, pagination_type, data_selector}. For stripe_analytics: {start_date}. For sql_database/postgres/mysql: {tables}.",
        },
        incremental: {
          type: "boolean",
          description: "Whether this pipeline should use incremental/partition loading",
        },
      },
      required: ["name", "source_type", "destination_type"],
    },
  },
];

// ── Tool implementations ─────────────────────────────────────────────────────

function toolSearchSources(query: string) {
  const q = query.toLowerCase();
  const matches = DLT_HUB_SOURCES.filter(
    (s) =>
      s.slug.includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q)
  );

  // Also check built-in catalog
  const allSlugs = Object.values(SOURCE_GROUPS).flat();
  const catalogMatches = allSlugs.filter(
    (slug) => slug.includes(q) && !matches.find((m) => m.slug === slug)
  );

  return {
    verified_sources: matches.map((s) => ({
      slug: s.slug,
      name: s.name,
      category: s.category,
      description: s.description,
      incremental: s.incremental,
      auth: s.auth,
    })),
    catalog_sources: catalogMatches,
    recommendation:
      matches.length > 0
        ? `Best match: ${matches[0].name} (slug: ${matches[0].slug}). It supports ${matches[0].incremental ? "incremental loading" : "full refresh only"}.`
        : catalogMatches.length > 0
          ? `Found in catalog: ${catalogMatches[0]}. Will use generic pipeline template.`
          : "No matching source found. Consider using rest_api for custom HTTP APIs.",
  };
}

function toolGetSourceDetails(slug: string) {
  const verified = getDltHubSource(slug);
  const allSlugs = Object.values(SOURCE_GROUPS).flat();
  const inCatalog = allSlugs.includes(slug);

  if (!verified && !inCatalog) {
    return { error: `Unknown source '${slug}'. Use search_sources to find valid slugs.` };
  }

  if (verified) {
    return {
      slug: verified.slug,
      name: verified.name,
      description: verified.description,
      category: verified.category,
      auth_methods: verified.auth,
      required_params: verified.params,
      incremental: verified.incremental,
      docs_url: verified.docsUrl,
      connector_slug: verified.slug,
      tool: chooseTool(slug, "duckdb"),
    };
  }

  return {
    slug,
    name: slug,
    description: "Source in built-in catalog (no dlt verified package — uses generic or Sling template).",
    tool: chooseTool(slug, "duckdb"),
    in_catalog: true,
  };
}

function toolListRegistry(category?: string) {
  const byCategory = getDltHubSourcesByCategory();
  if (category && byCategory[category]) {
    return {
      [category]: byCategory[category].map((s) => ({
        slug: s.slug,
        name: s.name,
        description: s.description,
        incremental: s.incremental,
      })),
    };
  }
  const result: Record<string, unknown> = {};
  for (const [cat, sources] of Object.entries(byCategory)) {
    result[cat] = sources.map((s) => ({ slug: s.slug, name: s.name, incremental: s.incremental }));
  }
  return result;
}

function toolSuggestRestApiConfig(
  base_url: string,
  endpoint?: string,
  sample_response?: string,
  auth_hint?: string,
) {
  // Heuristics based on URL patterns and sample response
  const url = (base_url + (endpoint ?? "")).toLowerCase();

  let pagination_type = "auto";
  let data_selector = "";
  let cursor_field = "";
  let auth_method = auth_hint ?? "bearer";

  // Common pagination patterns
  if (url.includes("cursor") || url.includes("after")) pagination_type = "cursor";
  else if (url.includes("page=") || url.includes("offset=")) pagination_type = "offset";

  // Common auth patterns
  if (url.includes("api_key") || url.includes("apikey")) auth_method = "api_key";
  if (url.includes("basic")) auth_method = "basic";

  // Try to detect data structure from sample
  if (sample_response) {
    try {
      const parsed = JSON.parse(sample_response) as Record<string, unknown>;
      const keys = Object.keys(parsed);
      // Common wrapper keys
      const dataKeys = ["data", "results", "items", "records", "events", "rows", "list"];
      const found = dataKeys.find((k) => keys.includes(k) && Array.isArray(parsed[k]));
      if (found) data_selector = found;

      // Look for cursor fields in first array item
      const arr = found ? (parsed[found] as unknown[]) : null;
      const firstItem = Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
      if (firstItem && typeof firstItem === "object") {
        const itemKeys = Object.keys(firstItem as object);
        const tsFields = ["updated_at", "created_at", "timestamp", "date", "modified_at", "last_modified"];
        const foundTs = tsFields.find((k) => itemKeys.includes(k));
        if (foundTs) cursor_field = foundTs;
      }
    } catch {
      // ignore parse errors
    }
  }

  return {
    suggested_config: {
      base_url,
      endpoint: endpoint ?? "/",
      http_method: "GET",
      pagination_type,
      data_selector: data_selector || null,
      auth_method,
      incremental_cursor_field: cursor_field || null,
    },
    notes: [
      data_selector ? `Detected data array at key '${data_selector}'` : "Could not detect data array key — you may need to set data_selector manually.",
      cursor_field ? `Detected timestamp field '${cursor_field}' — good for incremental loading.` : "No timestamp field detected — incremental loading may not be possible.",
      `Pagination: ${pagination_type} (adjust if needed — try 'offset' for page-based, 'cursor' for cursor-based, 'none' for single-page).`,
    ],
    next_steps: "Ask the user to confirm the data_selector and whether they have a cursor field for incremental loading.",
  };
}

/** Per-source inline config fields shown in the chat form. */
export type InlineField = {
  key: string;
  label: string;
  placeholder: string;
  type: "text" | "password" | "select";
  options?: string[];
  configPath: "sourceConfiguration" | "destinationType" | "name";
  help?: string;
};

const SOURCE_INLINE_FIELDS: Record<string, InlineField[]> = {
  github: [
    { key: "repo_owner", label: "GitHub org / owner", placeholder: "my-org", type: "text", configPath: "sourceConfiguration" },
    { key: "repo_name", label: "Repository name", placeholder: "my-repo", type: "text", configPath: "sourceConfiguration" },
    { key: "github_token_env", label: "Token env var name", placeholder: "GITHUB_TOKEN", type: "text", configPath: "sourceConfiguration", help: "Name of the env var holding your GitHub PAT" },
  ],
  stripe_analytics: [
    { key: "start_date", label: "Start date", placeholder: "2024-01-01", type: "text", configPath: "sourceConfiguration" },
  ],
  shopify_dlt: [
    { key: "private_app_password", label: "API password / token", placeholder: "shppa_...", type: "password", configPath: "sourceConfiguration" },
    { key: "store_url", label: "Store URL", placeholder: "my-store.myshopify.com", type: "text", configPath: "sourceConfiguration" },
  ],
  hubspot: [
    { key: "api_key", label: "Access token", placeholder: "pat-na1-...", type: "password", configPath: "sourceConfiguration" },
  ],
  salesforce: [
    { key: "user_name", label: "Username", placeholder: "user@example.com", type: "text", configPath: "sourceConfiguration" },
    { key: "password", label: "Password", placeholder: "••••••••", type: "password", configPath: "sourceConfiguration" },
    { key: "security_token", label: "Security token", placeholder: "abc123...", type: "password", configPath: "sourceConfiguration" },
  ],
  slack: [
    { key: "access_token", label: "Bot OAuth token", placeholder: "xoxb-...", type: "password", configPath: "sourceConfiguration" },
  ],
  notion: [
    { key: "database_ids", label: "Database ID(s)", placeholder: "abc123def456...", type: "text", configPath: "sourceConfiguration", help: "Comma-separated Notion database IDs" },
  ],
  airtable: [
    { key: "access_token", label: "Personal access token", placeholder: "pat...", type: "password", configPath: "sourceConfiguration" },
    { key: "base_id", label: "Base ID", placeholder: "appXXXXXXXXXXXXXX", type: "text", configPath: "sourceConfiguration" },
  ],
  jira: [
    { key: "subdomain", label: "Jira subdomain", placeholder: "mycompany", type: "text", configPath: "sourceConfiguration" },
    { key: "email", label: "Email", placeholder: "user@example.com", type: "text", configPath: "sourceConfiguration" },
    { key: "api_token", label: "API token", placeholder: "ATATT...", type: "password", configPath: "sourceConfiguration" },
  ],
  zendesk: [
    { key: "subdomain", label: "Zendesk subdomain", placeholder: "mycompany", type: "text", configPath: "sourceConfiguration" },
    { key: "email", label: "Email", placeholder: "user@example.com", type: "text", configPath: "sourceConfiguration" },
    { key: "token", label: "API token", placeholder: "abc123...", type: "password", configPath: "sourceConfiguration" },
  ],
  rest_api: [
    { key: "base_url", label: "Base URL", placeholder: "https://api.example.com", type: "text", configPath: "sourceConfiguration" },
    { key: "endpoint", label: "Endpoint path", placeholder: "/v1/events", type: "text", configPath: "sourceConfiguration" },
    { key: "resource_name", label: "Resource name", placeholder: "events", type: "text", configPath: "sourceConfiguration", help: "Used as the table name in the destination" },
  ],
  postgres: [
    { key: "tables", label: "Tables to sync", placeholder: "public.users, public.orders", type: "text", configPath: "sourceConfiguration", help: "Comma-separated schema.table names" },
  ],
  mysql: [
    { key: "tables", label: "Tables to sync", placeholder: "public.users, public.orders", type: "text", configPath: "sourceConfiguration" },
  ],
};

const DEST_INLINE_FIELDS: Record<string, InlineField[]> = {
  snowflake: [],   // credentials come from env vars — nothing to fill inline
  bigquery: [],
  redshift: [],
  databricks: [],
  postgres: [],
  duckdb: [],
};

function getInlineFields(sourceType: string): InlineField[] {
  return SOURCE_INLINE_FIELDS[sourceType.toLowerCase()] ?? [];
}

function toolGeneratePipeline(params: {
  name: string;
  source_type: string;
  destination_type: string;
  description?: string;
  source_configuration?: Record<string, unknown>;
  incremental?: boolean;
}) {
  const name = params.name.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^[^a-zA-Z]/, "p_");
  const tool = chooseTool(params.source_type, params.destination_type);

  const body: CreatePipelineBody = {
    name,
    sourceType: params.source_type,
    destinationType: params.destination_type,
    tool: tool === "sling" ? "sling" : "dlt",
    description: params.description ?? `Load ${params.source_type} data into ${params.destination_type}`,
    sourceConfiguration: params.source_configuration ?? {},
  };

  const requiredFields = getInlineFields(params.source_type);

  try {
    const artifacts = generatePipelineArtifacts(body);
    return {
      success: true,
      next_action: "save_pipeline",
      save_payload: body,
      required_fields: requiredFields,
      generated_code_preview: artifacts.pipelineCode.slice(0, 400) + (artifacts.pipelineCode.length > 400 ? "\n..." : ""),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Code generation failed",
      next_action: "save_pipeline",
      save_payload: body,
      required_fields: requiredFields,
    };
  }
}

// ── Agentic loop ──────────────────────────────────────────────────────────────

type Message = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  const user = await getCurrentDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI assistant not configured" }, { status: 503 });
  }

  const body = await request.json() as { messages: Message[] };
  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  // Convert plain messages to Anthropic format
  const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let iterationCount = 0;
  const MAX_ITERATIONS = 8;

  try {
  while (iterationCount < MAX_ITERATIONS) {
    iterationCount++;

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: anthropicMessages,
    });

    // No tool calls — final text response
    if (response.stop_reason === "end_turn") {
      const textContent = response.content.find((c) => c.type === "text");
      const text = textContent?.type === "text" ? textContent.text : "";

      // Check if a generate_pipeline tool was called in prior iterations
      // and return its save_payload if present
      const lastToolResult = anthropicMessages
        .filter((m) => m.role === "user")
        .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
        .filter((c): c is Anthropic.ToolResultBlockParam => typeof c === "object" && c.type === "tool_result")
        .pop();

      let savePayload: CreatePipelineBody | undefined;
      let requiredFields: InlineField[] | undefined;

      // Walk all tool results to find the most recent generate_pipeline result
      const allToolResults = anthropicMessages
        .filter((m) => m.role === "user")
        .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
        .filter((c): c is Anthropic.ToolResultBlockParam => typeof c === "object" && c.type === "tool_result");

      for (const toolResult of allToolResults) {
        try {
          const resultContent = Array.isArray(toolResult.content)
            ? toolResult.content.find((c) => c.type === "text")?.text
            : typeof toolResult.content === "string"
              ? toolResult.content
              : undefined;
          if (resultContent) {
            const parsed = JSON.parse(resultContent) as {
              save_payload?: CreatePipelineBody;
              next_action?: string;
              required_fields?: InlineField[];
            };
            if (parsed.next_action === "save_pipeline" && parsed.save_payload) {
              savePayload = parsed.save_payload;
              requiredFields = parsed.required_fields;
            }
          }
        } catch {
          // ignore
        }
      }

      return NextResponse.json({
        message: text,
        savePayload,
        requiredFields,
      });
    }

    // Process tool calls
    if (response.stop_reason === "tool_use") {
      anthropicMessages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        const { name, input, id } = block;

        let result: unknown;
        const inp = input as Record<string, unknown>;

        if (name === "search_sources") {
          result = toolSearchSources(String(inp.query ?? ""));
        } else if (name === "get_source_details") {
          result = toolGetSourceDetails(String(inp.slug ?? ""));
        } else if (name === "list_registry") {
          result = toolListRegistry(typeof inp.category === "string" ? inp.category : undefined);
        } else if (name === "suggest_rest_api_config") {
          result = toolSuggestRestApiConfig(
            String(inp.base_url ?? ""),
            typeof inp.endpoint === "string" ? inp.endpoint : undefined,
            typeof inp.sample_response === "string" ? inp.sample_response : undefined,
            typeof inp.auth_hint === "string" ? inp.auth_hint : undefined,
          );
        } else if (name === "generate_pipeline") {
          result = toolGeneratePipeline(inp as Parameters<typeof toolGeneratePipeline>[0]);
        } else {
          result = { error: `Unknown tool: ${name}` };
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: id,
          content: JSON.stringify(result),
        });
      }

      anthropicMessages.push({ role: "user", content: toolResults });
    }
  }

  return NextResponse.json({
    message: "I've reached the limit of my reasoning steps. Please try rephrasing your request.",
    savePayload: undefined,
  });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ai-assistant] error:", msg);
    return NextResponse.json(
      { message: `Something went wrong: ${msg}`, savePayload: undefined },
      { status: 500 }
    );
  }
}
