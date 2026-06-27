import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { Prisma } from "@prisma/client";
import { getCurrentDbUser } from "@/lib/auth/server";
import { canAccessAiAssistant } from "@/lib/plans/plan-enforcement";
import { db } from "@/lib/db/client";
import { getAccessibleResourceOwnerIds } from "@/lib/auth/workspace-access";
import { getWorkspacePermissions } from "@/lib/auth/org-permissions";
import { DLT_HUB_SOURCES, getDltHubSource, getDltHubSourcesByCategory } from "@/lib/elt/dlt-hub-registry";
import { SOURCE_GROUPS, DESTINATION_GROUPS } from "@/lib/elt/catalog";
import { chooseTool } from "@/lib/elt/choose-tool";
import { toDbtProjectSummary } from "@/lib/elt/dbt-projects";
import { generatePipelineArtifacts } from "@/lib/elt/generate-artifacts";
import { loadWorkspaceCatalogUrls } from "@/lib/elt/workspace-catalog-sources";
import { toPublicMcpServer } from "@/lib/elt/mcp-server/public";
import { KNOWN_MCP_SERVER_TEMPLATES, KNOWN_MCP_CATEGORY_LABELS } from "@/lib/elt/mcp-server/known-catalog";
import { discoverMcpTools } from "@/lib/elt/mcp-server/discover-tools";
import { mcpSecretsForServer } from "@/lib/elt/mcp-server/resolve";
import type { McpServerConfig, McpTransport } from "@/lib/elt/mcp-server/types";
import { setDbtTransformConfig } from "@/lib/elt/dbt-run-phases";
import { supportsInPipelineDbt } from "@/lib/elt/pipeline-tool-labels";
import { listComponents, getComponentById, fetchComponentSchema } from "@/lib/elt/component-registry";
import { getNativeComponent } from "@/lib/elt/native-components/registry";
import { routeComponent, type ComponentCompileTarget } from "@/lib/elt/component-compile-router";
import {
  applyCanvasComponentsToSourceConfig,
  type AiPipelineComponentInput,
} from "@/lib/elt/ai-pipeline-canvas-build";
import { applyCanvasGraphEdits, type CanvasGraphEditAction } from "@/lib/elt/canvas-graph-edit";
import type { WireInputContext } from "@/lib/elt/canvas-wire-input";
import { inferRawLandingTables, resolveLandingDataset } from "@/lib/elt/pipeline-assets";
import { isAdditiveCanvasPatch, isLocalCanvasPreviewPatch } from "@/lib/elt/canvas-patch-safety";
import { isTransformOnlyPipeline } from "@/lib/elt/pipeline-mode";
import { AI_PIPELINE_PLAYBOOKS, listPlaybooksForPrompt, matchPlaybook } from "@/lib/elt/ai-pipeline-playbook";
import {
  buildLakePipeline,
  LAKE_PIPELINE_STARTERS,
  listLakeStartersForPrompt,
  matchLakeStarter,
} from "@/lib/elt/lake-pipeline-starters";
import {
  buildTransformPipeline,
  normalizeTransformBuildMode,
  type TransformBuildMode,
  type TransformBuildStep,
} from "@/lib/elt/ai-transform-build";
import { extractComponentsFromCanvas } from "@/lib/elt/canvas-component-sync";
import { AI_COMPONENT_ROUTING_PROMPT, matchAiComponentIntent } from "@/lib/elt/ai-component-routing";
import { getCanvasFromSourceConfig } from "@/lib/elt/canvas-source-config";
import { validatePipelineCanvasGraph } from "@/lib/elt/validate-pipeline-canvas-graph";
import type { Edge, Node } from "@xyflow/react";
import type { CreatePipelineBody } from "@/lib/elt/types";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 4096;

function buildSystemPrompt(workspaceBlock: string, pipelineContextBlock?: string) {
  return `You are the eltPulse Pipeline Builder AI. Your ONLY job is to generate pipeline configs as fast as possible.

${workspaceBlock}
${pipelineContextBlock ? `\n${pipelineContextBlock}\n` : ""}

## Core rule: Generate immediately, don't interrogate

When a user describes a pipeline (e.g. "Load GitHub issues into Snowflake"), call generate_pipeline RIGHT AWAY using smart defaults. Do NOT ask clarifying questions first. Use these defaults:
- GitHub: repo_owner="your-org", repo_name="your-repo", resources=["issues","pull_requests"], github_token_env="GITHUB_TOKEN"
- Stripe: start_date="2024-01-01"
- REST API: base_url from context or placeholder, pagination_type="auto"
- Database sources: tables="public.users" as a placeholder
- EL+T with dbt: set post_transform_type="dbt" and dbt_package_path to a Git URL or ./dbt path; use list_dbt_projects to link an existing workspace project via dbt_project_id when one matches

After generating, give ONE short sentence: "Pipeline ready — click Save, then edit the repo/credentials in the builder or canvas."

## Transform-only focus (three execution paths)

When the user asks to **filter, sort, aggregate, dedupe, or reshape loaded data** (not ingest):

1. Call **build_transform_steps** with structured \`steps[]\` and \`mode\`:
   - **dbt** (default for production) — link a git dbt project when possible (\`dbt_package_path\` / \`dbt_project_id\`).
   - **warehouse** — canvas recipes and native CTAS components (fast prototype; not a substitute for dbt in prod).
   - **dataframe** (legacy) — worker pandas only when they explicitly ask for dataframe/pandas/legacy.
2. If \`mode\` is unclear, default **dbt** for mart/staging/production transforms; **warehouse** for recipe/medallion/canvas-native requests; **dataframe** only when legacy pandas is explicit.
3. For **single-lake pipeline patterns** (medallion, source→mart, enrich+DQ, union): call **build_lake_pipeline** (warehouse canvas path) — suggest promoting to dbt after.
4. Apply results via **generate_pipeline** / **add_pipeline_components** + **edit_pipeline_canvas** (\`graph_edits\`).
5. \`source_table\` default: \`staging.{pipeline_name}\` — never ask if a reasonable default exists.
6. Do **not** add ingest/sensor components for pure transform requests.

## Single-lake starters (agnostic — any entity, any warehouse)
${listLakeStartersForPrompt()}

Example — "filter active orders, sort by created_at desc, sum amount by day":
- Prefer **dbt** if a workspace project matches; else **build_transform_steps** mode=warehouse for canvas CTAS chain

Example — "one ingested table, build medallion layers":
- build_lake_pipeline starter_id=single_lake_medallion source_table=staging.events

## NL → canvas components
When the user mentions monitors, sensors, quality checks, or data validation:
1. Call **search_components** then **get_component_details** (include_schema=true when config fields matter).
2. **New pipeline**: pass \`components\` on **generate_pipeline** — each item needs \`component_id\` and sensible \`config\` (e.g. dq_check: table + not_null columns; s3_monitor: prefix/bucket defaults).
3. **Existing pipeline** (pipeline context below): call **add_pipeline_components** with the same \`components\` array — nodes land on the visual canvas and sync to v2 YAML on apply.
4. **Wire the graph** (connect/disconnect steps, add dbt transform after load): call **edit_pipeline_canvas** with \`actions[]\` — use node labels or ids like "source", "dest", "join", "filter".
5. **Playbooks** — call **list_pipeline_playbooks** or **build_lake_pipeline** for curated recipes; apply with add_pipeline_components + edit_pipeline_canvas in one turn.
6. Prefer **specific native** transform operators (filter_rows, join_tables, lookup, group_aggregate, **fill_nulls**, data_cleansing, **alter_row**, datetime_parser, pivot, anti_join, dq_check, etc.) — they compile and run inline on the canvas.
   - **fill_nulls** — replace null/missing values (e.g. all columns → 'N/A' via \`values\` JSON or a plain string for every column). Use this when the user says fill/impute/replace nulls.
   - **data_cleansing** — trim strings, optional lowercase, drop all-null rows only. Does **not** fill nulls with literals.
   - When the user wants both string cleanup **and** null imputation, add **two** steps chained: \`data_cleansing\` then \`fill_nulls\` (pass both in one \`components[]\` or two \`add_component\` actions).
   - **sql_transform** (SQL Transform) — **fallback only** when **search_components** / **get_component_details** show no native operator fits. Use one \`sql_transform\` step with \`config.sql\` (CTAS/SELECT referencing the upstream table). Do **not** default to raw SQL when a native id exists (e.g. fill nulls → fill_nulls, not SQL).
7. **AI / MCP** — ${AI_COMPONENT_ROUTING_PROMPT.replace(/\n/g, "\n   ")}
   Use **list_mcp_server_catalog** for known integrations; **list_mcp_servers** for workspace registrations. See [agent family demo](https://dagster-component-ui.vercel.app/examples/agent_family).

## Curated playbooks (use list_pipeline_playbooks)
${listPlaybooksForPrompt()}

Component config defaults:
- dq_check / unique_check: table = main entity table, not_null = ["id"] where applicable
- s3_monitor: prefix = "s3://your-bucket/incoming/"
- great_expectations_check: table + basic expectations in config when known

## Post-load transforms (EL+T)
- **dbt** — connector sync pipelines (dlt) support in-pipeline dbt after load. Set post_transform_type="dbt". Config persists as sourceConfiguration.dbt (enabled, package_path, dataset_name, repository_branch, run_scope, selector).
- **Link workspace dbt project** — when list_dbt_projects returns a match, pass dbt_project_id on generate_pipeline to link the pipeline row (same as the builder dbt project picker).
- **python / sql** — post_transform_type="python"|"sql" with post_transform_code snippet.
- Database-only replication (sling) does NOT support in-pipeline dbt — mention running dbt separately or use a connector sync source.

## Catalog & assets (informational)
- Workspace catalog (/catalog, /assets): browse pipelines, assets, dbt models; edit descriptions/tags when the user has catalog edit permission.
- Standalone dbt projects live at /catalog/dbt — register Git-backed projects, run standalone, or link to pipelines.

## Only ask questions when truly ambiguous
- If you genuinely cannot determine source OR destination, ask for just that one thing.
- For REST APIs with no URL at all: ask for the base URL only.
- Never ask about credentials, env vars, or optional config — use defaults.
- If the user cannot write pipelines (see workspace permissions), explain their role and suggest asking an admin — do NOT call generate_pipeline.

## Component catalog
- 864+ reusable pipeline components compile to ingest, replicate, transform, monitors, and Python steps — use **search_components** when the user asks for checks, sensors, transforms, or ingestion patterns by name.
- **get_component_details** returns compile target (ingest, quality, monitor, transform, python, platform) and monitor↔ingestion pairs.
- **generate_pipeline** accepts \`components[]\` to place nodes on the canvas for new pipelines.
- **add_pipeline_components** adds nodes to an open pipeline (canvas edit mode).
- Prefer native executable components over platform-only schema templates.
- Operator priority: (1) specific native transforms (filter_rows, fill_nulls, join_tables, …), (2) chain multiple natives if needed, (3) **sql_transform** only when no native operator matches after **search_components**.

## Format
- Be extremely brief. 1-3 sentences max after a generation.
- No bullet lists of questions. No "I just need a few details".
- No emojis.

Available source types: ${Object.values(SOURCE_GROUPS).flat().join(", ")}
Available destination types: ${Object.values(DESTINATION_GROUPS).flat().join(", ")}

Verified connectors: ${DLT_HUB_SOURCES.map((s) => `${s.slug} (${s.name})`).join(", ")}`;
}

