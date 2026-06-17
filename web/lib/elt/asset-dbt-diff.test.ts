import { describe, expect, it } from "vitest";
import { computeDbtAssetDiff } from "@/lib/elt/asset-dbt-diff";
import type { PipelineAssetBundle } from "@/lib/elt/pipeline-assets";

function stubBundle(overrides: Partial<PipelineAssetBundle> = {}): PipelineAssetBundle {
  return {
    pipelineId: "p1",
    pipelineName: "Test",
    syncMode: "connector_sync",
    sourceType: "stripe",
    destinationType: "postgres",
    enabled: true,
    landingDataset: "stripe_data",
    freshness: "fresh",
    freshnessLabel: "Fresh",
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
    rawAssets: [],
    transforms: [
      {
        id: "p1:transform:a",
        kind: "transform",
        name: "stg_a",
        displayName: "stg_a",
        pipelineId: "p1",
        pipelineName: "Test",
        syncMode: "connector_sync",
        sourceType: "stripe",
        destinationType: "postgres",
        enabled: true,
      },
      {
        id: "p1:transform:b",
        kind: "transform",
        name: "stg_b",
        displayName: "stg_b",
        pipelineId: "p1",
        pipelineName: "Test",
        syncMode: "connector_sync",
        sourceType: "stripe",
        destinationType: "postgres",
        enabled: true,
      },
    ],
    postTransforms: [],
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("computeDbtAssetDiff", () => {
  it("finds missing and extra models vs manifest", () => {
    const diff = computeDbtAssetDiff(
      stubBundle({
        lastRun: {
          id: "r1",
          status: "succeeded",
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          dbtManifest: {
            source: "runner",
            models: [
              { name: "stg_a", status: "success" },
              { name: "stg_extra", status: "success" },
            ],
            tests: [],
          },
        },
      })
    );
    expect(diff?.missingFromRun).toEqual(["stg_b"]);
    expect(diff?.extraOnRun).toEqual(["stg_extra"]);
  });
});
