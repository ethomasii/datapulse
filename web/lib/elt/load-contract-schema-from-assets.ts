import { connectionOwnerWhere, pipelineOwnerWhere } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db/client";
import { mergeCatalogIntoAssetsPayload } from "@/lib/elt/catalog-entries";
import { parseCatalogMetadata } from "@/lib/elt/catalog-metadata";
import {
  assetColumnsToContractSchema,
  mergeContractSchemaSpecs,
  suggestContractIdentity,
} from "@/lib/elt/contract-from-asset";
import type { ContractColumnSpec } from "@/lib/elt/data-contract";
import { buildAssetTechnicalProfile } from "@/lib/elt/asset-technical-profile";
import { buildWorkspaceAssets, type PipelineRunAssetInput } from "@/lib/elt/pipeline-assets";
import { fetchWarehouseColumnsForAsset } from "@/lib/elt/warehouse-column-introspect";
import type { DestinationConnectionRow } from "@/lib/elt/warehouse-introspect";

export type AssetSchemaProfile = {
  assetKey: string;
  displayName: string;
  pipelineName: string;
  columnCount: number;
  schemaSpec: ContractColumnSpec[];
};

export async function loadContractSchemaFromAssetKeys(
  ownerIds: string[],
  assetKeys: string[],
  options?: { fetchWarehouseColumns?: boolean; requiredByDefault?: boolean }
): Promise<{
  schemaSpec: ContractColumnSpec[];
  assets: AssetSchemaProfile[];
  suggested?: { name: string; slug: string };
}> {
  const uniqueKeys = Array.from(new Set(assetKeys.map((k) => k.trim()).filter(Boolean)));
  if (!uniqueKeys.length) {
    return { schemaSpec: [], assets: [] };
  }

  const rows = await db.eltPipeline.findMany({
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
      if (!pid || latestRunsByPipelineId.has(pid)) continue;
      latestRunsByPipelineId.set(pid, { ...run, pipelineId: pid });
    }
  }

  let payload = buildWorkspaceAssets(rows, latestRunsByPipelineId);
  const catalogRows = await db.catalogEntry.findMany({ where: { userId: { in: ownerIds } } });
  const entriesByKey = new Map(catalogRows.map((r) => [r.assetKey, r]));
  payload = mergeCatalogIntoAssetsPayload(payload, entriesByKey);

  const connectionCache = new Map<string, DestinationConnectionRow | null>();

  const profiles: AssetSchemaProfile[] = [];
  const specGroups: ContractColumnSpec[][] = [];

  for (const assetKey of uniqueKeys) {
    const asset = payload.assets.find((a) => a.id === assetKey);
    if (!asset) continue;
    const bundle = payload.pipelines.find((b) => b.pipelineId === asset.pipelineId);
    if (!bundle) continue;

    const entry = entriesByKey.get(assetKey);
    const catalogMetadata = parseCatalogMetadata(entry?.metadata);

    let warehouseColumns: Awaited<ReturnType<typeof fetchWarehouseColumnsForAsset>> | undefined;
    if (options?.fetchWarehouseColumns) {
      const pipelineRow = rows.find((r) => r.id === asset.pipelineId);
      const destId = pipelineRow?.destinationConnectionId;
      if (destId) {
        let conn = connectionCache.get(destId);
        if (conn === undefined) {
          conn = await db.connection.findFirst({
            where: { id: destId, ...connectionOwnerWhere(ownerIds) },
            select: {
              id: true,
              connector: true,
              config: true,
              connectionSecretsEnc: true,
            },
          });
          connectionCache.set(destId, conn);
        }
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
    const schemaSpec = assetColumnsToContractSchema(technicalProfile.columns, {
      requiredByDefault: options?.requiredByDefault,
    });
    specGroups.push(schemaSpec);
    profiles.push({
      assetKey,
      displayName: asset.catalogDisplayName ?? asset.displayName,
      pipelineName: asset.pipelineName,
      columnCount: schemaSpec.length,
      schemaSpec,
    });
  }

  const schemaSpec = mergeContractSchemaSpecs(...specGroups);
  const primary = profiles[0];
  const suggested = primary
    ? suggestContractIdentity({
        displayName: primary.displayName,
        assetKey: primary.assetKey,
        pipelineName: primary.pipelineName,
      })
    : undefined;

  return { schemaSpec, assets: profiles, suggested };
}
