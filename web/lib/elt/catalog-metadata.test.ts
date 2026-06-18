import { describe, expect, it } from "vitest";
import { mergeAssetColumns } from "./catalog-metadata";
import { buildInferredTechnicalProfile } from "./asset-technical-profile";
import type { PipelineAssetBundle, WorkspaceAsset } from "./pipeline-assets";

describe("mergeAssetColumns", () => {
  it("prefers warehouse over inferred", () => {
    const merged = mergeAssetColumns(
      [{ name: "id", type: "text", source: "inferred" }],
      [{ name: "id", type: "uuid", source: "warehouse" }]
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.type).toBe("uuid");
    expect(merged[0]?.source).toBe("warehouse");
  });
});

describe("buildInferredTechnicalProfile", () => {
  it("describes raw dlt resources", () => {
    const asset: WorkspaceAsset = {
      id: "p1:raw:issues",
      kind: "raw",
      name: "issues",
      displayName: "issues",
      pipelineId: "p1",
      pipelineName: "github_sync",
      syncMode: "connector_sync",
      sourceType: "github",
      destinationType: "postgres",
      landingQualified: "github_data.issues",
      enabled: true,
    };
    const bundle = {
      pipelineId: "p1",
      pipelineName: "github_sync",
      syncMode: "connector_sync" as const,
      sourceType: "github",
      destinationType: "postgres",
      enabled: true,
      landingDataset: "github_data",
      freshness: "unknown" as const,
      freshnessLabel: "Unknown",
      source: asset,
      rawAssets: [asset],
      transforms: [],
      postTransforms: [],
      updatedAt: new Date().toISOString(),
    } satisfies PipelineAssetBundle;

    const profile = buildInferredTechnicalProfile(asset, bundle);
    expect(profile.inferredDescription).toContain("dlt resource");
    expect(profile.columnSources).toContain("dlt");
  });
});
