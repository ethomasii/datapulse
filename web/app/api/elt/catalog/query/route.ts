import { NextResponse } from "next/server";
import { z } from "zod";
import {
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { isPublicCatalogTags } from "@/lib/auth/catalog-access";
import { connectionOwnerWhere, getAccessibleResourceOwnerIds, pipelineOwnerWhere } from "@/lib/auth/workspace-access";
import { hasCatalogReadScope } from "@/lib/auth/workspace-auth-helpers";
import { getWorkspacePermissions } from "@/lib/auth/org-permissions";
import { db } from "@/lib/db/client";
import { mergeCatalogIntoAssetsPayload } from "@/lib/elt/catalog-entries";
import { buildWorkspaceAssets } from "@/lib/elt/pipeline-assets";
import { runReadOnlyQuery, sampleAssetData } from "@/lib/elt/warehouse-readonly-query";

const bodySchema = z.object({
  assetKey: z.string().min(1).max(512),
  sql: z.string().max(4000).optional(),
  limit: z.number().int().min(1).max(25).optional(),
});

export async function POST(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasCatalogReadScope(auth)) return scopeForbiddenResponse();

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const perms = await getWorkspacePermissions(auth.user.id);
  const ownerIds = await getAccessibleResourceOwnerIds(auth.user.id);

  const pipelines = await db.eltPipeline.findMany({
    where: pipelineOwnerWhere(ownerIds),
    select: {
      id: true,
      name: true,
      tool: true,
      enabled: true,
      sourceType: true,
      destinationType: true,
      sourceConfiguration: true,
      destinationConnectionId: true,
      updatedAt: true,
    },
  });

  const catalogRows = await db.catalogEntry.findMany({ where: { userId: { in: ownerIds } } });
  const entriesByKey = new Map(catalogRows.map((r) => [r.assetKey, r]));
  let payload = mergeCatalogIntoAssetsPayload(buildWorkspaceAssets(pipelines), entriesByKey);

  if (perms.catalogVisibility === "public_only") {
    payload = {
      ...payload,
      assets: payload.assets.filter((a) => isPublicCatalogTags(a.catalogTags)),
    };
  }

  const asset = payload.assets.find((a) => a.id === body.assetKey);
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  const pipelineRow = pipelines.find((p) => p.id === asset.pipelineId);
  if (!pipelineRow?.destinationConnectionId) {
    return NextResponse.json({ error: "Pipeline has no destination connection for data preview." }, { status: 400 });
  }

  const conn = await db.connection.findFirst({
    where: { id: pipelineRow.destinationConnectionId, ...connectionOwnerWhere(ownerIds) },
    select: { id: true, connector: true, config: true, connectionSecretsEnc: true },
  });
  if (!conn) return NextResponse.json({ error: "Destination connection not found" }, { status: 404 });

  const limit = body.limit ?? 5;
  const result = body.sql?.trim()
    ? await runReadOnlyQuery(conn, body.sql, limit)
    : await sampleAssetData(conn, asset.landingQualified, limit);

  return NextResponse.json({ assetKey: body.assetKey, ...result });
}