const AI_COMPONENT_ITEMS_SCHEMA = {
  type: "array" as const,
  items: {
    type: "object" as const,
    properties: {
      component_id: {
        type: "string",
        description: "Component id from search_components, e.g. s3_monitor, dq_check, unique_check",
      },
      label: { type: "string", description: "Optional canvas label" },
      config: {
        type: "object",
        description: "Component config — table/not_null for quality, prefix for s3_monitor, etc.",
      },
    },
    required: ["component_id"],
  },
};


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
    description: "Given a REST API URL and optional docs snippet, suggest REST API source configuration: pagination type, auth method, data_selector, and cursor field for incremental loading.",
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
        post_transform_type: {
          type: "string",
          enum: ["none", "dbt", "python", "sql"],
          description: "Post-load transform after sync. Use dbt for EL+T on connector sync pipelines.",
        },
        dbt_package_path: {
          type: "string",
          description: "dbt project directory or Git URL (when post_transform_type=dbt)",
        },
        dbt_target_schema: {
          type: "string",
          description: "Warehouse schema/dataset for dbt models",
        },
        dbt_repository_branch: {
          type: "string",
          description: "Git branch for dbt project (default main)",
        },
        dbt_run_scope: {
          type: "string",
          enum: ["all", "selection"],
          description: "Run all models or a selection",
        },
        dbt_selector: {
          type: "string",
          description: "dbt --select expression when dbt_run_scope=selection",
        },
        dbt_project_id: {
          type: "string",
          description: "Optional workspace DbtProject id from list_dbt_projects to link instead of inline-only config",
        },
        post_transform_code: {
          type: "string",
          description: "Python or SQL code when post_transform_type is python or sql",
        },
        components: {
          ...AI_COMPONENT_ITEMS_SCHEMA,
          description:
            "Optional transform components (filter_rows, sort_rows, group_aggregate). Prefer build_transform_steps for NL transform requests.",
        },
        transform_mode: {
          type: "string",
          enum: ["dataframe", "warehouse", "dbt", "auto"],
          description:
            "With transform_steps: warehouse = native SQL after load; dataframe = worker pandas; dbt = linked git project only",
        },
        transform_source_table: {
          type: "string",
          description: "With transform_steps: input table e.g. staging.orders",
        },
        transform_steps: {
          type: "array",
          description: "Structured transform steps — alternative to calling build_transform_steps separately",
          items: {
            type: "object",
            properties: {
              op: { type: "string", enum: ["filter", "sort", "aggregate", "select_columns", "drop_duplicates", "limit"] },
              condition: { type: "string" },
              columns: { type: "array", items: { type: "string" } },
              ascending: { type: "boolean" },
              group_by: { type: "array", items: { type: "string" } },
              aggregations: { type: "object" },
              limit: { type: "number" },
            },
            required: ["op"],
          },
        },
      },
      required: ["name", "source_type", "destination_type"],
    },
  },
  {
    name: "add_pipeline_components",
    description:
      "Add component template nodes to an existing pipeline canvas. Requires pipeline context (canvas AI) or pipeline_id. Syncs to v2 declarative spec when applied.",
    input_schema: {
      type: "object" as const,
      properties: {
        pipeline_id: {
          type: "string",
          description: "Pipeline UUID — omit when editing from canvas (uses open pipeline).",
        },
        components: AI_COMPONENT_ITEMS_SCHEMA,
      },
      required: ["components"],
    },
  },
  {
    name: "list_dbt_projects",
    description:
      "List workspace dbt projects (standalone first-class projects at /catalog/dbt). Use before generate_pipeline when the user wants EL+T with an existing registered project.",
    input_schema: {
      type: "object" as const,
      properties: {
        source_slug: {
          type: "string",
          description: "Optional filter — projects tagged for this connector slug",
        },
      },
      required: [],
    },
  },
  {
    name: "search_components",
    description:
      "Search the pipeline component catalog (864+ components). Use for quality checks, sensors, ingestion templates, transforms. Returns compile target (ingest, replicate, quality, monitor, transform, python, platform).",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search term — e.g. 's3 monitor', 'great expectations', 'kafka ingest'" },
        category: {
          type: "string",
          description: "Optional category: ingestion, check, sensor, dbt, transformation, analytics, ai",
        },
        compile_target: {
          type: "string",
          description: "Optional filter: ingest, replicate, quality, monitor, transform, python, platform (internal ids: dlt, sling, dbt, dagster)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_component_details",
    description:
      "Get a component template by id: description, compile route, canvas ports, monitor↔ingestion pair, optional schema.json fields.",
    input_schema: {
      type: "object" as const,
      properties: {
        component_id: { type: "string", description: "Component id from search_components, e.g. s3_monitor" },
        include_schema: { type: "boolean", description: "Fetch remote schema.json for config field hints" },
      },
      required: ["component_id"],
    },
  },
  {
    name: "list_mcp_server_catalog",
    description:
      "Curated MCP integration templates (Stripe, GitHub, Postgres, Brave Search, etc.) — suggest these when the user needs to register a new MCP server.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "list_mcp_servers",
    description:
      "List workspace MCP server registry entries (stdio/http/sse). Use before mcp_tool_call or litellm_agent — pass mcp_server_id in component config.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "refresh_mcp_tools",
    description: "Discover tools from an MCP server (http/sse) and refresh the cached tool list.",
    input_schema: {
      type: "object" as const,
      properties: {
        mcp_server_id: { type: "string", description: "MCP server id from list_mcp_servers" },
      },
      required: ["mcp_server_id"],
    },
  },
  {
    name: "edit_pipeline_canvas",
    description:
      "Edit the visual pipeline graph: connect/disconnect nodes, add transform steps (dbt/python/sql), add components, or update a step's config (update_node_config). Requires pipeline context (canvas AI) or pipeline_id.",
    input_schema: {
      type: "object" as const,
      properties: {
        pipeline_id: {
          type: "string",
          description: "Pipeline UUID — omit when editing from canvas (uses open pipeline).",
        },
        actions: {
          type: "array",
          description: "Graph edit operations applied in order.",
          items: {
            type: "object",
            properties: {
              op: {
                type: "string",
                enum: ["connect", "disconnect", "add_component", "replace_component", "add_transform", "update_node_config"],
              },
              source: { type: "string", description: "connect/disconnect: source node label or id" },
              target: { type: "string", description: "connect/disconnect: target node label or id" },
              component_id: { type: "string", description: "add_component / replace_component: component id from search_components" },
              node: { type: "string", description: "update_node_config / replace_component: node id, label, or component id on canvas" },
              label: { type: "string" },
              config: { type: "object" },
              merge: { type: "boolean", description: "update_node_config: merge into existing config (default true)" },
              after: { type: "string", description: "Wire new node after this node (label/id)" },
              tool: { type: "string", enum: ["dbt", "python", "sql", "other"], description: "add_transform" },
              package_path: { type: "string" },
              selector: { type: "string" },
              code: { type: "string" },
            },
            required: ["op"],
          },
        },
      },
      required: ["actions"],
    },
  },
  {
    name: "build_transform_steps",
    description:
      "Build a filter/sort/aggregate transform chain. Returns components (dataframe) or warehouse SQL + graph_edits (warehouse path). Use dbt mode only with dbt_package_path.",
    input_schema: {
      type: "object" as const,
      properties: {
        mode: {
          type: "string",
          enum: ["dataframe", "warehouse", "dbt", "auto"],
          description:
            "dataframe = in-memory components; warehouse = native SQL CTAS after load; dbt = linked git project; auto = infer",
        },
        source_table: {
          type: "string",
          description: "Input warehouse table, e.g. staging.orders",
        },
        steps: {
          type: "array",
          description: "Ordered transform steps",
          items: {
            type: "object",
            properties: {
              op: {
                type: "string",
                enum: ["filter", "sort", "aggregate", "select_columns", "drop_duplicates", "limit"],
              },
              condition: { type: "string", description: "filter: pandas/SQL condition" },
              columns: { type: "array", items: { type: "string" } },
              ascending: { type: "boolean" },
              group_by: { type: "array", items: { type: "string" } },
              aggregations: {
                type: "object",
                description: 'aggregate: e.g. {"amount":"sum","id":"count"}',
              },
              limit: { type: "number" },
              output_suffix: { type: "string" },
            },
            required: ["op"],
          },
        },
        dbt_package_path: { type: "string", description: "Optional linked dbt project path" },
        dbt_target_schema: { type: "string" },
      },
      required: ["source_table", "steps"],
    },
  },
  {
    name: "build_lake_pipeline",
    description:
      "Build a curated single-lake (or light multi-source) transform chain after ingest. Agnostic — works for any entity/industry. Use for medallion, source→mart, enrich+DQ, union, or entity 360 patterns.",
    input_schema: {
      type: "object" as const,
      properties: {
        starter_id: {
          type: "string",
          enum: LAKE_PIPELINE_STARTERS.map((s) => s.id),
          description: "Lake pipeline starter recipe id",
        },
        source_table: {
          type: "string",
          description: "Primary loaded table, e.g. staging.events",
        },
        second_table: { type: "string", description: "Second source for union starters" },
        dimension_table: { type: "string", description: "Dimension table for enrich / entity 360 starters" },
        layer_prefix: { type: "string", description: "Output schema prefix, default marts" },
        join_key: { type: "string", description: "Join key column, default entity_id" },
        id_column: { type: "string", description: "Primary key for dedupe/DQ, default id" },
      },
      required: ["starter_id", "source_table"],
    },
  },
  {
    name: "list_pipeline_playbooks",
    description:
      "List curated high-value pipeline recipes (ingest+DQ, join enrich, clean+parse, S3 sensor, dbt after load). Use when user describes a pattern without naming specific component ids.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Optional filter — e.g. 'clean data', 'join', 's3 sensor'",
        },
      },
      required: [],
    },
  },
];

