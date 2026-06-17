import { describe, expect, it } from "vitest";
import {
  buildWorkspaceAssets,
  derivePipelineAssets,
  resolveLandingDataset,
} from "./pipeline-assets";

describe("resolveLandingDataset", () => {
  it("uses schema_override when set", () => {
    expect(resolveLandingDataset("stripe", { schema_override: "analytics_raw" }, "stripe_nightly")).toBe(
      "analytics_raw"
    );
  });

  it("builds github dataset from repo", () => {
    expect(
      resolveLandingDataset("github", { repo_owner: "acme", repo_name: "app" }, "github_sync")
    ).toBe("github_acme_app");
  });
});

describe("derivePipelineAssets", () => {
  it("derives connector sync resources and dbt transforms", () => {
    const bundle = derivePipelineAssets({
      id: "p1",
      name: "stripe_nightly",
      tool: "dlt",
      enabled: true,
      sourceType: "stripe",
      destinationType: "snowflake",
      updatedAt: "2026-06-17T00:00:00.000Z",
      sourceConfiguration: {
        resources: ["customers", "charges"],
        dbt: {
          enabled: true,
          package_path: "dlt-hub/stripe_source",
          dataset_name: "analytics_staging",
        },
      },
    });

    expect(bundle.syncMode).toBe("connector_sync");
    expect(bundle.rawAssets).toHaveLength(2);
    expect(bundle.rawAssets[0]?.landingQualified).toBe("stripe_data.customers");
    expect(bundle.transforms.length).toBeGreaterThan(0);
    expect(bundle.transforms[0]?.dbtPackage).toBe("dlt-hub/stripe_source");
    expect(bundle.transforms[0]?.landingDataset).toBe("analytics_staging");
  });

  it("derives database replication streams", () => {
    const bundle = derivePipelineAssets({
      id: "p2",
      name: "pg_to_sf",
      tool: "sling",
      enabled: true,
      sourceType: "postgres",
      destinationType: "snowflake",
      updatedAt: "2026-06-17T00:00:00.000Z",
      sourceConfiguration: {
        tables: "users, orders",
        schema: "public",
        target_schema: "RAW",
      },
    });

    expect(bundle.syncMode).toBe("database_replication");
    expect(bundle.transforms).toHaveLength(0);
    expect(bundle.rawAssets.map((a) => a.name).sort()).toEqual(["orders", "users"]);
    expect(bundle.rawAssets[0]?.landingQualified).toMatch(/^RAW\./);
  });
});

describe("buildWorkspaceAssets", () => {
  it("aggregates summary counts", () => {
    const result = buildWorkspaceAssets([
      {
        id: "p1",
        name: "a",
        tool: "dlt",
        enabled: true,
        sourceType: "github",
        destinationType: "duckdb",
        updatedAt: "2026-06-17T00:00:00.000Z",
        sourceConfiguration: { resources: ["issues"] },
      },
      {
        id: "p2",
        name: "b",
        tool: "sling",
        enabled: false,
        sourceType: "postgres",
        destinationType: "snowflake",
        updatedAt: "2026-06-16T00:00:00.000Z",
        sourceConfiguration: { tables: "users" },
      },
    ]);

    expect(result.summary.pipelines).toBe(2);
    expect(result.summary.rawAssets).toBeGreaterThan(0);
    expect(result.assets.length).toBeGreaterThan(result.summary.pipelines);
  });
});

describe("post-replication dbt", () => {
  it("derives transforms for database replication with dbt config", () => {
    const bundle = derivePipelineAssets({
      id: "p3",
      name: "pg_dbt",
      tool: "sling",
      enabled: true,
      sourceType: "postgres",
      destinationType: "snowflake",
      updatedAt: "2026-06-17T00:00:00.000Z",
      sourceConfiguration: {
        tables: "users",
        dbt: { enabled: true, package_path: "./dbt" },
      },
    });
    expect(bundle.transforms).toHaveLength(1);
    expect(bundle.transforms[0]?.transformScope).toBe("post_replication");
  });
});
