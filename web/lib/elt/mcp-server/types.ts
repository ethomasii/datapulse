export type McpTransport = "stdio" | "http" | "sse";

export type McpServerConfig = {
  command?: string[];
  url?: string;
  /** Literal env vars for stdio subprocess (non-secret). */
  env?: Record<string, string>;
  /** Literal HTTP headers (non-secret). */
  headers?: Record<string, string>;
  /** Map header name → env var name; value loaded from secrets at runtime. */
  headers_env?: Record<string, string>;
};

export type McpToolDescriptor = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

export type ResolvedMcpServer = {
  id: string;
  name: string;
  transport: McpTransport;
  config: McpServerConfig;
  /** Env var values for headers_env / runtime (codegen uses os.environ, never embeds secrets). */
  secretEnvKeys: string[];
};

export type McpServerPublic = {
  id: string;
  name: string;
  description: string | null;
  transport: McpTransport;
  config: McpServerConfig;
  hasStoredSecrets: boolean;
  toolsCache: McpToolDescriptor[] | null;
  toolsCachedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
