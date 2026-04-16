import { describe, expect, it } from "vitest";
import {
  dltDbtRunnerBeforeReturn,
  partitionColumnForDbtVars,
  sanitizeDbtVarKey,
} from "./generate-dlt-dbt-append";
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

describe("sanitizeDbtVarKey", () => {
  it("falls back on invalid keys", () => {
    expect(sanitizeDbtVarKey("", "x")).toBe("x");
    expect(sanitizeDbtVarKey("123bad", "x")).toBe("x");
    expect(sanitizeDbtVarKey("a-b", "x")).toBe("x");
  });

  it("accepts dbt-style identifiers", () => {
    expect(sanitizeDbtVarKey("run_date", "x")).toBe("run_date");
    expect(sanitizeDbtVarKey("ds", "x")).toBe("ds");
  });
});

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

  it("uses slice_value_var and slice_column_var as dbt var keys when set", () => {
    const py = dltDbtRunnerBeforeReturn(
      baseRequest({
        sourceConfiguration: {
          dlt_dbt: {
            enabled: true,
            package_path: "./dbt",
            slice_value_var: "run_date",
            slice_column_var: "partition_col",
          },
          _partitionConfig: { type: "date", column: "event_dt" },
        },
      })
    );
    expect(py).toContain('_elt_dbt_vars["run_date"]');
    expect(py).not.toContain('_elt_dbt_vars["elt_partition_value"]');
    expect(py).toContain('_elt_dbt_vars["partition_col"]');
    expect(py).toContain('"event_dt"');
  });

  it("resolves duplicate slice var keys by falling back column var name", () => {
    const py = dltDbtRunnerBeforeReturn(
      baseRequest({
        sourceConfiguration: {
          dlt_dbt: {
            enabled: true,
            package_path: "./dbt",
            slice_value_var: "ds",
            slice_column_var: "ds",
          },
          _partitionConfig: { type: "date", column: "event_date" },
        },
      })
    );
    expect(py).toContain('_elt_dbt_vars["ds"]');
    expect(py).toContain('_elt_dbt_vars["elt_partition_column"]');
  });
});
