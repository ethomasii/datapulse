const DEFAULT_BASE_URL = "https://eltpulse.dev";

export class EltPulseApiError extends Error {
  readonly status: number;
  readonly hint?: string;

  constructor(status: number, message: string, extras?: { hint?: string }) {
    super(message);
    this.name = "EltPulseApiError";
    this.status = status;
    this.hint = extras?.hint;
  }

  toDisplayString(): string {
    const parts = [this.message];
    if (this.hint) parts.push(`Hint: ${this.hint}`);
    return parts.join("\n");
  }
}

function parseApiErrorBody(status: number, text: string): EltPulseApiError {
  try {
    const body = JSON.parse(text) as { error?: string; hint?: string; message?: string };
    const message = body.error ?? body.message ?? `eltPulse API ${status}`;
    return new EltPulseApiError(status, message, { hint: body.hint });
  } catch {
    return new EltPulseApiError(status, `eltPulse API ${status}: ${text.slice(0, 800)}`);
  }
}

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}

export function createClient(apiToken: string, baseUrl?: string): EltPulseClient {
  const resolvedBase =
    baseUrl?.replace(/\/$/, "") ??
    process.env.ELTPULSE_API_BASE_URL?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    DEFAULT_BASE_URL;
  return new EltPulseClient(apiToken, resolvedBase);
}

export function createClientFromEnv(): EltPulseClient {
  const token =
    process.env.ELTPULSE_API_TOKEN?.trim() ??
    process.env.ELTPULSE_API_KEY?.trim() ??
    "";
  return createClient(token);
}

export class EltPulseClient {
  readonly baseUrl: string;
  private readonly headers: Headers;

  constructor(
    apiToken: string,
    baseUrl: string = DEFAULT_BASE_URL,
    private readonly timeoutMs: number = 30_000
  ) {
    const token = (apiToken ?? "").trim();
    if (!token) throw new Error("ELTPULSE_API_TOKEN is required");
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.headers = new Headers({
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    });
  }

  async getJson<T = unknown>(
    path: string,
    query?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== "") {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, { headers: this.headers, signal: ctrl.signal });
      const text = await res.text();
      if (!res.ok) throw parseApiErrorBody(res.status, text);
      return JSON.parse(text) as T;
    } catch (err) {
      if (err instanceof EltPulseApiError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new EltPulseApiError(408, `Request timed out after ${this.timeoutMs}ms`);
      }
      throw new EltPulseApiError(
        0,
        `Request failed: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async postJson<T = unknown>(path: string, body: unknown, timeoutMs = this.timeoutMs): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          ...Object.fromEntries(this.headers.entries()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      const text = await res.text();
      if (!res.ok) throw parseApiErrorBody(res.status, text);
      return JSON.parse(text) as T;
    } catch (err) {
      if (err instanceof EltPulseApiError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new EltPulseApiError(408, `Request timed out after ${timeoutMs}ms`);
      }
      throw new EltPulseApiError(
        0,
        `Request failed: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      clearTimeout(timer);
    }
  }

  discovery(baseUrl = this.baseUrl) {
    return {
      name: "eltPulse Workspace API",
      version: "1",
      baseUrl,
      authentication: {
        type: "Bearer",
        header: "Authorization: Bearer elt_...",
        note: "Workspace API key from Account → Developers.",
      },
      endpoints: [
        { method: "GET", path: "/api/elt/pipelines", scope: "pipelines:read" },
        { method: "GET", path: "/api/elt/pipelines/{id}", scope: "pipelines:read" },
        { method: "GET", path: "/api/elt/runs", scope: "runs:read" },
        { method: "POST", path: "/api/elt/runs", scope: "runs:write" },
        { method: "GET", path: "/api/elt/connections", scope: "connections:read" },
        { method: "GET", path: "/api/elt/mcp-servers", scope: "connections:read" },
      ],
      mcp: {
        hosted: `${baseUrl.replace(/^https?:\/\/app\./, "https://mcp.")}`,
        note: "Production MCP is typically served at mcp.eltpulse.dev (same deployment).",
      },
      documentationUrl: `${baseUrl}/docs`,
    };
  }

  listPipelines() {
    return this.getJson("/api/elt/pipelines");
  }

  getPipeline(pipelineId: string) {
    return this.getJson(`/api/elt/pipelines/${encodeURIComponent(pipelineId)}`);
  }

  listRuns(options?: { pipelineId?: string; status?: string; limit?: number }) {
    return this.getJson("/api/elt/runs", {
      pipelineId: options?.pipelineId,
      status: options?.status,
      limit: options?.limit,
    });
  }

  triggerRun(body: { pipelineId: string; environment?: string; triggeredBy?: string }) {
    return this.postJson("/api/elt/runs", {
      pipelineId: body.pipelineId,
      environment: body.environment ?? "default",
      status: "pending",
      triggeredBy: body.triggeredBy ?? "mcp",
    });
  }

  listConnections() {
    return this.getJson("/api/elt/connections");
  }

  listMcpServers() {
    return this.getJson("/api/elt/mcp-servers");
  }

  workspaceDefaults() {
    return this.getJson("/api/elt/workspace-defaults");
  }
}