// ── Tool implementations ─────────────────────────────────────────────────────

function toolBuildTransformSteps(params: {
  mode?: string;
  source_table?: string;
  steps?: unknown;
  dbt_package_path?: string;
  dbt_target_schema?: string;
  user_query?: string;
}) {
  const rawSteps = Array.isArray(params.steps) ? params.steps : [];
  const steps: TransformBuildStep[] = rawSteps.flatMap((s) => {
    if (!s || typeof s !== "object") return [];
    const o = s as Record<string, unknown>;
    const op = String(o.op ?? "").trim() as TransformBuildStep["op"];
    if (!op) return [];
    const step: TransformBuildStep = {
      op,
      ...(typeof o.condition === "string" ? { condition: o.condition } : {}),
      ...(Array.isArray(o.columns) ? { columns: o.columns.map(String) } : {}),
      ...(typeof o.ascending === "boolean" || Array.isArray(o.ascending)
        ? { ascending: o.ascending as boolean | boolean[] }
        : {}),
      ...(Array.isArray(o.group_by) ? { group_by: o.group_by.map(String) } : {}),
      ...(o.aggregations && typeof o.aggregations === "object"
        ? { aggregations: o.aggregations as Record<string, string> }
        : {}),
      ...(typeof o.limit === "number" ? { limit: o.limit } : {}),
      ...(typeof o.output_suffix === "string" ? { output_suffix: o.output_suffix } : {}),
    };
    return [step];
  });

  const mode = normalizeTransformBuildMode(params.mode, {
    userQuery: params.user_query,
    dbtPackagePath: params.dbt_package_path,
  });

  const built = buildTransformPipeline({
    mode,
    source_table: String(params.source_table ?? "").trim(),
    steps,
    dbt_package_path: params.dbt_package_path,
    dbt_target_schema: params.dbt_target_schema,
  });

  return {
    ...built,
    next_action:
      built.components.length
        ? "Pass components[] to generate_pipeline or add_pipeline_components; wire graph_edits via edit_pipeline_canvas."
        : "Pass post_transform_type + post_transform_code to generate_pipeline; wire graph_edits via edit_pipeline_canvas.",
    generate_pipeline_fields: {
      components: built.components.length ? built.components : undefined,
      post_transform_type: built.post_transform_type,
      post_transform_code: built.post_transform_code,
      dbt_package_path: built.dbt_package_path,
      dbt_target_schema: built.dbt_target_schema,
      dbt_selector: built.dbt_selector,
      dbt_run_scope: built.dbt_run_scope,
    },
  };
}

