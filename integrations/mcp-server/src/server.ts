import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type EltPulseClient } from "./client.js";
import { errorResult, jsonResult } from "./results.js";

const SERVER_INSTRUCTIONS = `eltPulse MCP exposes your workspace via the REST API (/api/elt/*).

Use eltpulse_api_discovery for endpoint and scope reference.
Start with eltpulse_list_pipelines and eltpulse_list_runs for operational context.
Use eltpulse_trigger_run to enqueue a pipeline run (requires runs:write on the API key).
Workspace API keys are minted at Account → Developers (elt_… prefix).`;

export function createEltPulseMcpServer(client: EltPulseClient): McpServer {
  const server = new McpServer(
    { name: "eltpulse", version: "0.1.0" },
    { instructions: SERVER_INSTRUCTIONS }
  );

  server.tool(
    "eltpulse_api_discovery",
    "List available eltPulse REST endpoints, scopes, and MCP documentation links.",
    {},
    async () => {
      try {
        return jsonResult(client.discovery());
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "eltpulse_list_pipelines",
    "List pipelines in the current workspace.",
    {},
    async () => {
      try {
        return jsonResult(await client.listPipelines());
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "eltpulse_get_pipeline",
    "Fetch one pipeline by id.",
    {
      pipeline_id: z.string().describe("Pipeline id from eltpulse_list_pipelines"),
    },
    async ({ pipeline_id }) => {
      try {
        return jsonResult(await client.getPipeline(pipeline_id));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "eltpulse_list_runs",
    "List pipeline runs (newest first).",
    {
      pipeline_id: z.string().optional().describe("Filter by pipeline id"),
      status: z
        .string()
        .optional()
        .describe("Comma-separated statuses: pending,running,succeeded,failed,cancelled"),
      limit: z.number().int().min(1).max(200).optional().describe("Max rows (default 50)"),
    },
    async ({ pipeline_id, status, limit }) => {
      try {
        return jsonResult(
          await client.listRuns({
            pipelineId: pipeline_id,
            status,
            limit,
          })
        );
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "eltpulse_trigger_run",
    "Enqueue a pipeline run (managed execution when configured).",
    {
      pipeline_id: z.string().describe("Pipeline id to run"),
      environment: z.string().optional().describe("Run environment label (default: default)"),
    },
    async ({ pipeline_id, environment }) => {
      try {
        return jsonResult(
          await client.triggerRun({
            pipelineId: pipeline_id,
            environment,
            triggeredBy: "mcp",
          })
        );
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "eltpulse_list_connections",
    "List saved source and destination connections (no secrets).",
    {},
    async () => {
      try {
        return jsonResult(await client.listConnections());
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "eltpulse_workspace_defaults",
    "Get workspace default destination and related defaults.",
    {},
    async () => {
      try {
        return jsonResult(await client.workspaceDefaults());
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "eltpulse_list_mcp_servers",
    "List MCP servers registered in this workspace (for pipeline AI components).",
    {},
    async () => {
      try {
        return jsonResult(await client.listMcpServers());
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  return server;
}
