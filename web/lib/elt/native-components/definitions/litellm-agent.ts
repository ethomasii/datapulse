import type { NativeComponentDefinition } from "../types";
import {
  emitLitellmAgentPerRowPython,
  emitLitellmAgentPython,
  takeMcpPythonPreamble,
} from "../mcp-python-runtime";

function agentMcpServers(config: Record<string, unknown>): Array<Record<string, unknown>> {
  if (Array.isArray(config._resolved_mcp_servers)) {
    return config._resolved_mcp_servers as Array<Record<string, unknown>>;
  }
  const one = config._resolved_mcp_server;
  if (one && typeof one === "object") return [{ name: "mcp", _resolved: one }];
  return [];
}

function compileAgent(config: Record<string, unknown>, defaultModel: string): ReturnType<NativeComponentDefinition["compile"]> {
  const table = String(config.table ?? config.upstream_asset_key ?? "").trim();
  const outputTable = String(config.output_table ?? config.asset_name ?? "").trim();
  const promptColumn = String(config.prompt_column ?? config.text_column ?? "").trim();
  const outputColumn = String(config.output_column ?? "agent_output").trim();
  const prompt = String(config.prompt ?? config.user_prompt ?? "").trim();
  const promptPrefix = String(config.prompt_prefix ?? "").trim() || undefined;
  const model = String(config.model ?? defaultModel).trim();
  const maxIterations = Number(config.max_iterations ?? 10);
  const systemPrompt = String(config.system_prompt ?? "").trim() || undefined;
  const apiKeyEnv = String(config.api_key_env_var ?? config.api_key_env ?? "").trim() || undefined;
  const label = String(config.asset_name ?? config.label ?? (table || "agent")).trim();
  const mcpServers = agentMcpServers(config);
  const preamble = takeMcpPythonPreamble();

  if (table && outputTable) {
    if (!promptColumn) {
      return {
        warnings: ["litellm_agent: prompt_column is required when table + output_table are set (per-row mode)"],
        python: [],
      };
    }
    return {
      python: [
        ...preamble,
        ...emitLitellmAgentPerRowPython({
          label,
          table,
          promptColumn,
          outputColumn,
          promptPrefix,
          systemPrompt,
          model,
          apiKeyEnv,
          maxIterations: Number.isFinite(maxIterations) ? maxIterations : 10,
          mcpServers,
          outputTable,
        }),
      ],
    };
  }

  if (!prompt) {
    return {
      warnings: [
        "litellm_agent: prompt is required for single-shot mode, or set table + prompt_column + output_table for per-row mode",
      ],
      python: [],
    };
  }

  return {
    python: [
      ...preamble,
      ...emitLitellmAgentPython({
        label,
        prompt,
        systemPrompt,
        model,
        apiKeyEnv,
        maxIterations: Number.isFinite(maxIterations) ? maxIterations : 10,
        mcpServers,
      }),
    ],
  };
}

export const litellmAgentComponent: NativeComponentDefinition = {
  id: "litellm_agent",
  aliases: ["openai_agent", "anthropic_agent", "gemini_agent", "snowflake_cortex_agent"],
  name: "LLM agent (MCP)",
  category: "ai",
  description:
    "LiteLLM agent with optional MCP tools — single prompt or per-row over a table (prompt_column → output_column).",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Input table", type: "string", description: "Set with output_table for per-row agent mode" },
    { key: "prompt_column", label: "Prompt column", type: "string", description: "Per-row user message source column" },
    { key: "prompt_prefix", label: "Prompt prefix", type: "text", description: "Prepended to each row prompt in per-row mode" },
    { key: "prompt", label: "User prompt", type: "text", description: "Single-shot mode — omit when using table + prompt_column" },
    { key: "system_prompt", label: "System prompt", type: "text" },
    { key: "model", label: "Model", type: "string", default: "gpt-4o-mini" },
    { key: "api_key_env_var", label: "API key env var", type: "string", placeholder: "OPENAI_API_KEY" },
    { key: "max_iterations", label: "Max tool iterations", type: "number", default: 10 },
    { key: "mcp_server_ids", label: "MCP server ids", type: "string_list" },
    { key: "output_column", label: "Output column", type: "string", default: "agent_output" },
    { key: "output_table", label: "Output table", type: "string", description: "Required for per-row mode" },
  ],
  compile: (config) => compileAgent(config, "gpt-4o-mini"),
};
