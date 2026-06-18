import { NextResponse } from "next/server";
import {
  API_SCOPES,
  hasScope,
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { connectionOwnerWhere, getAccessibleResourceOwnerIds, pipelineOwnerWhere } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db/client";
import { applyWarehouseVerificationToAssets } from "@/lib/elt/asset-warehouse-reconcile";
import { buildWorkspaceAssets, type PipelineRunAssetInput } from "@/lib/elt/pipeline-assets";
import { mergeCatalogIntoAssetsPayload } from "@/lib/elt/catalog-entries";
import { introspectDestinationConnection } from "@/lib/elt/warehouse-introspect";

export async function GET(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.PIPELINES_READ)) return scopeForbiddenResponse();

  const verifyWarehouse = new URL(req.url).searchParams.get("verifyWarehouse") === "1";

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
      if (!latestRunsByPipelineId.has(run.pipelineId)) {
        latestRunsByPipelineId.set(run.pipelineId, run);
      }
    }
  }

  let payload = buildWorkspaceAssets(rows, latestRunsByPipelineId);

  const catalogRows = await db.catalogEntry.findMany({
    where: { userId: { in: ownerIds } },
  });
  const entriesByKey = new Map(catalogRows.map((r) => [r.assetKey, r]));
  payload = mergeCatalogIntoAssetsPayload(payload, entriesByKey);

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

  return NextResponse.json(payload);
}
