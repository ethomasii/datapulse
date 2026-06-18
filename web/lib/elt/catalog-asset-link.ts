import type { WorkspaceAsset } from "@/lib/elt/pipeline-assets";
import { tableRefFromAsset } from "@/lib/elt/table-asset-fields";

export const CATALOG_OUTPUT_KEY = "catalog_asset_key";
export const CATALOG_INPUT_KEYS = "input_catalog_asset_keys";

/** Apply a warehouse asset pick to component config (table ref + catalog id). */
export function applyPickedAssetToConfig(
  config: Record<string, unknown>,
  fieldKey: string,
  tableRef: string,
  asset?: Pick<WorkspaceAsset, "id" | "landingQualified" | "displayName" | "name">
): Record<string, unknown> {
  const next = { ...config, [fieldKey]: tableRef };

  if (!asset?.id) return next;

  if (fieldKey === "table" || fieldKey === "output_table" || fieldKey === "table_name") {
    next[CATALOG_OUTPUT_KEY] = asset.id;
    next.asset_key = tableRef;
  } else if (fieldKey === "left_table" || fieldKey === "left_asset_key") {
    next.left_catalog_asset_key = asset.id;
    next.left_asset_key = tableRef;
  } else if (fieldKey === "right_table" || fieldKey === "right_asset_key") {
    next.right_catalog_asset_key = asset.id;
    next.right_asset_key = tableRef;
  } else if (fieldKey === "input_table") {
    next.input_catalog_asset_key = asset.id;
  }

  return next;
}

/** Sync multi-select catalog ids into logical input_asset_keys for spec enrichment. */
export function applyInputCatalogAssets(
  config: Record<string, unknown>,
  catalogIds: string[],
  assetsById: Map<string, WorkspaceAsset>
): Record<string, unknown> {
  const refs = catalogIds
    .map((id) => {
      const a = assetsById.get(id);
      return a ? tableRefFromAsset(a) : id;
    })
    .filter(Boolean);
  return {
    ...config,
    [CATALOG_INPUT_KEYS]: catalogIds,
    ...(refs.length ? { input_asset_keys: refs } : {}),
  };
}

/** Resolve catalog asset id from config + loaded pipeline assets. */
export function resolveCatalogAssetId(
  config: Record<string, unknown>,
  assets: WorkspaceAsset[],
  kind: "output" | "left" | "right" = "output"
): string | null {
  const explicit =
    kind === "output"
      ? String(config[CATALOG_OUTPUT_KEY] ?? "").trim()
      : kind === "left"
        ? String(config.left_catalog_asset_key ?? "").trim()
        : String(config.right_catalog_asset_key ?? "").trim();
  if (explicit) return explicit;

  const tableRef =
    kind === "output"
      ? String(config.asset_key ?? config.output_table ?? config.table ?? config.table_name ?? "").trim()
      : kind === "left"
        ? String(config.left_asset_key ?? config.left_table ?? "").trim()
        : String(config.right_asset_key ?? config.right_table ?? "").trim();
  if (!tableRef) return null;

  const match = assets.find(
    (a) =>
      a.landingQualified === tableRef ||
      tableRefFromAsset(a) === tableRef ||
      a.displayName === tableRef ||
      a.name === tableRef
  );
  return match?.id ?? null;
}
