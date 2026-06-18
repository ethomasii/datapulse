/** Form field keys that reference warehouse tables — show catalog/table picker. */
export const TABLE_ASSET_FIELD_KEYS = new Set([
  "table",
  "output_table",
  "left_table",
  "right_table",
  "left_asset_key",
  "right_asset_key",
  "table_name",
  "input_table",
]);

export function isTableAssetField(key: string): boolean {
  return TABLE_ASSET_FIELD_KEYS.has(key);
}

/** Best SQL table ref from a workspace asset row. */
export function tableRefFromAsset(asset: {
  landingQualified?: string;
  landingDataset?: string;
  name: string;
  displayName: string;
}): string {
  if (asset.landingQualified?.trim()) return asset.landingQualified.trim();
  if (asset.landingDataset?.trim() && asset.name) {
    return `${asset.landingDataset}.${asset.name}`;
  }
  return asset.displayName || asset.name;
}
