import { enrichBundleFromDbtManifest } from "@/lib/elt/asset-dbt-enrich";
import type { PipelineAssetBundle, WorkspaceAsset, WorkspaceAssetsResponse } from "@/lib/elt/pipeline-assets";
import {
  isTablePresentInWarehouse,
  tableSetFromIntrospection,
  type WarehouseIntrospectionResult,
} from "@/lib/elt/warehouse-introspect";

export type WarehouseAssetStatus = "verified" | "missing" | "unknown" | "not_checked";

export type WarehouseVerificationSummary = {
  checkedPipelines: number;
  verifiedAssets: number;
  missingAssets: number;
  unknownAssets: number;
  destinationsIntrospected: number;
  messages: string[];
};

function withWarehouseStatus(asset: WorkspaceAsset, status: WarehouseAssetStatus): WorkspaceAsset {
  return { ...asset, warehouseStatus: status };
}

function applyStatusToAssets(
  assets: WorkspaceAsset[],
  warehouseTables: Set<string> | null
): { assets: WorkspaceAsset[]; verified: number; missing: number; unknown: number } {
  let verified = 0;
  let missing = 0;
  let unknown = 0;

  const next = assets.map((a) => {
    if (a.kind === "source") return withWarehouseStatus(a, "not_checked");
    if (!a.landingQualified) {
      unknown += 1;
      return withWarehouseStatus(a, "unknown");
    }
    if (!warehouseTables) {
      unknown += 1;
      return withWarehouseStatus(a, "not_checked");
    }
    const present = isTablePresentInWarehouse(a.landingQualified, warehouseTables);
    if (present === true) {
      verified += 1;
      return withWarehouseStatus(a, "verified");
    }
    if (present === false) {
      missing += 1;
      return withWarehouseStatus(a, "missing");
    }
    unknown += 1;
    return withWarehouseStatus(a, "unknown");
  });

  return { assets: next, verified, missing, unknown };
}

export function applyWarehouseVerificationToAssets(
  payload: WorkspaceAssetsResponse,
  pipelineDestinationConnectionId: Map<string, string | null>,
  introspectionByConnectionId: Map<string, WarehouseIntrospectionResult>
): WorkspaceAssetsResponse & { warehouseVerification: WarehouseVerificationSummary } {
  const messages: string[] = [];
  let verifiedAssets = 0;
  let missingAssets = 0;
  let unknownAssets = 0;
  let checkedPipelines = 0;

  const pipelines = payload.pipelines.map((bundle) => {
    const enriched = enrichBundleFromDbtManifest(bundle);
    const connId = pipelineDestinationConnectionId.get(bundle.pipelineId) ?? null;
    if (!connId) {
      return enriched;
    }

    const intro = introspectionByConnectionId.get(connId);
    const tableSet = intro?.ok ? tableSetFromIntrospection(intro.tables) : null;
    if (intro && !intro.ok) {
      messages.push(`${bundle.pipelineName}: ${intro.message}`);
    }

    checkedPipelines += 1;

    const raw = applyStatusToAssets(enriched.rawAssets, tableSet);
    const transforms = applyStatusToAssets(enriched.transforms, tableSet);
    const post = applyStatusToAssets(enriched.postTransforms, tableSet);

    verifiedAssets += raw.verified + transforms.verified + post.verified;
    missingAssets += raw.missing + transforms.missing + post.missing;
    unknownAssets += raw.unknown + transforms.unknown + post.unknown;

    return {
      ...enriched,
      rawAssets: raw.assets,
      transforms: transforms.assets,
      postTransforms: post.assets,
      warehouseChecked: Boolean(intro?.ok),
      warehouseMessage: intro?.message,
    };
  });

  const assets = pipelines.flatMap((b) => [b.source, ...b.rawAssets, ...b.transforms, ...b.postTransforms]);

  return {
    ...payload,
    pipelines,
    assets,
    warehouseVerification: {
      checkedPipelines,
      verifiedAssets,
      missingAssets,
      unknownAssets,
      destinationsIntrospected: Array.from(introspectionByConnectionId.values()).filter((i) => i.ok).length,
      messages,
    },
  };
}
