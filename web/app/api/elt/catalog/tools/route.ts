import { NextResponse } from "next/server";
import {
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { hasCatalogReadScope } from "@/lib/auth/workspace-auth-helpers";

/** Tool descriptors for MCP / agent integrations (Cursor, Claude, etc.). */
export async function GET(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasCatalogReadScope(auth)) return scopeForbiddenResponse();

  const base = new URL(req.url).origin;

  return NextResponse.json({
    name: "eltpulse-catalog",
    version: "1",
    tools: [
      {
        name: "search_catalog",
        description: "Search workspace catalog assets by name, description, tags, or columns",
        endpoint: `${base}/api/elt/catalog/search`,
        method: "GET",
        params: { q: "string (min 2 chars)", limit: "number optional" },
      },
      {
        name: "get_asset",
        description: "Get asset detail, schema columns, and technical profile",
        endpoint: `${base}/api/elt/assets`,
        method: "GET",
        params: { assetKey: "string", columns: "1 optional" },
      },
      {
        name: "ask_catalog",
        description: "Ask a natural language question about an asset or the whole catalog",
        endpoint: `${base}/api/elt/catalog/ai`,
        method: "POST",
        body: { action: "ask", assetKey: "optional", question: "string", includeDataSample: "boolean optional" },
      },
      {
        name: "sample_asset_data",
        description: "Read-only sample rows from an asset landing table",
        endpoint: `${base}/api/elt/catalog/query`,
        method: "POST",
        body: { assetKey: "string", limit: "number optional (max 25)" },
      },
      {
        name: "pipeline_health",
        description: "7-day pipeline sync health, success rate, row counts",
        endpoint: `${base}/api/elt/pipelines/health`,
        method: "GET",
        params: { pipelineId: "string optional" },
      },
    ],
  });
}
