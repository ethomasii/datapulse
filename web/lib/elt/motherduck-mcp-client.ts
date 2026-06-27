/**
 * MotherDuck MCP HTTP client — works on Vercel/serverless (no native duckdb addon).
 * @see https://motherduck.com/docs/sql-reference/mcp/
 */

import { readFetchJsonBody } from "@/lib/elt/fetch-json-body";
import type { WarehouseQueryRowset } from "@/lib/elt/warehouse-introspect-connectors";

const MCP_URL = "https://api.motherduck.com/mcp";
const MCP_PROTOCOL = "2024-11-05";
const FETCH_TIMEOUT_MS = 20_000;

type McpStructuredContent = {
  success?: boolean;
  columns?: string[];
  columnTypes?: string[];
  rows?: unknown[][];
  rowCount?: number;
  error?: string;
  message?: string;
};

type McpToolResponse = {
  jsonrpc?: string;
  id?: number;
  result?: {
    isError?: boolean;
    content?: { type?: string; text?: string }[];
    structuredContent?: McpStructuredContent;
  };
  error?: { code?: number; message?: string };
};

export function mcpRowsetFromStructured(content: McpStructuredContent): WarehouseQueryRowset {
  const columns = content.columns ?? [];
  const rows = Array.isArray(content.rows) ? content.rows : [];
  return { columns, rows };
}

export function parseMotherduckMcpResponse(body: McpToolResponse): WarehouseQueryRowset {
  if (body.error?.message) {
    throw new Error(body.error.message);
  }
  const result = body.result;
  if (!result) {
    throw new Error("MotherDuck MCP returned an empty response.");
  }
  if (result.isError) {
    const text = result.content?.map((c) => c.text).filter(Boolean).join("\n");
    throw new Error(text ?? "MotherDuck MCP query failed.");
  }
  const structured = result.structuredContent;
  if (!structured) {
    throw new Error("MotherDuck MCP response missing structuredContent.");
  }
  if (structured.success === false) {
    throw new Error(structured.error ?? structured.message ?? "MotherDuck MCP query failed.");
  }
  return mcpRowsetFromStructured(structured);
}

/** Run read-only SQL against a MotherDuck database via MCP `query` tool. */
export async function runMotherduckMcpQuery(
  token: string,
  database: string,
  sql: string
): Promise<WarehouseQueryRowset> {
  const db = database.trim();
  if (!db) throw new Error("MotherDuck database name is required for MCP queries.");
  if (!token.trim()) throw new Error("Set MOTHERDUCK_TOKEN to query MotherDuck.");

  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "query",
      arguments: { database: db, sql },
    },
  };

  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": MCP_PROTOCOL,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  const body = await readFetchJsonBody<McpToolResponse>(res);
  if (!res.ok) {
    const detail =
      body.error?.message ??
      (typeof body === "object" && body && "message" in body ? String((body as { message?: string }).message) : undefined);
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        detail ??
          "MotherDuck rejected the token — create a Read/Write token at app.motherduck.com → Settings → API Tokens."
      );
    }
    throw new Error(detail ?? `MotherDuck MCP API returned ${res.status}.`);
  }

  return parseMotherduckMcpResponse(body);
}
