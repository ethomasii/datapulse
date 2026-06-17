import { describe, expect, it } from "vitest";
import { computeAssetFreshness, resourcesTouchedFromTelemetry } from "@/lib/elt/asset-level-freshness";
import type { WorkspaceAsset } from "@/lib/elt/pipeline-assets";

const rawAsset: WorkspaceAsset = {
  id: "p1:raw:customers",
  kind: "raw",
  name: "customers",
  displayName: "customers",
  pipelineId: "p1",
  pipelineName: "Test",
  syncMode: "connector_sync",
  sourceType: "stripe",
  destinationType: "postgres",
  enabled: true,
};

describe("asset-level-freshness", () => {
  it("extracts resources from telemetry samples", () => {
    const keys = resourcesTouchedFromTelemetry({
      summary: { currentResource: "customers" },
      samples: [{ resource: "charges" }],
    });
    expect(keys.has("customers")).toBe(true);
    expect(keys.has("charges")).toBe(true);
  });

  it("marks raw asset fresh when resource was touched", () => {
    const meta = computeAssetFreshness(
      rawAsset,
      {
        id: "r1",
        status: "succeeded",
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      },
      true,
      new Set(["customers"])
    );
    expect(meta.freshness).toBe("fresh");
    expect(meta.label).toBe("Loaded");
  });

  it("marks transform failed when dbt model errored", () => {
    const meta = computeAssetFreshness(
      {
        ...rawAsset,
        kind: "transform",
        name: "stg_customers",
        displayName: "stg_customers",
      },
      {
        id: "r1",
        status: "succeeded",
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        dbtManifest: {
          models: [{ name: "stg_customers", status: "error" }],
          tests: [],
        },
      },
      true,
      new Set()
    );
    expect(meta.freshness).toBe("failed");
  });
});
