/**
 * MCP tool discovery for workspace registry (http/sse from control plane).
 * stdio servers must be discovered from the gateway/worker where the subprocess can run.
 */
import type { McpServerConfig, McpToolDescriptor, McpTransport } from "./types";

type DiscoverInput = {
  name: string;
  transport: McpTransport;
  config: McpServerConfig;
  secrets?: Record<string, string>;
};

function resolveHeaders(config: McpServerConfig, secrets: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(config.headers ?? {}) };
  for (const [header, envVar] of Object.entries(config.headers_env ?? {})) {
    const val = secrets[envVar] ?? process.env[envVar];
    if (val === undefined) {
      throw new Error(`MCP server ${config}: env var ${envVar} is not set (needed for header ${header})`);
    }
    headers[header] = val;
  }
  return headers;
}

async function jsonRpc(
  url: string,
  method: string,
  params: Record<string, unknown>,
  headers: Record<string, string>
): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...headers,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`MCP HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("text/event-stream")) {
    const text = await res.text();
    const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
    if (!dataLine) throw new Error("MCP SSE response missing data line");
    return JSON.parse(dataLine.slice(5).trim());
  }
  return res.json();
}

export async function discoverMcpTools(input: DiscoverInput): Promise<McpToolDescriptor[]> {
  const { transport, config } = input;
  const secrets = input.secrets ?? {};

  if (transport === "stdio") {
    throw new Error(
      "stdio MCP servers cannot be discovered from the cloud control plane. " +
        "Run discovery from your gateway/worker, or use http/sse transport."
    );
  }

  const url = config.url?.trim();
  if (!url) throw new Error("MCP http/sse server requires config.url");

  const headers = resolveHeaders(config, secrets);

  const init = (await jsonRpc(
    url,
    "initialize",
    {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "eltpulse", version: "1.0.0" },
    },
    headers
  )) as { error?: { message?: string } };
  if (init && typeof init === "object" && "error" in init && init.error) {
    throw new Error(String(init.error.message ?? "MCP initialize failed"));
  }

  await jsonRpc(url, "notifications/initialized", {}, headers).catch(() => undefined);

  const listed = (await jsonRpc(url, "tools/list", {}, headers)) as {
    result?: { tools?: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }> };
    error?: { message?: string };
  };

  if (listed.error) throw new Error(String(listed.error.message ?? "tools/list failed"));
  const tools = listed.result?.tools ?? [];
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
}
