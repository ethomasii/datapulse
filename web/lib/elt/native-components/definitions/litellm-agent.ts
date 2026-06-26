import type { NativeComponentDefinition } from "../types";
import { emitLitellmAgentPython, takeMcpPythonPreamble } from "../mcp-python-runtime";

function agentMcpServers(config: Record<string, unknown>): Array<Record<string, unknown>> {
  if (Array.isArray(config._resolved_mcp_servers)) {
    return config._resolved_mcp_servers as Array<Record<string, unknown>>;
  }
  const one = config._resolved_mcp_server;
  if (one && typeof one === "object") return [{ name: "mcp", _resolved: one }];
  return [];
}

function compileAgent(config: Record<string, unknown>, defaultModel: string): ReturnType<NativeComponentDefinition["compile"]> {
  const prompt = String(config.prompt ?? config.user_prompt ?? "").trim();
  if (!prompt) {
    return { warnings: ["agent: prompt is required"], python: [] };
  }
  const model = String(config.model ?? defaultModel).trim();
  const maxIterations = Number(config.max_iterations ?? 10);
  const systemPrompt = String(config.system_prompt ?? "").trim() || undefined;
  const apiKeyEnv = String(config.api_key_env_var ?? config.api_key_env ?? "").trim() || undefined;
  const label = String(config.asset_name ?? config.label ?? "agent").trim();

  return {
    python: [
      ...takeMcpPythonPreamble(),
      ...emitLitellmAgentPython({
        label,
        prompt,
        systemPrompt,
        model,
        apiKeyEnv,
        maxIterations: Number.isFinite(maxIterations) ? maxIterations : 10,
        mcpServers: agentMcpServers(config),
      }),
    ],
  };
}

export const litellmAgentComponent: NativeComponentDefinition = {
  id: "litellm_agent",
  aliases: ["openai_agent", "anthropic_agent", "gemini_agent", "snowflake_cortex_agent"],
  name: "LLM agent (MCP)",
  category: "ai",
  description: "Single-shot LLM agent with optional workspace MCP servers (LiteLLM tool loop).",
  compileTarget: "python",
  fields: [
    { key: "prompt", label: "User prompt", type: "text", required: true },
    { key: "system_prompt", label: "System prompt", type: "text" },
    { key: "model", label: "Model", type: "string", default: "gpt-4o-mini" },
    { key: "api_key_env_var", label: "API key env var", type: "string", placeholder: "OPENAI_API_KEY" },
    { key: "max_iterations", label: "Max tool iterations", type: "number", default: 10 },
    { key: "mcp_server_ids", label: "MCP server ids", type: "string_list" },
    { key: "output_table", label: "Output table", type: "string" },
  ],
  compile: (config) => compileAgent(config, "gpt-4o-mini"),
};
