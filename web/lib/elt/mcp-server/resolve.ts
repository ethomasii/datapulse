import { db } from "@/lib/db/client";
import { mcpSecretEnvKeys, parseStoredMcpSecrets } from "./secrets-store";
import type { McpServerConfig, McpTransport, ResolvedMcpServer } from "./types";

export function inlineServerFromConfig(config: Record<string, unknown>): {
  name: string;
  transport: McpTransport;
  config: McpServerConfig;
} | null {
  const server = config.server;
  if (server && typeof server === "object" && !Array.isArray(server)) {
    const s = server as Record<string, unknown>;
    const name = String(s.name ?? "mcp").trim() || "mcp";
    const transport = String(s.type ?? s.transport ?? "stdio").trim() as McpTransport;
    return {
      name,
      transport: transport === "http" || transport === "sse" ? transport : "stdio",
      config: {
        command: Array.isArray(s.command) ? s.command.map(String) : undefined,
        url: typeof s.url === "string" ? s.url : undefined,
        env: s.env && typeof s.env === "object" ? (s.env as Record<string, string>) : undefined,
        headers: s.headers && typeof s.headers === "object" ? (s.headers as Record<string, string>) : undefined,
        headers_env:
          s.headers_env && typeof s.headers_env === "object"
            ? (s.headers_env as Record<string, string>)
            : undefined,
      },
    };
  }
  return null;
}

export async function resolveMcpServerById(
  ownerIds: string[],
  serverId: string
): Promise<ResolvedMcpServer | null> {
  const row = await db.mcpServer.findFirst({
    where: { id: serverId, userId: { in: ownerIds } },
  });
  if (!row) return null;

  const config = (row.config && typeof row.config === "object" && !Array.isArray(row.config)
    ? row.config
    : {}) as McpServerConfig;
  const transport = row.transport as McpTransport;

  return {
    id: row.id,
    name: row.name,
    transport,
    config,
    secretEnvKeys: mcpSecretEnvKeys(config as Record<string, unknown>),
  };
}

export async function loadMcpServersForCompile(
  ownerIds: string[],
  componentConfigs: Record<string, unknown>[]
): Promise<Map<string, ResolvedMcpServer>> {
  const ids = new Set<string>();
  for (const cfg of componentConfigs) {
    const ref = String(cfg.mcp_server_id ?? "").trim();
    if (ref) ids.add(ref);
    const servers = cfg.mcp_servers;
    if (Array.isArray(servers)) {
      for (const s of servers) {
        if (s && typeof s === "object") {
          const id = String((s as Record<string, unknown>).mcp_server_id ?? "").trim();
          if (id) ids.add(id);
        }
      }
    }
  }
  if (ids.size === 0) return new Map();

  const rows = await db.mcpServer.findMany({
    where: { id: { in: Array.from(ids) }, userId: { in: ownerIds } },
  });

  const map = new Map<string, ResolvedMcpServer>();
  for (const row of rows) {
    const config = (row.config && typeof row.config === "object" && !Array.isArray(row.config)
      ? row.config
      : {}) as McpServerConfig;
    map.set(row.id, {
      id: row.id,
      name: row.name,
      transport: row.transport as McpTransport,
      config,
      secretEnvKeys: mcpSecretEnvKeys(config as Record<string, unknown>),
    });
  }
  return map;
}

export function hydrateComponentMcpConfig(
  cfg: Record<string, unknown>,
  servers: Map<string, ResolvedMcpServer>
): Record<string, unknown> {
  const next = { ...cfg };
  const ref = String(cfg.mcp_server_id ?? "").trim();
  if (ref && servers.has(ref)) {
    next._resolved_mcp_server = servers.get(ref);
  }
  const inline = inlineServerFromConfig(cfg);
  if (inline) next._resolved_mcp_server = { id: "", ...inline, secretEnvKeys: [] };

  if (Array.isArray(cfg.mcp_servers)) {
    next._resolved_mcp_servers = cfg.mcp_servers.map((entry) => {
      if (!entry || typeof entry !== "object") return entry;
      const e = entry as Record<string, unknown>;
      const id = String(e.mcp_server_id ?? "").trim();
      if (id && servers.has(id)) {
        const resolved = servers.get(id)!;
        return { ...e, name: e.name ?? resolved.name, _resolved: resolved };
      }
      return entry;
    });
  }

  const ids = cfg.mcp_server_ids;
  if (Array.isArray(ids)) {
    next._resolved_mcp_servers = ids
      .map((id) => String(id).trim())
      .filter(Boolean)
      .map((id) => {
        const resolved = servers.get(id);
        if (!resolved) return null;
        return { mcp_server_id: id, name: resolved.name, _resolved: resolved };
      })
      .filter(Boolean);
  }

  return next;
}

/** Runtime secrets for discovery (control plane only — never sent to client). */
export async function mcpSecretsForServer(row: {
  config: unknown;
  secretsEnc: string | null;
}): Promise<Record<string, string>> {
  return parseStoredMcpSecrets(row.secretsEnc);
}
