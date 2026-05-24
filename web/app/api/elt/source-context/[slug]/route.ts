import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { ALL_DLT_SOURCES } from "@/lib/elt/dlt-hub-registry";
import { getConnectorSourceCredentials } from "@/lib/elt/connectors-registry";

export type DltContextEndpoint = {
  name: string;
  path: string;
  method: string;
  dataSelector: string | null;
};

export type DltSourceContext = {
  slug: string;
  name: string;
  baseUrl: string;
  authType: "bearer" | "api_key" | "basic" | "none";
  /** The secret param name used in RESTAPIConfig (e.g. "token", "api_key") */
  authParam: string;
  /** Human hint for the secret env var (e.g. "STRIPE_SECRET_KEY") */
  authEnvHint: string;
  endpoints: DltContextEndpoint[];
  /** Ready-to-use RESTAPIConfig JSON (client + resources) */
  restApiConfig: Record<string, unknown>;
  contextUrl: string;
};

// ── HTML parser helpers ────────────────────────────────────────────────────────

function extractBetween(html: string, start: string, end: string): string {
  const si = html.indexOf(start);
  if (si === -1) return "";
  const ei = html.indexOf(end, si + start.length);
  if (ei === -1) return html.slice(si + start.length);
  return html.slice(si + start.length, ei);
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
}

/** Parse endpoint rows from an HTML table. Handles both <thead>/<tbody> and flat <tr> tables. */
function parseEndpointTable(html: string): DltContextEndpoint[] {
  const endpoints: DltContextEndpoint[] = [];

  // Find all <tr> blocks
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;
  let firstRow = true;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const row = trMatch[1];
    // Extract cell content (th or td)
    const cells: string[] = [];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      cells.push(stripTags(cellMatch[1]));
    }
    if (cells.length < 2) continue;

    // Skip header row
    if (firstRow || cells[0].toLowerCase() === "resource" || cells[0].toLowerCase() === "name") {
      firstRow = false;
      continue;
    }

    const name = cells[0]?.trim();
    const rawPath = cells[1]?.trim();
    const method = cells[2]?.trim().toUpperCase() || "GET";
    const dataSelector = cells[3]?.trim() || null;

    if (!name || !rawPath || rawPath.startsWith("http") && rawPath.includes("api.") === false) continue;
    // Strip leading slash for consistency
    const path = rawPath.startsWith("/") ? rawPath.slice(1) : rawPath;

    endpoints.push({
      name,
      path,
      method: ["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method) ? method : "GET",
      dataSelector: dataSelector === "N/A" || dataSelector === "" ? null : dataSelector,
    });
  }

  return endpoints;
}

/** Extract Python code blocks from HTML */
function extractCodeBlocks(html: string): string[] {
  const blocks: string[] = [];
  const re = /<code[^>]*>([\s\S]*?)<\/code>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const code = stripTags(m[1]).trim();
    if (code.length > 40) blocks.push(code);
  }
  // Also look for <pre> blocks
  const pre = /<pre[^>]*>([\s\S]*?)<\/pre>/gi;
  while ((m = pre.exec(html)) !== null) {
    const code = stripTags(m[1]).trim();
    if (code.length > 40) blocks.push(code);
  }
  return blocks;
}