function toolListPipelinePlaybooks(query?: string) {
  const q = query?.trim().toLowerCase();
  const playbookMatch = q ? matchPlaybook(q) : null;
  const lakeStarterMatch = q ? matchLakeStarter(q) : null;
  const playbooks = q
    ? AI_PIPELINE_PLAYBOOKS.filter(
        (p) =>
          p.id.includes(q) ||
          p.title.toLowerCase().includes(q) ||
          p.triggers.some((t) => t.includes(q) || q.includes(t))
      )
    : AI_PIPELINE_PLAYBOOKS;
  const lakeStarters = q
    ? LAKE_PIPELINE_STARTERS.filter(
        (s) =>
          s.id.includes(q) ||
          s.title.toLowerCase().includes(q) ||
          s.triggers.some((t) => t.includes(q) || q.includes(t))
      )
    : LAKE_PIPELINE_STARTERS;
  return {
    playbooks: playbooks.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      components: p.components,
      graph_edits: p.graphEdits,
    })),
    lake_starters: lakeStarters.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      source_count: s.sourceCount,
      tool: "build_lake_pipeline",
    })),
    best_match: playbookMatch
      ? {
          id: playbookMatch.id,
          title: playbookMatch.title,
          components: playbookMatch.components,
          graph_edits: playbookMatch.graphEdits,
        }
      : lakeStarterMatch
        ? { id: lakeStarterMatch.id, title: lakeStarterMatch.title, tool: "build_lake_pipeline" }
        : null,
    hint: "Apply playbooks with add_pipeline_components (components[]) then edit_pipeline_canvas (graph_edits). Lake starters via build_lake_pipeline.",
  };
}

function toolBuildLakePipeline(params: {
  starter_id?: string;
  source_table?: string;
  second_table?: string;
  dimension_table?: string;
  layer_prefix?: string;
  join_key?: string;
  id_column?: string;
}) {
  const built = buildLakePipeline({
    starter_id: String(params.starter_id ?? "").trim(),
    source_table: String(params.source_table ?? "").trim(),
    second_table: params.second_table,
    dimension_table: params.dimension_table,
    layer_prefix: params.layer_prefix,
    join_key: params.join_key,
    id_column: params.id_column,
  });
  return {
    ...built,
    next_action:
      "Pass components[] to generate_pipeline or add_pipeline_components; wire graph_edits via edit_pipeline_canvas.",
    generate_pipeline_fields: { components: built.components },
  };
}

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
    description: "Source in built-in catalog (uses generic connector sync or database replication template).",
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

function toolSearchComponents(query: string, category?: string, compileTarget?: string) {
  const { items, total } = listComponents({
    q: query,
    category,
    compileTarget: compileTarget as ComponentCompileTarget | undefined,
    limit: 15,
  });
  const intent = matchAiComponentIntent(query);
  let components = items;
  if (intent) {
    const match = getComponentById(intent.componentId);
    if (match && !components.some((c) => c.id === match.id)) {
      components = [match, ...components];
    }
  }
  const intentHint = intent
    ? `Intent match: **${intent.componentId}** — ${intent.reason}${
        intent.configHints ? ` Suggested config keys: ${Object.keys(intent.configHints).join(", ")}.` : ""
      }`
    : null;
  return {
    total,
    intent: intent
      ? { component_id: intent.componentId, reason: intent.reason, config_hints: intent.configHints ?? null }
      : null,
    components: components.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      description: c.description,
      compile_target: c.compileTarget,
      compile_hint: c.compileHint,
      monitor_pair: c.monitorPair ?? null,
    })),
    hint:
      intentHint ??
      (components.length > 0
        ? `Best match: ${components[0].name} (${components[0].id}) → compiles to ${components[0].compileTarget}. Use get_component_details for schema fields.`
        : "No components matched — try search_sources for connector slugs or generate_pipeline directly."),
  };
}

async function toolListMcpServerCatalog() {
  return {
    templates: KNOWN_MCP_SERVER_TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      vendor: t.vendor,
      category: KNOWN_MCP_CATEGORY_LABELS[t.category],
      description: t.description,
      transport: t.transport,
      docsUrl: t.docsUrl,
      envVars: t.envVars?.map((e) => e.name),
    })),
    hint: "User registers at /mcp-servers — pick a template, add secrets, then use the saved id in pipeline components.",
  };
}

async function toolListMcpServers(userId: string) {
  const ownerIds = await getAccessibleResourceOwnerIds(userId);
  try {
    const rows = await db.mcpServer.findMany({
      where: { userId: { in: ownerIds } },
      orderBy: { updatedAt: "desc" },
    });
    return {
      servers: rows.map((r) => ({
        ...toPublicMcpServer(r),
        tool_count: Array.isArray(r.toolsCache) ? (r.toolsCache as unknown[]).length : 0,
      })),
      hint: "Use mcp_server_id in mcp_tool_call or mcp_server_ids in litellm_agent component config.",
    };
  } catch {
    return { servers: [], _migrationPending: true };
  }
}

async function toolRefreshMcpTools(userId: string, serverId: string) {
  const ownerIds = await getAccessibleResourceOwnerIds(userId);
  const row = await db.mcpServer.findFirst({
    where: { id: serverId, userId: { in: ownerIds } },
  });
  if (!row) return { error: "MCP server not found" };
  const config = (row.config ?? {}) as McpServerConfig;
  const secrets = await mcpSecretsForServer(row);
  try {
    const tools = await discoverMcpTools({
      name: row.name,
      transport: row.transport as McpTransport,
      config,
      secrets,
    });
    await db.mcpServer.update({
      where: { id: row.id },
      data: { toolsCache: tools as Prisma.InputJsonValue, toolsCachedAt: new Date() },
    });
    return { server_id: row.id, tools };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

async function toolGetComponentDetails(componentId: string, includeSchema?: boolean) {
  const c = getComponentById(componentId);
  if (!c) {
    return { error: `Unknown component '${componentId}'. Use search_components first.` };
  }
  const route = routeComponent(c.id, c.category);
  const native = getNativeComponent(c.id);
  let schema: unknown = null;
  if (includeSchema && c.schema_url) {
    schema = await fetchComponentSchema(c.schema_url);
  }
  const nativeFields = native?.fields.map((f) => ({
    key: f.key,
    label: f.label,
    type: f.type,
    required: f.required ?? false,
    default: f.default,
    options: f.options,
    description: f.description,
  }));
  return {
    id: c.id,
    name: c.name,
    category: c.category,
    description: c.description,
    compile_target: c.compileTarget,
    compile_badge: c.compileBadge,
    compile_hint: c.compileHint,
    canvas_ports: c.canvasPorts,
    monitor_pair: c.monitorPair ?? null,
    route,
    schema_url: c.schema_url,
    ...(nativeFields?.length ? { native_config_fields: nativeFields } : {}),
    ...(schema ? { schema } : {}),
    config_hint:
      nativeFields?.length
        ? `Pass native_config_fields as \`config\` on add_component, replace_component, or update_node_config. Required: ${nativeFields.filter((f) => f.required).map((f) => f.key).join(", ") || "none"}.`
        : includeSchema
          ? "Use schema properties for config keys when adding this component."
          : "Call again with include_schema=true for remote schema.json field hints.",
    next_steps:
      route.target === "quality" || route.target === "monitor"
        ? "Pass in components[] on generate_pipeline (new) or add_pipeline_components (existing pipeline)."
        : route.target === "dlt" || route.target === "sling"
          ? "Call generate_pipeline with matching source_type/destination_type — or add as components[] for canvas placement."
          : route.target === "dbt"
            ? "Use list_dbt_projects + post_transform_type=dbt on generate_pipeline."
            : "May need Python post-transform or a platform-only template — explain compile badge to user.",
  };
}

async function toolListDbtProjects(userId: string, sourceSlug?: string) {
  const ownerIds = await getAccessibleResourceOwnerIds(userId);
  const rows = await db.dbtProject.findMany({
    where: { userId: { in: ownerIds } },
    orderBy: { updatedAt: "desc" },
    include: {
      pipelines: {
        select: { id: true, name: true, enabled: true, sourceType: true, destinationType: true },
      },
    },
  });
  let projects = rows.map(toDbtProjectSummary);
  if (sourceSlug?.trim()) {
    const slug = sourceSlug.trim().toLowerCase();
    projects = projects.filter((p) => (p.sourceSlug ?? "").toLowerCase() === slug);
  }
  return {
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      packagePath: p.packagePath,
      gitUrl: p.gitUrl,
      targetSchema: p.targetSchema,
      sourceSlug: p.sourceSlug,
      linkedPipelineCount: p.linkedPipelineIds.length,
    })),
    hint:
      projects.length > 0
        ? "Pass dbt_project_id to generate_pipeline to link a pipeline to one of these projects."
        : "No workspace dbt projects yet — use inline dbt_package_path or tell the user to create one at /catalog/dbt/new.",
  };
}

