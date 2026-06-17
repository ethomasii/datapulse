import { describe, expect, it } from "vitest";
import { computePipelineFreshness } from "./asset-freshness";
import { dbtFailedTests, inferDbtManifestFromPipelineConfig } from "./dbt-run-manifest";

describe("computePipelineFreshness", () => {
  it("marks recent success as fresh", () => {
    const meta = computePipelineFreshness(
      {
        id: "r1",
        status: "succeeded",
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        rowsLoaded: 1000,
      },
      true
    );
    expect(meta.freshness).toBe("fresh");
  });

  it("marks missing run as never_run", () => {
    expect(computePipelineFreshness(undefined, true).freshness).toBe("never_run");
  });
});

describe("inferDbtManifestFromPipelineConfig", () => {
  it("returns models for stripe dbt config", () => {
    const m = inferDbtManifestFromPipelineConfig(
      "stripe",
      { dbt: { enabled: true, package_path: "dlt-hub/stripe_source" } },
      "succeeded"
    );
    expect(m?.models.length).toBeGreaterThan(0);
    expect(m?.source).toBe("config");
  });
});

describe("dbtFailedTests", () => {
  it("filters failing tests", () => {
    const failures = dbtFailedTests({
      models: [],
      tests: [
        { name: "ok", status: "pass" },
        { name: "bad", status: "fail", message: "nulls" },
      ],
    });
    expect(failures).toHaveLength(1);
    expect(failures[0]?.name).toBe("bad");
  });
});
