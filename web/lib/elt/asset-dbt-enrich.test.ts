import { describe, expect, it } from "vitest";
import { enrichBundleFromDbtManifest, transformAssetsFromDbtManifest } from "./asset-dbt-enrich";
import type { PipelineAssetBundle } from "./pipeline-assets";

const baseBundle: PipelineAssetBundle = {
  pipelineId: "p1",
  pipelineName: "stripe_nightly",
  syncMode: "connector_sync",
  sourceType: "stripe",
  destinationType: "duckdb",
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
    pipelineName: "stripe_nightly",
    syncMode: "connector_sync",
    sourceType: "stripe",
    destinationType: "duckdb",
    enabled: true,
  },
  rawAssets: [],
  transforms: [
    {
      id: "p1:transform:hub_guess",
      kind: "transform",
      name: "stg_customers",
      displayName: "stg_customers",
      pipelineId: "p1",
      pipelineName: "stripe_nightly",
      syncMode: "connector_sync",
      sourceType: "stripe",
      destinationType: "duckdb",
      landingDataset: "analytics",
      enabled: true,
      dbtPackage: "dlt-hub/stripe",
    },
  ],
  postTransforms: [],
  lastRun: {
    id: "r1",
    status: "succeeded",
    startedAt: "2026-06-18T00:00:00.000Z",
    finishedAt: "2026-06-18T00:05:00.000Z",
    dbtManifest: {
      source: "runner",
      datasetName: "analytics_marts",
      models: [
        { name: "dim_customers", status: "success", description: "Customer dimension" },
        { name: "fct_charges", status: "success" },
      ],
      tests: [],
    },
  },
};

describe("transformAssetsFromDbtManifest", () => {
  it("builds transform assets from runner manifest models", () => {
    const manifest = baseBundle.lastRun!.dbtManifest!;
    const transforms = transformAssetsFromDbtManifest(baseBundle, manifest);
    expect(transforms).toHaveLength(2);
    expect(transforms.map((t) => t.name).sort()).toEqual(["dim_customers", "fct_charges"]);
    expect(transforms[0]?.runObserved).toBe(true);
    expect(transforms[0]?.landingQualified).toBe("analytics_marts.dim_customers");
  });
});

describe("enrichBundleFromDbtManifest", () => {
  it("replaces hub guesses when manifest source is runner", () => {
    const enriched = enrichBundleFromDbtManifest(baseBundle);
    expect(enriched.transforms).toHaveLength(2);
    expect(enriched.transforms.some((t) => t.name === "dim_customers")).toBe(true);
    expect(enriched.transforms.some((t) => t.name === "stg_customers")).toBe(false);
  });
});
