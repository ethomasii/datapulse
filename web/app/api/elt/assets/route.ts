import { NextResponse } from "next/server";
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
import { applyWarehouseVerificationToAssets } from "@/lib/elt/asset-warehouse-reconcile";
import { buildWorkspaceAssets, type PipelineRunAssetInput } from "@/lib/elt/pipeline-assets";
import { mergeCatalogIntoAssetsPayload, parseTags } from "@/lib/elt/catalog-entries";
import { parseCatalogMetadata } from "@/lib/elt/catalog-metadata";
import { buildAssetTechnicalProfile } from "@/lib/elt/asset-technical-profile";
import { fetchWarehouseColumnsForAsset } from "@/lib/elt/warehouse-column-introspect";
import { introspectDestinationConnection } from "@/lib/elt/warehouse-introspect";

export async function GET(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasCatalogReadScope(auth)) return scopeForbiddenResponse();

  const verifyWarehouse = new URL(req.url).searchParams.get("verifyWarehouse") === "1";
  const fetchColumns = new URL(req.url).searchParams.get("columns") === "1";
  const perms = await getWorkspacePermissions(auth.user.id);

  const ownerIds = await getAccessibleResourceOwnerIds(auth.user.id);
  const rows = await db.eltPipeline.findMany({
    where: pipelineOwnerWhere(ownerIds),
    orderBy: { updatedAt: "desc" },
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

  const pipelineIds = rows.map((r) => r.id);
  const latestRunsByPipelineId = new Map<string, PipelineRunAssetInput>();

  if (pipelineIds.length > 0) {
    const runs = await db.eltPipelineRun.findMany({
      where: { pipelineId: { in: pipelineIds } },
      orderBy: { startedAt: "desc" },
      take: Math.min(pipelineIds.length * 5, 500),
      select: {
        id: true,
        pipelineId: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        telemetry: true,
      },
    });
    for (const run of runs) {
      const pid = run.pipelineId;
      if (!pid) continue;
      if (!latestRunsByPipelineId.has(pid)) {
        latestRunsByPipelineId.set(pid, { ...run, pipelineId: pid });
      }
    }
  }

  let payload = buildWorkspaceAssets(rows, latestRunsByPipelineId);

  const pipelineIdFilter = new URL(req.url).searchParams.get("pipelineId")?.trim();
  if (pipelineIdFilter) {
    payload = {
      ...payload,
      assets: payload.assets.filter((a) => a.pipelineId === pipelineIdFilter),
      pipelines: payload.pipelines.filter((b) => b.pipelineId === pipelineIdFilter),
    };
  }

  const catalogRows = await db.catalogEntry.findMany({
    where: { userId: { in: ownerIds } },
  });
  const entriesByKey = new Map(catalogRows.map((r) => [r.assetKey, r]));
  payload = mergeCatalogIntoAssetsPayload(payload, entriesByKey);

  if (perms.catalogVisibility === "public_only") {
    const visibleAssets = payload.assets.filter((a) => isPublicCatalogTags(a.catalogTags));
    const visiblePipelineIds = new Set(visibleAssets.map((a) => a.pipelineId));
    payload = {
      ...payload,
      assets: visibleAssets,
      pipelines: payload.pipelines.filter((b) => visiblePipelineIds.has(b.pipelineId)),
      summary: {
        ...payload.summary,
        rawAssets: visibleAssets.filter((a) => a.kind !== "transform").length,
        transforms: visibleAssets.filter((a) => a.kind === "transform").length,
      },
    };
  }

  if (verifyWarehouse) {
    const pipelineDestinationConnectionId = new Map(
      rows.map((r) => [r.id, r.destinationConnectionId] as const)
    );
    const connectionIds = Array.from(
      new Set(
        rows
          .map((r) => r.destinationConnectionId)
          .filter((id): id is string => Boolean(id))
      )
    );

    const introspectionByConnectionId = new Map<
      string,
      Awaited<ReturnType<typeof introspectDestinationConnection>>
    >();

    if (connectionIds.length > 0) {
      const connections = await db.connection.findMany({
        where: { id: { in: connectionIds }, ...connectionOwnerWhere(ownerIds) },
        select: {
          id: true,
          connector: true,
          config: true,
          connectionSecretsEnc: true,
        },
      });
      await Promise.all(
        connections.map(async (conn) => {
          const result = await introspectDestinationConnection(conn);
          introspectionByConnectionId.set(conn.id, result);
        })
      );
    }

    payload = applyWarehouseVerificationToAssets(
      payload,
      pipelineDestinationConnectionId,
      introspectionByConnectionId
    );
  }

  const assetKeyParam = new URL(req.url).searchParams.get("assetKey")?.trim();
  if (assetKeyParam) {
    const asset = payload.assets.find((a) => a.id === assetKeyParam);
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }
    const bundle = payload.pipelines.find((b) => b.pipelineId === asset.pipelineId);
    if (!bundle) {
      return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
    }

    const catalogRow = entriesByKey.get(asset.id);
    const catalogMetadata = parseCatalogMetadata(catalogRow?.metadata);

    let warehouseColumns: Awaited<ReturnType<typeof fetchWarehouseColumnsForAsset>> | undefined;
    if (fetchColumns) {
      const pipelineRow = rows.find((r) => r.id === asset.pipelineId);
      const destId = pipelineRow?.destinationConnectionId;
      if (destId) {
        const conn = await db.connection.findFirst({
          where: { id: destId, ...connectionOwnerWhere(ownerIds) },
          select: {
            id: true,
            connector: true,
            config: true,
            connectionSecretsEnc: true,
          },
        });
        if (conn) {
          warehouseColumns = await fetchWarehouseColumnsForAsset(conn, asset.landingQualified);
        }
      }
    }

    const technicalProfile = buildAssetTechnicalProfile(
      asset,
      bundle,
      catalogMetadata,
      warehouseColumns?.columns
    );

    return NextResponse.json({
      asset,
      bundle,
      catalogEntry: catalogRow
        ? {
            description: catalogRow.description,
            tags: parseTags(catalogRow.tags),
            metadata: catalogMetadata,
            aiGeneratedAt: catalogMetadata.aiGeneratedAt,
          }
        : null,
      technicalProfile,
      warehouseColumns: warehouseColumns
        ? { ok: warehouseColumns.ok, message: warehouseColumns.message }
        : undefined,
      permissions: {
        canEditCatalog: perms.canEditCatalog,
        catalogVisibility: perms.catalogVisibility,
      },
    });
  }

  return NextResponse.json({
    ...payload,
    permissions: {
      canEditCatalog: perms.canEditCatalog,
      canWrite: perms.canWrite,
      catalogVisibility: perms.catalogVisibility,
    },
  });
}
