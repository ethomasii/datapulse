import type { NativeComponentDefinition } from "../types";
import { emitLitellmStructuredOutputPython } from "../mcp-python-runtime";

function parseSchemaDefinition(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export const litellmStructuredOutputComponent: NativeComponentDefinition = {
  id: "litellm_structured_output",
  name: "LLM structured extraction",
  category: "ai",
  description:
    "Per-row structured JSON extraction via LiteLLM — expands schema fields into new columns.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Input table", type: "string", required: true },
    { key: "text_column", label: "Text column", type: "string", required: true },
    {
      key: "schema_definition",
      label: "Schema definition (JSON)",
      type: "text",
      required: true,
      placeholder: '{"name":{"type":"string"},"company":{"type":"string"}}',
    },
    { key: "model", label: "Model", type: "string", default: "gpt-4o-mini" },
    { key: "prompt_prefix", label: "Prompt prefix", type: "text" },
    { key: "output_prefix", label: "Output column prefix", type: "string", default: "extracted_" },
    {
      key: "on_error",
      label: "On error",
      type: "select",
      options: ["null", "skip", "raise"],
      default: "null",
    },
    { key: "api_key_env_var", label: "API key env var", type: "string", placeholder: "OPENAI_API_KEY" },
    { key: "output_table", label: "Output table", type: "string", required: true },
  ],
  compile(config) {
    const table = String(config.table ?? config.upstream_asset_key ?? "").trim();
    const outputTable = String(config.output_table ?? config.asset_name ?? "").trim();
    const textColumn = String(config.text_column ?? "text").trim();
    const schemaDefinition = parseSchemaDefinition(config.schema_definition);
    const model = String(config.model ?? "gpt-4o-mini").trim();
    const outputPrefix = String(config.output_prefix ?? "extracted_").trim();
    const onError = String(config.on_error ?? "null").trim() || "null";
    const apiKeyEnv = String(config.api_key_env_var ?? config.api_key_env ?? "").trim() || undefined;
    const promptPrefix = String(config.prompt_prefix ?? "").trim() || undefined;

    if (!table || !outputTable) {
      return { warnings: ["litellm_structured_output: table and output_table required"], python: [] };
    }
    if (!textColumn) {
      return { warnings: ["litellm_structured_output: text_column is required"], python: [] };
    }
    if (!schemaDefinition || !Object.keys(schemaDefinition).length) {
      return { warnings: ["litellm_structured_output: schema_definition must be valid JSON object"], python: [] };
    }

    return {
      python: emitLitellmStructuredOutputPython({
        label: table,
        table,
        textColumn,
        schemaDefinition,
        model,
        promptPrefix,
        outputPrefix,
        onError,
        apiKeyEnv,
        outputTable,
      }),
    };
  },
};
