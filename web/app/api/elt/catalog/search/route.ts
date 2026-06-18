import { NextResponse } from "next/server";
import {
  API_SCOPES,
  hasScope,
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { getAccessibleResourceOwnerIds, pipelineOwnerWhere } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db/client";
import { parseTags } from "@/lib/elt/catalog-entries";
import { buildWorkspaceAssets } from "@/lib/elt/pipeline-assets";

export type CatalogSearchHit = {
  assetKey: string;
  kind: string;
  displayName: string;
  description?: string;
  tags: string[];
  pipelineId?: string;
  pipelineName?: string;
  source: "catalog_entry" | "asset";
};

function matchesQuery(hay: string, q: string): boolean {
  return hay.toLowerCase().includes(q);
}

export async function GET(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.PIPELINES_READ)) return scopeForbiddenResponse();

  const q = new URL(req.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (!q || q.length < 2) {
    return NextResponse.json({ error: "Provide q with at least 2 characters" }, { status: 400 });
  }

  const ownerIds = await getAccessibleResourceOwnerIds(auth.user.id);
  const limit = Math.min(100, Math.max(1, Number(new URL(req.url).searchParams.get("limit") ?? 50) || 50));

  const [entries, pipelines] = await Promise.all([
    db.catalogEntry.findMany({
      where: { userId: { in: ownerIds } },
      orderBy: { updatedAt: "desc" },
    }),
    db.eltPipeline.findMany({
      where: pipelineOwnerWhere(ownerIds),
      select: {
        id: true,
        name: true,
        tool: true,
        enabled: true,
        sourceType: true,
        destinationType: true,
        sourceConfiguration: true,
        updatedAt: true,
      },
    }),
  ]);

  const pipelineNameById = new Map(pipelines.map((p) => [p.id, p.name]));
  const hits: CatalogSearchHit[] = [];
  const seen = new Set<string>();

  for (const row of entries) {
    const tags = parseTags(row.tags);
    const hay = [row.assetKey, row.displayName ?? "", row.description ?? "", row.kind, ...tags].join(" ");
    if (!matchesQuery(hay, q)) continue;
    seen.add(row.assetKey);
    hits.push({
      assetKey: row.assetKey,
      kind: row.kind,
      displayName: row.displayName ?? row.assetKey,
      description: row.description ?? undefined,
      tags,
      pipelineId: row.pipelineId ?? undefined,
      pipelineName: row.pipelineId ? pipelineNameById.get(row.pipelineId) : undefined,
      source: "catalog_entry",
    });
    if (hits.length >= limit) break;
  }

  if (hits.length < limit) {
    const assetsPayload = buildWorkspaceAssets(pipelines);
    for (const asset of assetsPayload.assets) {
      if (seen.has(asset.id)) continue;
      const hay = [
        asset.id,
        asset.displayName,
        asset.name,
        asset.kind,
        asset.landingQualified ?? "",
        asset.pipelineName ?? "",
        asset.description ?? "",
      ].join(" ");
      if (!matchesQuery(hay, q)) continue;
      seen.add(asset.id);
      hits.push({
        assetKey: asset.id,
        kind: asset.kind,
        displayName: asset.displayName,
        pipelineId: asset.pipelineId,
        pipelineName: asset.pipelineName,
        tags: [],
        source: "asset",
      });
      if (hits.length >= limit) break;
    }
  }

  return NextResponse.json({ q, hits, total: hits.length });
}
