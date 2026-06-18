import { describe, expect, it } from "vitest";
import { compileDeclarativePipelineSpec } from "@/lib/elt/compile-declarative-pipeline";
import type { DeclarativePipelineSpec } from "@/lib/elt/declarative-pipeline-spec";
import type { WorkspaceDefaultsContext } from "@/lib/elt/workspace-default-destination";
import { parseAndCompileDeclarativeYaml } from "@/lib/elt/parse-pipeline-declaration";

const MOCK_DEFAULTS: WorkspaceDefaultsContext = {
  defaultDestinationConnectionId: "dest-conn-1",
  defaultDestinationConnector: "snowflake",
  defaultDestinationName: "prod_snowflake",
};

describe("compile-declarative-pipeline", () => {
  it("compiles @workspace destination to default connector + connection id", async () => {
    const spec: DeclarativePipelineSpec = {
      name: "stripe_to_lake",
      source: "stripe",
      destination: "@workspace",
      tool: "auto",
      tables: ["customers", "charges"],
      sync: { mode: "incremental", cursor: "created" },
      medallion: { landing: "bronze", transform: "gold" },
    };

    const result = await compileDeclarativePipelineSpec("user-1", spec, MOCK_DEFAULTS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.body.destinationType).toBe("snowflake");
    expect(result.body.destinationConnectionId).toBe("dest-conn-1");
    expect(result.body.sourceType).toBe("stripe");
    expect(result.body.sliceIntent).toBeUndefined();

    const cfg = result.body.sourceConfiguration as Record<string, unknown>;
    expect(cfg.elt_medallion).toEqual({ landing: "bronze", transform: "gold" });
    expect(cfg.incremental_field).toBe("created");
  });

  it("compiles explicit warehouse destination without connection", async () => {
    const spec: DeclarativePipelineSpec = {
      name: "github_to_postgres",
      source: "github",
      destination: "postgres",
      tool: "dlt",
      tables: ["issues", "pull_requests"],
    };

    const result = await compileDeclarativePipelineSpec("user-1", spec, MOCK_DEFAULTS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.body.destinationType).toBe("postgres");
    expect(result.body.destinationConnectionId).toBeNull();
    const cfg = result.body.sourceConfiguration as Record<string, unknown>;
    expect(cfg.resources).toEqual(["issues", "pull_requests"]);
  });

  it("maps dbt transform block to dlt_dbt config", async () => {
    const spec: DeclarativePipelineSpec = {
      name: "with_dbt",
      source: "stripe",
      destination: "duckdb",
      transform: {
        dbt: {
          enabled: true,
          package_path: "./dbt/analytics",
          select: "tag:core",
        },
      },
    };

    const result = await compileDeclarativePipelineSpec("user-1", spec, {
      defaultDestinationConnectionId: null,
      defaultDestinationConnector: null,
      defaultDestinationName: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const cfg = result.body.sourceConfiguration as Record<string, unknown>;
    expect(cfg.dlt_dbt).toMatchObject({
      enabled: true,
      package_path: "./dbt/analytics",
      run_scope: "selection",
      selector: "tag:core",
    });
  });

  it("parses v2 YAML end-to-end", async () => {
    const yaml = `
eltpulse_pipeline: 2
upsert: true
name: test_pipeline
source: stripe
destination: duckdb
tables: [customers]
sync:
  mode: incremental
  cursor: created
`;
    const parsed = await parseAndCompileDeclarativeYaml("user-1", yaml);
    expect(parsed.specVersion).toBe(2);
    expect(parsed.body.name).toBe("test_pipeline");
    expect(parsed.body.destinationType).toBe("duckdb");
    expect(parsed.declarativeSpecYaml).toContain("eltpulse_pipeline: 2");
  });
});