type GeneratePipelineParams = {
  name: string;
  source_type: string;
  destination_type: string;
  description?: string;
  source_configuration?: Record<string, unknown>;
  incremental?: boolean;
  post_transform_type?: string;
  dbt_package_path?: string;
  dbt_target_schema?: string;
  dbt_repository_branch?: string;
  dbt_run_scope?: string;
  dbt_selector?: string;
  dbt_project_id?: string;
  post_transform_code?: string;
  components?: AiPipelineComponentInput[];
  transform_mode?: TransformBuildMode | "auto";
  transform_steps?: TransformBuildStep[];
  transform_source_table?: string;
};

function normalizeAiComponents(raw: unknown): AiPipelineComponentInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const component_id = String(o.component_id ?? "").trim();
      if (!component_id) return null;
      return {
        component_id,
        ...(typeof o.label === "string" && o.label.trim() ? { label: o.label.trim() } : {}),
        ...(o.config && typeof o.config === "object" ? { config: o.config as Record<string, unknown> } : {}),
      };
    })
    .filter((x): x is AiPipelineComponentInput => x !== null);
}

export type PatchPipelinePayload = {
  canvas: { nodes: unknown[]; edges: unknown[]; v?: number };
};

type CanvasSnapshot = { nodes: unknown[]; edges: unknown[]; v?: number };

function mergeCanvasSnapshotIntoConfig(
  base: Record<string, unknown>,
  snapshot?: CanvasSnapshot | null
): Record<string, unknown> {
  if (!snapshot || !Array.isArray(snapshot.nodes) || snapshot.nodes.length === 0) return base;
  return {
    ...base,
    canvas: {
      nodes: snapshot.nodes,
      edges: Array.isArray(snapshot.edges) ? snapshot.edges : [],
      v: snapshot.v ?? 1,
    },
  };
}

function countTransformNodes(nodes: Node[]): number {
  return nodes.filter((n) => n.type === "componentNode" || n.type === "transformNode").length;
}

function pulseCanvasGraphShrinkError(beforeNodes: Node[], afterNodes: Node[], pulseCanvasMode: boolean): string | null {
  if (!pulseCanvasMode) return null;
  const beforeTransforms = countTransformNodes(beforeNodes);
  const afterTransforms = countTransformNodes(afterNodes);
  if (beforeTransforms > 0 && afterTransforms < beforeTransforms) {
    return `Blocked: edit would remove transform steps (${beforeTransforms} → ${afterTransforms}). Use update_node_config on the selected step instead.`;
  }
  if (beforeNodes.length > 2 && afterNodes.length < beforeNodes.length) {
    return `Blocked: edit would remove canvas nodes (${beforeNodes.length} → ${afterNodes.length}). Use update_node_config for config-only changes.`;
  }
  return null;
}

function wireInputContextFromPipeline(
  pipeline: {
    name: string;
    sourceType: string;
    destinationType: string;
    tool: string;
  },
  sourceConfiguration: Record<string, unknown>
): WireInputContext {
  return {
    rawLandingTables: inferRawLandingTables({
      name: pipeline.name,
      sourceType: pipeline.sourceType,
      destinationType: pipeline.destinationType,
      tool: pipeline.tool,
      sourceConfiguration,
    }),
    landingDataset: resolveLandingDataset(pipeline.sourceType, sourceConfiguration, pipeline.name),
    pipelineName: pipeline.name,
  };
}

async function toolEditPipelineCanvas(
  userId: string,
  contextPipelineId: string | undefined,
  params: { pipeline_id?: string; actions?: unknown },
  options?: { canvasSnapshot?: CanvasSnapshot | null; pulseCanvasMode?: boolean; pulseTargetNodeId?: string }
) {
  const pipelineId = String(params.pipeline_id ?? contextPipelineId ?? "").trim();
  const actions = Array.isArray(params.actions)
    ? (params.actions as CanvasGraphEditAction[])
    : [];
  if (!pipelineId) {
    return {
      success: false,
      error: "No pipeline_id — open the AI assistant from the canvas with a pipeline selected.",
    };
  }
  if (actions.length === 0) {
    return { success: false, error: "actions array is required with at least one op." };
  }

  const ownerIds = await getAccessibleResourceOwnerIds(userId);
  const pipeline = await db.eltPipeline.findFirst({
    where: { id: pipelineId, userId: { in: ownerIds } },
  });
  if (!pipeline) {
    return { success: false, error: "Pipeline not found or access denied." };
  }

  const base = mergeCanvasSnapshotIntoConfig(
    { ...(pipeline.sourceConfiguration as Record<string, unknown>) },
    options?.canvasSnapshot
  );
  const beforeNodes = ((getCanvasFromSourceConfig(base)?.nodes ?? []) as Node[]);
  const edited = applyCanvasGraphEdits(base, actions, {
    sourceType: pipeline.sourceType,
    destinationType: pipeline.destinationType,
    pipelineName: pipeline.name,
    transformOnly: isTransformOnlyPipeline(base),
    wireInputContext: wireInputContextFromPipeline(pipeline, base),
  });

  if (edited.errors.length && !edited.messages.length) {
    return { success: false, errors: edited.errors };
  }

  const afterNodes = edited.canvas.nodes as Node[];
  const shrinkErr = pulseCanvasGraphShrinkError(beforeNodes, afterNodes, options?.pulseCanvasMode ?? false);
  if (shrinkErr) {
    return { success: false, error: shrinkErr, errors: edited.errors, messages: edited.messages };
  }

  const validation = validatePipelineCanvasGraph(
    edited.canvas.nodes as Node[],
    edited.canvas.edges as Edge[],
    {
      requireConnectorTypes: true,
      pipelineSourceType: pipeline.sourceType,
      pipelineDestinationType: pipeline.destinationType,
      transformOnly: isTransformOnlyPipeline(base),
    }
  );
  if (!validation.ok) {
    return {
      success: false,
      error: "Canvas validation failed",
      errors: [...edited.errors, ...validation.errors],
      messages: edited.messages,
    };
  }

  const configOnly =
    actions.length > 0 && actions.every((a) => a.op === "update_node_config");
  const localPreview = isLocalCanvasPreviewPatch(beforeNodes, afterNodes);
  let nodePatch: { node_id: string; config: Record<string, unknown> } | undefined;
  if (configOnly && options?.pulseTargetNodeId) {
    const updated = afterNodes.find((n) => n.id === options.pulseTargetNodeId);
    const cfg = (updated?.data as Record<string, unknown> | undefined)?.config;
    if (updated && cfg && typeof cfg === "object") {
      nodePatch = { node_id: updated.id, config: cfg as Record<string, unknown> };
    }
  }

  return {
    success: true,
    next_action:
      configOnly && nodePatch
        ? "patch_node_local"
        : localPreview && (options?.pulseCanvasMode ?? false)
          ? "patch_canvas_local"
          : "patch_pipeline",
    pipeline_id: pipelineId,
    patch_payload: { canvas: edited.canvas } satisfies PatchPipelinePayload,
    ...(nodePatch ? { node_patch: nodePatch } : {}),
    messages: edited.messages,
    graph_errors: edited.errors.length ? edited.errors : undefined,
  };
}

