import { NextResponse } from "next/server";
import {
  API_SCOPES,
  hasScope,
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import {
  KNOWN_MCP_CATEGORY_LABELS,
  KNOWN_MCP_SERVER_TEMPLATES,
} from "@/lib/elt/mcp-server/known-catalog";

/** GET /api/elt/mcp-servers/catalog — curated MCP integration templates (no secrets). */
export async function GET(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.CONNECTIONS_READ)) return scopeForbiddenResponse();

  return NextResponse.json({
    templates: KNOWN_MCP_SERVER_TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      vendor: t.vendor,
      category: t.category,
      categoryLabel: KNOWN_MCP_CATEGORY_LABELS[t.category],
      description: t.description,
      transport: t.transport,
      config: t.config,
      docsUrl: t.docsUrl,
      envVars: t.envVars?.map((e) => ({
        name: e.name,
        label: e.label,
        description: e.description,
        required: e.required ?? false,
        bearerPrefix: e.bearerPrefix ?? false,
        secret: e.secret !== false,
      })),
      runtimeNote: t.runtimeNote ?? null,
    })),
  });
}
