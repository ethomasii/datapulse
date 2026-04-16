import { describe, expect, it } from "vitest";
import { dltDbtRunnerBeforeReturn, partitionColumnForDbtVars } from "./generate-dlt-dbt-append";
import type { PipelineRequest } from "./types";

function baseRequest(overrides: Partial<PipelineRequest> = {}): PipelineRequest {
  return {
    name: "my_pipe",
    sourceType: "github",
    destinationType: "snowflake",
    sourceConfiguration: {},
    ...overrides,
  };
}

describe("partitionColumnForDbtVars", () => {
  it("returns null when no partition config", () => {
    expect(partitionColumnForDbtVars(baseRequest())).toBeNull();
  });

  it("returns column for date type", () => {
    const r = baseRequest({
      sourceConfiguration: { _partitionConfig: { type: "date", column: "event_date" } },
    });
    expect(partitionColumnForDbtVars(r)).toBe("event_date");
  });

  it("returns null for type none", () => {
    const r = baseRequest({
      sourceConfiguration: { _partitionConfig: { type: "none", column: "x" } },
    });
    expect(partitionColumnForDbtVars(r)).toBeNull();
  });
});

describe("dltDbtRunnerBeforeReturn", () => {
  it("returns empty when dbt disabled", () => {
    expect(dltDbtRunnerBeforeReturn(baseRequest())).toBe("");
  });

  it("emits run_all with additional_vars and elt_partition_column when configured", () => {
    const py = dltDbtRunnerBeforeReturn(
      baseRequest({
        sourceConfiguration: {
          dlt_dbt: { enabled: true, package_path: "./dbt" },
          _partitionConfig: { type: "date", column: "ds" },
        },
      })
    );
    expect(py).toContain("_elt_dbt_vars");
    expect(py).toContain('"elt_partition_column"');
    expect(py).toContain('"ds"');
    expect(py).toContain('"elt_partition_value"');
    expect(py).toContain("partition_key");
    expect(py).toContain("additional_vars=");
    expect(py).toContain('_dbt_run_params = ("--fail-fast",)');
  });

  it("includes --select when selection scope is set", () => {
    const py = dltDbtRunnerBeforeReturn(
      baseRequest({
        sourceConfiguration: {
          dlt_dbt: {
            enabled: true,
            package_path: "./dbt",
            run_scope: "selection",
            selector: "tag:nightly",
          },
        },
      })
    );
    expect(py).toContain('"--select"');
    expect(py).toContain('"tag:nightly"');
  });
});