async function toolAddPipelineComponents(
  userId: string,
  contextPipelineId: string | undefined,
  params: { pipeline_id?: string; components?: unknown },
  options?: {
    canvasSnapshot?: CanvasSnapshot | null;
    pulseCanvasMode?: boolean;
    pulseTargetNodeId?: string;
  }
) {
  const pipelineId = String(params.pipeline_id ?? contextPipelineId ?? "").trim();
  const components = normalizeAiComponents(params.components);
  if (!pipelineId) {
    return {
      success: false,
      error: "No pipeline_id — open the AI assistant from the canvas with a pipeline selected.",
    };
  }
  if (components.length === 0) {
    return { success: false, error: "components array is required and must include at least one component_id." };
  }

  // Pulse bar "add after this step" — insert on the anchored node, not at pipeline tail.
  if (options?.pulseCanvasMode && options.pulseTargetNodeId) {
    let after = options.pulseTargetNodeId;
    const actions: CanvasGraphEditAction[] = components.map((c) => {
      const action: CanvasGraphEditAction = {
        op: "add_component",
        component_id: c.component_id,
        label: c.label,
        config: c.config,
        after,
      };
      after = c.label?.trim() || c.component_id;
      return action;
    });
    return toolEditPipelineCanvas(userId, pipelineId, { pipeline_id: pipelineId, actions }, options);
  }

  const ownerIds = await getAccessibleResourceOwnerIds(userId);
  const pipeline = await db.eltPipeline.findFirst({
    where: { id: pipelineId, userId: { in: ownerIds } },
  });
  if (!pipeline) {
    return { success: false, error: "Pipeline not found or access denied." };
  }

  const base = mergeCanvasSnapshotIntoConfig(
    { ...(pipeline.sourceConfiguration as Record<string, unknown>) },
    options?.canvasSnapshot
  );
  const beforeNodes = ((getCanvasFromSourceConfig(base)?.nodes ?? []) as Node[]);
  const existing = getCanvasFromSourceConfig(base);
  const applied = applyCanvasComponentsToSourceConfig(base, {
    sourceType: pipeline.sourceType,
    destinationType: pipeline.destinationType,
    components,
    existingCanvas: existing,
  });

  const afterNodes = applied.canvas.nodes as Node[];
  const shrinkErr = pulseCanvasGraphShrinkError(beforeNodes, afterNodes, options?.pulseCanvasMode ?? false);
  if (shrinkErr) {
    return { success: false, error: shrinkErr, skipped_components: applied.skippedComponents };
  }

  const validation = validatePipelineCanvasGraph(
    applied.canvas.nodes as Node[],
    applied.canvas.edges as Edge[],
    {
      requireConnectorTypes: true,
      pipelineSourceType: pipeline.sourceType,
      pipelineDestinationType: pipeline.destinationType,
      transformOnly: isTransformOnlyPipeline(base),
    }
  );
  if (!validation.ok) {
    return {
      success: false,
      error: "Canvas validation failed",
      errors: validation.errors,
      skipped_components: applied.skippedComponents,
    };
  }

  const warnings: string[] = [];
  if (applied.skippedComponents.length) {
    warnings.push(`Unknown component ids skipped: ${applied.skippedComponents.join(", ")}`);
  }
  if (applied.extracted.sensorMonitors.length) {
    warnings.push(
      `${applied.extracted.sensorMonitors.length} sensor(s) will create monitors when applied (requires source connection).`
    );
  }

  const additiveOnly = isAdditiveCanvasPatch(beforeNodes, afterNodes);

  return {
    success: true,
    next_action:
      additiveOnly && (options?.pulseCanvasMode ?? false) ? "patch_canvas_local" : "patch_pipeline",
    pipeline_id: pipelineId,
    patch_payload: { canvas: applied.canvas } satisfies PatchPipelinePayload,
    components_added: applied.extracted.components.map((c) => c.id),
    sensor_monitors: applied.extracted.sensorMonitors.map((s) => s.label),
    skipped_components: applied.skippedComponents,
    warnings: warnings.length ? warnings : undefined,
  };
}

