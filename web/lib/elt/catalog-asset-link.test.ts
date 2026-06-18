import { describe, expect, it } from "vitest";
import {
  applyInputCatalogAssets,
  applyPickedAssetToConfig,
  resolveCatalogAssetId,
} from "@/lib/elt/catalog-asset-link";
import type { WorkspaceAsset } from "@/lib/elt/pipeline-assets";

const assets: WorkspaceAsset[] = [
  {
    id: "p1:raw:orders",
    kind: "raw",
    name: "orders",
    displayName: "orders",
    pipelineId: "p1",
    pipelineName: "stripe",
    syncMode: "connector_sync",
    sourceType: "stripe",
    destinationType: "snowflake",
    landingQualified: "stripe_data.orders",
    enabled: true,
  },
];

describe("catalog-asset-link", () => {
  it("stores catalog id on output table pick", () => {
    const next = applyPickedAssetToConfig({}, "table", "stripe_data.orders", assets[0]);
    expect(next.catalog_asset_key).toBe("p1:raw:orders");
    expect(next.asset_key).toBe("stripe_data.orders");
    expect(next.table).toBe("stripe_data.orders");
  });

  it("resolves catalog id from landingQualified", () => {
    expect(resolveCatalogAssetId({ table: "stripe_data.orders" }, assets)).toBe("p1:raw:orders");
  });

  it("maps input catalog ids to input_asset_keys", () => {
    const byId = new Map(assets.map((a) => [a.id, a]));
    const next = applyInputCatalogAssets({}, ["p1:raw:orders"], byId);
    expect(next.input_catalog_asset_keys).toEqual(["p1:raw:orders"]);
    expect(next.input_asset_keys).toEqual(["stripe_data.orders"]);
  });
});