/** Infer base URL from code blocks or page content */
function inferBaseUrl(html: string, codeBlocks: string[]): string {
  // Look for base_url in code
  for (const block of codeBlocks) {
    const m = block.match(/["']base_url["']\s*:\s*["']([^"']+)["']/);
    if (m) return m[1];
  }
  // Fallback: look for https://api. pattern in html text
  const m = html.match(/["'](https:\/\/[a-z0-9.-]+\/[^"'\s<>]{0,60})["']/i);
  if (m) return m[1];
  return "";
}

/** Infer auth type from code blocks */
function inferAuth(html: string, codeBlocks: string[]): { authType: DltSourceContext["authType"]; authParam: string; authEnvHint: string } {
  const allCode = codeBlocks.join("\n") + html;

  // Bearer / token
  if (/["']type["']\s*:\s*["']bearer["']/i.test(allCode)) {
    const paramM = allCode.match(/["'](?:token|api_key|access_token)["']\s*:/i);
    const param = paramM ? paramM[0].replace(/["':]/g, "").trim() : "token";
    // Sniff env var hint from surrounding text
    const envM = html.match(/([A-Z][A-Z0-9_]{3,30}_(?:TOKEN|KEY|SECRET|API_KEY))/);
    return { authType: "bearer", authParam: param, authEnvHint: envM?.[1] ?? "API_TOKEN" };
  }
  if (/["']type["']\s*:\s*["']api_key["']/i.test(allCode)) {
    const envM = html.match(/([A-Z][A-Z0-9_]{3,30}_(?:TOKEN|KEY|SECRET|API_KEY))/);
    return { authType: "api_key", authParam: "api_key", authEnvHint: envM?.[1] ?? "API_KEY" };
  }
  if (/basic/i.test(allCode) && /username|user.*password/i.test(allCode)) {
    return { authType: "basic", authParam: "username", authEnvHint: "API_USERNAME" };
  }
  return { authType: "none", authParam: "", authEnvHint: "" };
}

/** Build a RESTAPIConfig from parsed data — used in advanced_config pipeline generation */
function buildRestApiConfig(
  baseUrl: string,
  authType: DltSourceContext["authType"],
  authParam: string,
  endpoints: DltContextEndpoint[]
): Record<string, unknown> {
  const auth: Record<string, unknown> =
    authType === "bearer"
      ? { type: "bearer", token: `\${${authParam.toUpperCase()}_ENV}` }
      : authType === "api_key"
      ? { type: "api_key", api_key: `\${API_KEY_ENV}` }
      : authType === "basic"
      ? { type: "http_basic", username: "${USERNAME_ENV}", password: "${PASSWORD_ENV}" }
      : {};

  const client: Record<string, unknown> = { base_url: baseUrl };
  if (authType !== "none") client.auth = auth;

  const resources = endpoints.slice(0, 20).map((ep) => {
    const resource: Record<string, unknown> = {
      name: ep.name,
      endpoint: {
        path: ep.path,
        ...(ep.method !== "GET" ? { method: ep.method } : {}),
        ...(ep.dataSelector ? { data_selector: ep.dataSelector } : {}),
      },
    };
    return resource;
  });

  return { client, resources };
}

// ── Static context from registry (no remote fetch needed) ─────────────────────

function authTypeFromRegistry(authArr: string[]): DltSourceContext["authType"] {
  const s = authArr.join(" ").toLowerCase();
  if (s.includes("bearer") || s.includes("token")) return "bearer";
  if (s.includes("api key") || s.includes("api_key")) return "api_key";
  if (s.includes("basic") || s.includes("username") || s.includes("password")) return "basic";
  return "none";
}

function authEnvHintFromCredentials(slug: string): string {
  const fields = getConnectorSourceCredentials(slug);
  const passwordField = fields.find((f) => f.type === "password");
  return passwordField?.key ?? "";
}

/**
 * For verified dlt sources that use `dlt init`, return a static context
 * derived from the registry — no remote HTTP fetch required.
 */
function buildStaticContext(requestedSlug: string): DltSourceContext | null {
  // Match by slug or contextSlug
  const src = ALL_DLT_SOURCES.find(
    (s) => s.slug === requestedSlug || s.contextSlug === requestedSlug
  );
  if (!src) return null;

  const authType = authTypeFromRegistry(src.auth);
  const authEnvHint = authEnvHintFromCredentials(src.slug);

  return {
    slug: requestedSlug,
    name: src.name,
    baseUrl: "",
    authType,
    authParam: authType === "api_key" ? "api_key" : authType === "bearer" ? "token" : "",
    authEnvHint,
    endpoints: [],
    restApiConfig: {},
    contextUrl: `https://dlthub.com/context/source/${requestedSlug}`,
  };
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  if (!slug || !/^[a-z0-9_-]+$/.test(slug)) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  // For known registry sources, return static context — no remote fetch needed.
  // dlthub context pages are CSR (client-side rendered) and return empty HTML
  // shells when fetched server-side, causing timeouts.
  const staticCtx = buildStaticContext(slug);
  if (staticCtx) {
    return NextResponse.json({ context: staticCtx }, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
    });
  }

  const contextUrl = `https://dlthub.com/context/source/${slug}`;

  let html: string;
  try {
    const resp = await fetch(contextUrl, {
      headers: { "User-Agent": "DataPulse/1.0 (pipeline-builder)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) {
      return NextResponse.json(
        { error: `Source context not found for "${slug}" (${resp.status})` },
        { status: 404 }
      );
    }
    html = await resp.text();
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to fetch context: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 }
    );
  }

  // Extract page title for the source name
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const rawTitle = titleMatch ? stripTags(titleMatch[1]) : slug;
  const name = rawTitle.replace(/\s*[-|].*$/, "").trim() || slug;

  const codeBlocks = extractCodeBlocks(html);
  const baseUrl = inferBaseUrl(html, codeBlocks);
  const { authType, authParam, authEnvHint } = inferAuth(html, codeBlocks);

  // Find endpoint table — look for a <table> near "Endpoints" heading
  const endpointSection = extractBetween(html, "endpoint", "</table>") ||
    extractBetween(html, "Endpoint", "</table>") ||
    extractBetween(html, "<table", "</table>");
  const tableHtml = "<table" + (html.includes("<table") ? extractBetween(html, "<table", "</table>") : endpointSection) + "</table>";
  const endpoints = parseEndpointTable(tableHtml);

  if (!baseUrl && endpoints.length === 0) {
    return NextResponse.json(
      { error: `Could not parse context for "${slug}" — page may use a different format` },
      { status: 422 }
    );
  }

  const restApiConfig = buildRestApiConfig(baseUrl, authType, authParam, endpoints);

  const context: DltSourceContext = {
    slug,
    name,
    baseUrl,
    authType,
    authParam,
    authEnvHint,
    endpoints,
    restApiConfig,
    contextUrl,
  };

  return NextResponse.json({ context }, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
