import type { McpServerConfig, McpToolDescriptor, McpTransport } from "./types";

type DbRow = {
  id: string;
  name: string;
  description: string | null;
  transport: string;
  config: unknown;
  secretsEnc?: string | null;
  toolsCache?: unknown;
  toolsCachedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toPublicMcpServer(row: DbRow) {
  const config = (row.config && typeof row.config === "object" && !Array.isArray(row.config)
    ? row.config
    : {}) as McpServerConfig;
  const toolsRaw = row.toolsCache;
  const toolsCache = Array.isArray(toolsRaw)
    ? (toolsRaw as McpToolDescriptor[])
    : null;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    transport: row.transport as McpTransport,
    config,
    hasStoredSecrets: Boolean(row.secretsEnc),
    toolsCache,
    toolsCachedAt: row.toolsCachedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
