import type { NativeComponentDefinition } from "../types";
import { emitMcpToolCallPython, takeMcpPythonPreamble } from "../mcp-python-runtime";
import type { ResolvedMcpServer } from "@/lib/elt/mcp-server/types";

function resolvedServer(config: Record<string, unknown>): ResolvedMcpServer | null {
  const r = config._resolved_mcp_server;
  if (r && typeof r === "object") return r as ResolvedMcpServer;
  return null;
}

export const mcpToolCallComponent: NativeComponentDefinition = {
  id: "mcp_tool_call",
  name: "MCP tool call",
  category: "ai",
  description: "Deterministic single-shot MCP tool call — ingest tool result as a table (no LLM).",
  compileTarget: "python",
  fields: [
    { key: "mcp_server_id", label: "MCP server", type: "string", description: "Workspace MCP server id" },
    { key: "tool_name", label: "Tool name", type: "string", required: true },
    { key: "tool_args", label: "Tool args (JSON)", type: "text" },
    { key: "parse_as", label: "Parse as", type: "select", options: ["auto", "json", "text"], default: "auto" },
    { key: "output_table", label: "Output table", type: "string", required: true },
    { key: "asset_name", label: "Asset name", type: "string" },
  ],
  compile(config) {
    const server = resolvedServer(config);
    if (!server) {
      return { warnings: ["mcp_tool_call: mcp_server_id or inline server required"], python: [] };
    }
    const toolName = String(config.tool_name ?? "").trim();
    if (!toolName) {
      return { warnings: ["mcp_tool_call: tool_name is required"], python: [] };
    }
    let toolArgs: Record<string, unknown> = {};
    const rawArgs = config.tool_args;
    if (typeof rawArgs === "string" && rawArgs.trim()) {
      try {
        toolArgs = JSON.parse(rawArgs) as Record<string, unknown>;
      } catch {
        return { warnings: ["mcp_tool_call: tool_args must be valid JSON"], python: [] };
      }
    } else if (rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)) {
      toolArgs = rawArgs as Record<string, unknown>;
    }

    const outputTable = String(config.output_table ?? config.asset_name ?? "staging.mcp_result").trim();
    const parseAs = String(config.parse_as ?? "auto").trim() || "auto";

    return {
      python: [
        ...takeMcpPythonPreamble(),
        ...emitMcpToolCallPython({
          label: toolName,
          server,
          toolName,
          toolArgs,
          parseAs,
          outputTable,
        }),
      ],
      configPatch: {
        elt_mcp_ingestion: true,
        resource_name: outputTable.split(".").pop() ?? outputTable,
      },
    };
  },
};
