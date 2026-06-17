import { describe, expect, it } from "vitest";
import { applyWarehouseVerificationToAssets } from "@/lib/elt/asset-warehouse-reconcile";
import { enrichBundleFromDbtManifest } from "@/lib/elt/asset-dbt-enrich";
import type { PipelineAssetBundle, WorkspaceAssetsResponse } from "@/lib/elt/pipeline-assets";

function stubBundle(overrides: Partial<PipelineAssetBundle> = {}): PipelineAssetBundle {
  return {
    pipelineId: "p1",
    pipelineName: "Test",
    syncMode: "connector_sync",
    sourceType: "stripe",
    destinationType: "postgres",
    enabled: true,
    landingDataset: "stripe_data",
    freshness: "never_run",
    freshnessLabel: "Never run",
    source: {
      id: "p1:source",
      kind: "source",
      name: "stripe",
      displayName: "stripe",
      pipelineId: "p1",
      pipelineName: "Test",
      syncMode: "connector_sync",
      sourceType: "stripe",
      destinationType: "postgres",
      enabled: true,
    },
    rawAssets: [
      {
        id: "p1:raw:customers",
        kind: "raw",
        name: "customers",
        displayName: "customers",
        pipelineId: "p1",
        pipelineName: "Test",
        syncMode: "connector_sync",
        sourceType: "stripe",
        destinationType: "postgres",
        landingQualified: "stripe_data.customers",
        enabled: true,
      },
    ],
    transforms: [
      {
        id: "p1:transform:stg_customers",
        kind: "transform",
        name: "stg_customers",
        displayName: "stg_customers",
        pipelineId: "p1",
        pipelineName: "Test",
        syncMode: "connector_sync",
        sourceType: "stripe",
        destinationType: "postgres",
        landingQualified: "stripe_dbt.stg_customers",
        enabled: true,
      },
    ],
    postTransforms: [],
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("asset-warehouse-reconcile", () => {
  it("marks transforms observed from dbt manifest", () => {
    const bundle = enrichBundleFromDbtManifest(
      stubBundle({
        lastRun: {
          id: "r1",
          status: "succeeded",
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          dbtManifest: {
            source: "runner",
            models: [{ name: "stg_customers", status: "success" }],
          },
        },
      })
    );
    expect(bundle.transforms[0]?.runObserved).toBe(true);
    expect(bundle.transforms[0]?.warehouseStatus).toBe("verified");
  });

  it("applies warehouse verification to raw assets", () => {
    const payload: WorkspaceAssetsResponse = {
      summary: {
        pipelines: 1,
        enabledPipelines: 1,
        sources: 1,
        rawAssets: 1,
        transforms: 1,
        postTransforms: 0,
      },
      pipelines: [stubBundle()],
      assets: [],
    };

    const result = applyWarehouseVerificationToAssets(
      payload,
      new Map([["p1", "conn1"]]),
      new Map([
        [
          "conn1",
          {
            ok: true,
            connector: "postgres",
            message: "ok",
            tables: [{ schema: "stripe_data", table: "customers", qualified: "stripe_data.customers" }],
          },
        ],
      ])
    );

    expect(result.warehouseVerification.verifiedAssets).toBeGreaterThanOrEqual(1);
    expect(result.pipelines[0]?.rawAssets[0]?.warehouseStatus).toBe("verified");
    expect(result.pipelines[0]?.transforms[0]?.warehouseStatus).toBe("missing");
  });
});
