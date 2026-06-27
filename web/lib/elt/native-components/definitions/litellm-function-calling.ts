import type { NativeComponentDefinition } from "../types";
import { emitLitellmFunctionCallingPython } from "../mcp-python-runtime";

function parseTools(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

export const litellmFunctionCallingComponent: NativeComponentDefinition = {
  id: "litellm_function_calling",
  name: "LLM function calling",
  category: "ai",
  description:
    "Per-row LiteLLM tool/function calling — writes tool call JSON to an output column (no execution loop).",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Input table", type: "string", required: true },
    { key: "text_column", label: "Text column", type: "string", required: true },
    {
      key: "tools",
      label: "Tools (JSON array)",
      type: "text",
      required: true,
      placeholder: '[{"type":"function","function":{"name":"search","parameters":{...}}}]',
    },
    { key: "model", label: "Model", type: "string", default: "gpt-4o-mini" },
    { key: "output_column", label: "Output column", type: "string", default: "tool_calls" },
    { key: "system_prompt", label: "System prompt", type: "text" },
    { key: "api_key_env_var", label: "API key env var", type: "string", placeholder: "OPENAI_API_KEY" },
    { key: "output_table", label: "Output table", type: "string", required: true },
  ],
  compile(config) {
    const table = String(config.table ?? config.upstream_asset_key ?? "").trim();
    const outputTable = String(config.output_table ?? config.asset_name ?? "").trim();
    const textColumn = String(config.text_column ?? "text").trim();
    const tools = parseTools(config.tools);
    const model = String(config.model ?? "gpt-4o-mini").trim();
    const outputColumn = String(config.output_column ?? "tool_calls").trim();
    const systemPrompt = String(config.system_prompt ?? "").trim() || undefined;
    const apiKeyEnv = String(config.api_key_env_var ?? config.api_key_env ?? "").trim() || undefined;

    if (!table || !outputTable) {
      return { warnings: ["litellm_function_calling: table and output_table required"], python: [] };
    }
    if (!textColumn) {
      return { warnings: ["litellm_function_calling: text_column is required"], python: [] };
    }
    if (!tools?.length) {
      return { warnings: ["litellm_function_calling: tools must be a non-empty JSON array"], python: [] };
    }

    return {
      python: emitLitellmFunctionCallingPython({
        label: table,
        table,
        textColumn,
        tools,
        model,
        outputColumn,
        systemPrompt,
        apiKeyEnv,
        outputTable,
      }),
    };
  },
};
