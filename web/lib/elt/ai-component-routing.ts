/**
 * Natural-language → native AI component routing for search_components and Pulse AI prompts.
 */

export type AiComponentIntent = {
  componentId: string;
  reason: string;
  configHints?: Record<string, unknown>;
};

const INTENT_RULES: Array<{
  componentId: string;
  patterns: RegExp[];
  reason: string;
  configHints?: Record<string, unknown>;
}> = [
  {
    componentId: "litellm_structured_output",
    patterns: [
      /\bstructured\s+output\b/i,
      /\bextract\s+(fields?|entities|json|schema)\b/i,
      /\bpydantic\b/i,
      /\bjson\s+schema\b/i,
      /\bparse\s+(fields?|entities)\s+from\b/i,
      /\bextract\s+.+\s+from\s+(text|email|column)\b/i,
    ],
    reason: "Per-row structured JSON extraction — use schema_definition + text_column.",
    configHints: {
      schema_definition: '{"name":{"type":"string"},"company":{"type":"string"}}',
      on_error: "null",
    },
  },
  {
    componentId: "litellm_function_calling",
    patterns: [
      /\bfunction\s+call(ing)?\b/i,
      /\btool\s+call(ing)?\s+per\s+row\b/i,
      /\broute\s+to\s+(a\s+)?tool\b/i,
      /\bopenai\s+tools?\b/i,
    ],
    reason: "Single-shot LiteLLM tool call per row — writes tool_calls JSON column (no execution loop).",
  },
  {
    componentId: "rag_pipeline",
    patterns: [
      /\brag\b/i,
      /\bretrieval[\s-]augmented\b/i,
      /\bvector\s+(search|store|db)\b/i,
      /\bembed\s+.+\s+(corpus|documents?)\b/i,
      /\bretrieve\s+and\s+generat/i,
    ],
    reason: "Embed query, retrieve from vector store, generate answer per row.",
    configHints: { vector_store_provider: "chromadb", query_column: "query" },
  },
  {
    componentId: "litellm_inference_asset",
    patterns: [
      /\benrich\s+(each\s+)?row\b/i,
      /\bllm\s+(column|per\s+row)\b/i,
      /\bsummarize\s+(each\s+)?row\b/i,
      /\bchat\s+completion\s+per\s+row\b/i,
      /\badd\s+(an?\s+)?llm\s+column\b/i,
      /\bgenerate\s+text\s+per\s+row\b/i,
    ],
    reason: "Per-row chat completion — prompt_column → output_column.",
    configHints: { output_column: "llm_output" },
  },
  {
    componentId: "litellm_agent",
    patterns: [
      /\bagent\s+per\s+row\b/i,
      /\brun\s+(an?\s+)?agent\s+(on|for)\s+(each\s+)?row\b/i,
      /\bmcp\s+agent\s+(on|for)\s+(table|rows?)\b/i,
      /\bfor\s+each\s+row.+\bmcp\b/i,
    ],
    reason: "Per-row MCP agent loop — set table, prompt_column, output_table, mcp_server_ids.",
    configHints: { output_column: "agent_output" },
  },
  {
    componentId: "litellm_agent",
    patterns: [
      /\blitellm\s+agent\b/i,
      /\bllm\s+agent\b/i,
      /\bmcp\s+agent\b/i,
      /\btool\s+loop\b/i,
      /\bagent\s+with\s+mcp\b/i,
    ],
    reason: "Single-shot agent with optional MCP tools — use prompt (+ mcp_server_ids).",
  },
  {
    componentId: "mcp_tool_call",
    patterns: [
      /\bmcp\s+tool\s+call\b/i,
      /\bdeterministic\s+mcp\b/i,
      /\bcall\s+mcp\s+tool\b/i,
      /\bstripe\s+refund\b/i,
      /\brefund\s+(via|with|using)\s+stripe\b/i,
    ],
    reason: "Deterministic single MCP tool call (no LLM) — or pick a virtual MCP tool from the palette.",
  },
  {
    componentId: "llm_evaluator",
    patterns: [
      /\bllm[\s-]as[\s-]judge\b/i,
      /\bevaluate\s+(llm|agent)\s+output\b/i,
      /\banswer\s+relevance\b/i,
      /\bgroundedness\b/i,
    ],
    reason: "Score upstream LLM/agent output with an LLM judge.",
  },
];

/** Best native AI component for a natural-language query (first strong match). */
export function matchAiComponentIntent(query: string): AiComponentIntent | null {
  const q = query.trim();
  if (!q) return null;
  for (const rule of INTENT_RULES) {
    if (rule.patterns.some((p) => p.test(q))) {
      return {
        componentId: rule.componentId,
        reason: rule.reason,
        configHints: rule.configHints,
      };
    }
  }
  return null;
}

/** Markdown block injected into Pulse AI system prompts. */
export const AI_COMPONENT_ROUTING_PROMPT = `### AI / MCP component picker (prefer native ids — search_components confirms)
| User intent | component_id | Key config |
|-------------|--------------|------------|
| Fill/enrich a column with LLM text per row | **litellm_inference_asset** | table, prompt_column, output_column, output_table |
| Extract typed JSON fields from text per row | **litellm_structured_output** | table, text_column, schema_definition (JSON), output_table |
| Model picks a tool (JSON) per row, no loop | **litellm_function_calling** | table, text_column, tools (JSON array), output_table |
| RAG: vector retrieve + generate per row | **rag_pipeline** | table, query_column, collection_name, llm_model, output_table |
| MCP agent loop **per table row** | **litellm_agent** | table, prompt_column, output_table, output_column, mcp_server_ids |
| Single MCP agent (one prompt) | **litellm_agent** | prompt, mcp_server_ids (optional) |
| Deterministic MCP tool (Stripe refund, etc.) | **mcp_tool_call** or workspace virtual tool id | mcp_server_id, tool_name, tool_args |
| Judge / score LLM output | **llm_evaluator** | table, input_column, feedback, output_table |

Do **not** use sql_transform for AI steps. Call **list_mcp_servers** before mcp_tool_call / litellm_agent when workspace servers exist.`;