function applyPostTransformToConfig(
  base: Record<string, unknown>,
  params: GeneratePipelineParams,
  sourceType: string,
  destinationType: string
): { dbtProjectId?: string | null; warnings: string[] } {
  const warnings: string[] = [];
  const transformType = String(params.post_transform_type ?? "none").toLowerCase();

  if (transformType === "dbt" || params.dbt_project_id) {
    if (!supportsInPipelineDbt(chooseTool(sourceType, destinationType))) {
      warnings.push(
        "In-pipeline dbt is not supported for this source/destination pair (database replication). dbt config was omitted."
      );
      return { warnings };
    }

    if (params.dbt_project_id) {
      return { dbtProjectId: params.dbt_project_id, warnings };
    }

    const packagePath = String(params.dbt_package_path ?? "").trim();
    if (!packagePath) {
      warnings.push("post_transform_type=dbt but no dbt_package_path — add a Git URL or ./dbt path.");
      return { warnings };
    }

    const runScope = params.dbt_run_scope === "selection" ? "selection" : "all";
    const cfg: Record<string, unknown> = {
      enabled: true,
      package_path: packagePath,
      run_scope: runScope,
    };
    if (/^https?:\/\//i.test(packagePath)) cfg.git_url = packagePath;
    const schema = String(params.dbt_target_schema ?? "").trim();
    if (schema) cfg.dataset_name = schema;
    const branch = String(params.dbt_repository_branch ?? "").trim();
    if (branch) cfg.repository_branch = branch;
    const selector = String(params.dbt_selector ?? "").trim();
    if (runScope === "selection" && selector) cfg.selector = selector;
    setDbtTransformConfig(base, cfg);
    return { warnings };
  }

  if (transformType === "python" || transformType === "sql") {
    const code = String(params.post_transform_code ?? "").trim();
    if (code) {
      base.post_transform = { type: transformType, code };
    } else {
      warnings.push(`${transformType} transform requested but post_transform_code is empty.`);
    }
  }

  return { warnings };
}

async function toolGeneratePipeline(userId: string, params: GeneratePipelineParams) {
  const name = params.name.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^[^a-zA-Z]/, "p_");
  const tool = chooseTool(params.source_type, params.destination_type);

  const body: CreatePipelineBody = {
    name,
    sourceType: params.source_type,
    destinationType: params.destination_type,
    tool: tool === "sling" ? "sling" : "dlt",
    description: params.description ?? `Load ${params.source_type} data into ${params.destination_type}`,
    sourceConfiguration: { ...(params.source_configuration ?? {}) },
  };

  const genWarnings: string[] = [];
  const componentInputs = normalizeAiComponents(params.components);

  if (params.transform_steps?.length && params.transform_source_table) {
    const mode = normalizeTransformBuildMode(params.transform_mode, {
      dbtPackagePath: params.dbt_package_path,
    });
    const built = buildTransformPipeline({
      mode,
      source_table: params.transform_source_table,
      steps: params.transform_steps,
      dbt_package_path: params.dbt_package_path,
      dbt_target_schema: params.dbt_target_schema,
    });
    if (built.components.length) {
      componentInputs.push(...built.components);
    }
    if (built.post_transform_type && built.post_transform_code) {
      params.post_transform_type = built.post_transform_type;
      params.post_transform_code = built.post_transform_code;
    }
    if (built.dbt_package_path) {
      params.dbt_package_path = built.dbt_package_path;
      params.dbt_selector = built.dbt_selector;
      params.dbt_run_scope = built.dbt_run_scope;
      if (built.dbt_target_schema) params.dbt_target_schema = built.dbt_target_schema;
    }
    genWarnings.push(...built.messages);
  }

  const { dbtProjectId, warnings } = applyPostTransformToConfig(
    body.sourceConfiguration as Record<string, unknown>,
    params,
    params.source_type,
    params.destination_type
  );
  if (dbtProjectId) body.dbtProjectId = dbtProjectId;
  genWarnings.push(...warnings);

  let componentSummary: string[] | undefined;

  if (componentInputs.length) {
    const applied = applyCanvasComponentsToSourceConfig(
      body.sourceConfiguration as Record<string, unknown>,
      {
        sourceType: params.source_type,
        destinationType: params.destination_type,
        components: componentInputs,
      }
    );
    body.sourceConfiguration = applied.sourceConfiguration;
    componentSummary = applied.extracted.components.map((c) => c.id);
    if (applied.skippedComponents.length) {
      genWarnings.push(`Unknown component ids skipped: ${applied.skippedComponents.join(", ")}`);
    }
    if (applied.extracted.sensorMonitors.length) {
      genWarnings.push(
        `${applied.extracted.sensorMonitors.length} sensor component(s) on canvas — monitors apply after save when a source connection is linked.`
      );
    }
  }

  const requiredFields = getInlineFields(params.source_type);

  try {
    const workspaceCatalogUrls = await loadWorkspaceCatalogUrls(userId);
    const artifacts = await generatePipelineArtifacts(body, {
      workspaceCatalogUrls,
      ownerIds: await getAccessibleResourceOwnerIds(userId),
    });
    const preview = artifacts.pipelineCode.slice(0, 800) + (artifacts.pipelineCode.length > 800 ? "\n# ... (truncated)" : "");
    return {
      success: true,
      next_action: "save_pipeline",
      save_payload: body,
      required_fields: requiredFields,
      generated_code_preview: preview,
      components_added: componentSummary,
      warnings: genWarnings.length > 0 ? genWarnings : undefined,
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Code generation failed",
      next_action: "save_pipeline",
      save_payload: body,
      required_fields: requiredFields,
      generated_code_preview: null,
      components_added: componentSummary,
      warnings: genWarnings.length > 0 ? genWarnings : undefined,
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

  const planCheck = canAccessAiAssistant(user.subscription);
  if (!planCheck.allowed) {
    return NextResponse.json(
      { error: planCheck.reason, upgradeRequired: planCheck.upgradeRequired },
      { status: 403 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI assistant not configured" }, { status: 503 });
  }

  const body = await request.json() as {
    messages: Message[];
    lastRunError?: string;
    pipelineId?: string;
    canvasSnapshot?: CanvasSnapshot;
    canvasNodeContext?: {
      nodeId: string;
      componentId?: string;
      label?: string;
      config?: Record<string, unknown>;
    };
  };
  const { messages, lastRunError, pipelineId, canvasNodeContext, canvasSnapshot } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const perms = await getWorkspacePermissions(user.id);
  const workspaceBlock = `## Workspace permissions (current user)
- Role: ${perms.role}
- Can create/save pipelines: ${perms.canWrite ? "yes" : "no (read-only)"}
- Can edit catalog metadata: ${perms.canEditCatalog ? "yes" : "no"}
- Catalog browse: ${perms.catalogVisibility === "public_only" ? "public-tagged entries only" : "full workspace catalog"}`;

  if (!perms.canWrite) {
    return NextResponse.json({
      message:
        "Your workspace role is read-only for pipelines (" +
        perms.role +
        "). You can browse the catalog and assets, but creating or saving pipelines requires a member role. Ask your workspace owner to upgrade your invite.",
      savePayload: undefined,
      permissions: {
        role: perms.role,
        canWrite: perms.canWrite,
        canEditCatalog: perms.canEditCatalog,
        catalogVisibility: perms.catalogVisibility,
      },
    });
  }

  let runErrorContext = lastRunError;
  let pipelineContextBlock = "";
  if (pipelineId) {
    const ownerIds = await getAccessibleResourceOwnerIds(user.id);
    const pipeline = await db.eltPipeline.findFirst({
      where: { id: pipelineId, userId: { in: ownerIds } },
    });
    if (pipeline) {
      const cfg = (pipeline.sourceConfiguration ?? {}) as Record<string, unknown>;
      const canvas = getCanvasFromSourceConfig(cfg);
      const onCanvas = canvas
        ? extractComponentsFromCanvas(canvas.nodes as Node[], canvas.edges as Edge[])
        : { components: [], sensorMonitors: [] };
      pipelineContextBlock = `## Current pipeline (canvas edit mode)
- Pipeline ID: ${pipeline.id}
- Name: ${pipeline.name}
- Source → Destination: ${pipeline.sourceType} → ${pipeline.destinationType}
- Components on canvas: ${onCanvas.components.map((c) => c.id).join(", ") || "none"}
- Sensor monitors on canvas: ${onCanvas.sensorMonitors.map((s) => s.label).join(", ") || "none"}

When the user asks to add checks, sensors, or transforms, call **add_pipeline_components** (omit pipeline_id — context is set).
When they ask to connect steps, wire join→filter, or add dbt after load, call **edit_pipeline_canvas** with actions[].
When they describe a brand-new pipeline instead, use **generate_pipeline** without pipeline_id.`;
      const inPulseCanvasBar = Boolean(canvasSnapshot?.nodes?.length);
      if (inPulseCanvasBar) {
        pipelineContextBlock += `

## Pulse AI (canvas designer bar — primary use cases)
1. **Add a step** — "add a filter", "dedupe after bronze", "aggregate by day", "fill nulls with N/A":
   - **search_components** first when the transform type is unclear — pick the best native \`component_id\`.
   - Call **add_pipeline_components** with one or more native ids (filter_rows, dedupe_rows, group_aggregate, **fill_nulls**, data_cleansing, **alter_row**, select_columns, join_tables, etc.)
   - For **fill nulls / impute / replace missing with a literal**, use **fill_nulls** — not data_cleansing. Example config: \`{ "values": "N/A" }\` (all columns) or \`{ "values": {"col_a":"N/A","col_b":"N/A"} }\`.
   - For **trim/lowercase/drop empty rows**, use **data_cleansing**.
   - When both are needed, pass **two** components in order: data_cleansing then fill_nulls.
   - **sql_transform** only if no native operator fits — single step with \`config: { "sql": "CREATE OR REPLACE TABLE … AS SELECT …" }\` referencing the wired upstream table. Never use SQL when fill_nulls, filter_rows, join_tables, etc. apply.
   - OR **edit_pipeline_canvas** with \`add_component\` + \`after\` set to the upstream node id/label
   - **Preserve every node** in the live canvas snapshot — only append/wire new steps
2. **Replace a step** — "swap data cleansing for alter row", "use filter_rows instead":
   - **search_components** for the target id (e.g. \`alter_row\` for "alter rows" / CDC tagging)
   - **get_component_details** with \`include_schema=true\` for required \`config\` fields (table, conditions, etc.)
   - **edit_pipeline_canvas** with \`replace_component\` + \`config\` on the node id/label — keeps position and wires; do **not** remove+add (removal is blocked in Pulse AI canvas mode)
   - Canvas updates immediately in the designer; user clicks **Save to pipeline** to persist
3. **Edit a step's settings** — rename columns, change filter, etc.:
   - **edit_pipeline_canvas** with \`update_node_config\` on the target node id
4. **Connect / rewire** — \`connect\` / \`disconnect\` actions only when asked
5. **AI / structured extraction / RAG / agents** — follow the AI component picker table in the system prompt. Examples:
   - "extract name and company from email body" → **litellm_structured_output** with \`text_column\`, \`schema_definition\`, \`output_table\`
   - "run MCP agent on each support ticket" → **litellm_agent** with \`table\`, \`prompt_column\`, \`output_table\`, \`mcp_server_ids\`
   - "summarize each row" → **litellm_inference_asset** (not agent unless tools/MCP needed)

Do **NOT** call generate_pipeline, build_lake_pipeline, or build_transform_steps on this open pipeline unless the user explicitly asks to replace the entire pipeline.`;
      }
      if (canvasNodeContext?.nodeId) {
        pipelineContextBlock += `

## Pulse AI anchor step (selected on canvas)
- Node ID: ${canvasNodeContext.nodeId}
- Component: ${canvasNodeContext.componentId ?? "unknown"}
- Label: ${canvasNodeContext.label ?? "—"}
- Config JSON: ${JSON.stringify(canvasNodeContext.config ?? {})}

When the user **adds a step** without naming a position, wire it **after** \`${canvasNodeContext.nodeId}\` (\`after\` field or downstream edge).
When the user **edits** this step, use \`update_node_config\` on \`${canvasNodeContext.nodeId}\`.`;
      }
      if (canvasSnapshot?.nodes?.length) {
        const snapNodes = canvasSnapshot.nodes as Node[];
        const snapLabels = snapNodes
          .map((n) => {
            const d = n.data as Record<string, unknown> | undefined;
            return `${n.id}:${String(d?.label ?? d?.componentId ?? n.type ?? "?")}`;
          })
          .join(", ");
        pipelineContextBlock += `

## Live canvas snapshot (from designer — may include unsaved edits)
- Nodes (${snapNodes.length}): ${snapLabels}
Use this as the source of truth for graph edits — not the last saved pipeline alone.`;
      }
    }
    if (!runErrorContext) {
      const lastFail = await db.eltPipelineRun.findFirst({
        where: { pipelineId, status: "failed" },
        orderBy: { startedAt: "desc" },
        select: { errorSummary: true },
      });
      runErrorContext = lastFail?.errorSummary ?? undefined;
    }
  }

  const messagesWithContext = runErrorContext
    ? messages.map((m, i) =>
        i === 0
          ? {
              ...m,
              content: `[Context: the last run of this pipeline failed with error: "${runErrorContext}"]\n\n${m.content}`,
            }
          : m
      )
    : messages;

  const client = new Anthropic({ apiKey });

  const anthropicMessages: Anthropic.MessageParam[] = messagesWithContext.map((m) => ({
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
      system: buildSystemPrompt(workspaceBlock, pipelineContextBlock),
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
      let patchPayload: PatchPipelinePayload | undefined;
      let patchPipelineId: string | undefined;
      let patchMode: "canvas_local" | "pipeline" | undefined;
      let nodePatch: { nodeId: string; config: Record<string, unknown> } | undefined;
      let requiredFields: InlineField[] | undefined;
      let codePreview: string | undefined;
      let componentSummary: string[] | undefined;

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
              patch_payload?: PatchPipelinePayload;
              pipeline_id?: string;
              next_action?: string;
              node_patch?: { node_id: string; config: Record<string, unknown> };
              required_fields?: InlineField[];
              generated_code_preview?: string | null;
              components_added?: string[];
            };
            if (parsed.next_action === "save_pipeline" && parsed.save_payload) {
              savePayload = parsed.save_payload;
              requiredFields = parsed.required_fields;
              codePreview = parsed.generated_code_preview ?? undefined;
              if (parsed.components_added?.length) componentSummary = parsed.components_added;
            }
            if (parsed.next_action === "patch_pipeline" && parsed.patch_payload) {
              patchPayload = parsed.patch_payload;
              patchPipelineId = parsed.pipeline_id;
              patchMode = "pipeline";
              if (parsed.components_added?.length) componentSummary = parsed.components_added;
            }
            if (parsed.next_action === "patch_node_local" && parsed.node_patch) {
              nodePatch = {
                nodeId: parsed.node_patch.node_id,
                config: parsed.node_patch.config,
              };
              if (parsed.patch_payload) patchPayload = parsed.patch_payload;
              patchPipelineId = parsed.pipeline_id;
            }
            if (parsed.next_action === "patch_canvas_local" && parsed.patch_payload) {
              patchPayload = parsed.patch_payload;
              patchPipelineId = parsed.pipeline_id;
              patchMode = "canvas_local";
              if (parsed.components_added?.length) componentSummary = parsed.components_added;
            }
          }
        } catch {
          // ignore
        }
      }

      return NextResponse.json({
        message: text,
        savePayload,
        patchPayload,
        patchPipelineId,
        patchMode,
        nodePatch,
        requiredFields,
        codePreview,
        componentSummary,
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
          result = await toolGeneratePipeline(user.id, inp as GeneratePipelineParams);
        } else if (name === "add_pipeline_components") {
          result = await toolAddPipelineComponents(user.id, pipelineId, {
            pipeline_id: typeof inp.pipeline_id === "string" ? inp.pipeline_id : undefined,
            components: inp.components,
          }, {
            canvasSnapshot,
            pulseCanvasMode: Boolean(canvasSnapshot?.nodes?.length),
            pulseTargetNodeId: canvasNodeContext?.nodeId,
          });
        } else if (name === "edit_pipeline_canvas") {
          result = await toolEditPipelineCanvas(user.id, pipelineId, {
            pipeline_id: typeof inp.pipeline_id === "string" ? inp.pipeline_id : undefined,
            actions: inp.actions,
          }, {
            canvasSnapshot,
            pulseCanvasMode: Boolean(canvasSnapshot?.nodes?.length),
            pulseTargetNodeId: canvasNodeContext?.nodeId,
          });
        } else if (name === "build_transform_steps") {
          result = toolBuildTransformSteps({
            mode: typeof inp.mode === "string" ? inp.mode : undefined,
            source_table: typeof inp.source_table === "string" ? inp.source_table : undefined,
            steps: inp.steps,
            dbt_package_path: typeof inp.dbt_package_path === "string" ? inp.dbt_package_path : undefined,
            dbt_target_schema: typeof inp.dbt_target_schema === "string" ? inp.dbt_target_schema : undefined,
            user_query: messages[messages.length - 1]?.content ?? "",
          });
        } else if (name === "build_lake_pipeline") {
          result = toolBuildLakePipeline({
            starter_id: typeof inp.starter_id === "string" ? inp.starter_id : undefined,
            source_table: typeof inp.source_table === "string" ? inp.source_table : undefined,
            second_table: typeof inp.second_table === "string" ? inp.second_table : undefined,
            dimension_table: typeof inp.dimension_table === "string" ? inp.dimension_table : undefined,
            layer_prefix: typeof inp.layer_prefix === "string" ? inp.layer_prefix : undefined,
            join_key: typeof inp.join_key === "string" ? inp.join_key : undefined,
            id_column: typeof inp.id_column === "string" ? inp.id_column : undefined,
          });
        } else if (name === "list_pipeline_playbooks") {
          result = toolListPipelinePlaybooks(typeof inp.query === "string" ? inp.query : undefined);
        } else if (name === "list_dbt_projects") {
          result = await toolListDbtProjects(
            user.id,
            typeof inp.source_slug === "string" ? inp.source_slug : undefined
          );
        } else if (name === "search_components") {
          result = toolSearchComponents(
            String(inp.query ?? ""),
            typeof inp.category === "string" ? inp.category : undefined,
            typeof inp.compile_target === "string" ? inp.compile_target : undefined
          );
        } else if (name === "get_component_details") {
          result = await toolGetComponentDetails(
            String(inp.component_id ?? ""),
            inp.include_schema === true
          );
        } else if (name === "list_mcp_server_catalog") {
          result = await toolListMcpServerCatalog();
        } else if (name === "list_mcp_servers") {
          result = await toolListMcpServers(user.id);
        } else if (name === "refresh_mcp_tools") {
          result = await toolRefreshMcpTools(user.id, String(inp.mcp_server_id ?? ""));
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
