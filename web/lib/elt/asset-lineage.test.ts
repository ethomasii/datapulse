import { describe, expect, it } from "vitest";
import { parseDbtManifestDependencies, parseDbtManifestColumnLineage } from "./dbt-manifest-lineage";
import { buildAssetLineageGraph, buildManifestLineageGraph } from "./asset-lineage";
import type { PipelineAssetBundle } from "./pipeline-assets";

describe("parseDbtManifestDependencies", () => {
  it("parses parent_map into model short names", () => {
    const deps = parseDbtManifestDependencies({
      parent_map: {
        "model.my_project.dim_customers": [
          "model.my_project.stg_customers",
          "source.my_project.raw.customers",
        ],
        "model.my_project.stg_customers": ["source.my_project.raw.customers"],
      },
    });
    expect(deps.dim_customers).toEqual(["stg_customers", "customers"]);
    expect(deps.stg_customers).toEqual(["customers"]);
  });
});

describe("parseDbtManifestColumnLineage", () => {
  it("parses column parent_map into model column upstreams", () => {
    const cols = parseDbtManifestColumnLineage({
      parent_map: {
        "column.model.my_project.dim_customers.email": [
          "column.model.my_project.stg_customers.email",
        ],
        "column.model.my_project.stg_customers.id": [
          "column.source.my_project.raw.customers.id",
        ],
      },
    });
    expect(cols.dim_customers?.email).toEqual([{ model: "stg_customers", column: "email" }]);
    expect(cols.stg_customers?.id).toEqual([{ source: "raw.customers", column: "id" }]);
  });
});

describe("buildManifestLineageGraph", () => {
  const bundle: PipelineAssetBundle = {
    pipelineId: "p1",
    pipelineName: "sync",
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
      pipelineName: "sync",
      syncMode: "connector_sync",
      sourceType: "stripe",
      destinationType: "duckdb",
      enabled: true,
    },
    rawAssets: [
      {
        id: "p1:raw:customers",
        kind: "raw",
        name: "customers",
        displayName: "customers",
        pipelineId: "p1",
        pipelineName: "sync",
        syncMode: "connector_sync",
        sourceType: "stripe",
        destinationType: "duckdb",
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
        pipelineName: "sync",
        syncMode: "connector_sync",
        sourceType: "stripe",
        destinationType: "duckdb",
        enabled: true,
      },
      {
        id: "p1:transform:dim_customers",
        kind: "transform",
        name: "dim_customers",
        displayName: "dim_customers",
        pipelineId: "p1",
        pipelineName: "sync",
        syncMode: "connector_sync",
        sourceType: "stripe",
        destinationType: "duckdb",
        enabled: true,
      },
    ],
    postTransforms: [],
  };

  it("builds edges from manifest dependencies", () => {
    const graph = buildManifestLineageGraph(bundle, {
      stg_customers: ["customers"],
      dim_customers: ["stg_customers"],
    });
    expect(graph.fromManifest).toBe(true);
    expect(graph.edges.some((e) => e.from === "p1:raw:customers" && e.to === "p1:transform:stg_customers")).toBe(
      true
    );
    expect(graph.edges.some((e) => e.from === "p1:transform:stg_customers" && e.to === "p1:transform:dim_customers")).toBe(
      true
    );
  });

  it("prefers manifest lineage in buildAssetLineageGraph when lastRun has deps", () => {
    const withRun: PipelineAssetBundle = {
      ...bundle,
      lastRun: {
        id: "r1",
        status: "succeeded",
        startedAt: "",
        finishedAt: null,
        dbtManifest: {
          source: "runner",
          models: [],
          tests: [],
          modelDependencies: {
            stg_customers: ["customers"],
            dim_customers: ["stg_customers"],
          },
        },
      },
    };
    const graph = buildAssetLineageGraph(withRun);
    expect(graph.fromManifest).toBe(true);
    expect(graph.edges.length).toBeGreaterThan(1);
  });
});
