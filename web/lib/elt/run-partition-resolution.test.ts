import { describe, expect, it } from "vitest";
import {
  monitorPartitionColumnFromConfig,
  parsePartitionValuesFromMonitorConfig,
  partitionColumnFromSourceConfiguration,
  resolveRunPartitionFields,
  RunPartitionResolutionError,
} from "./run-partition-resolution";

describe("partitionColumnFromSourceConfiguration", () => {
  it("reads date partition column", () => {
    expect(
      partitionColumnFromSourceConfiguration({ _partitionConfig: { type: "date", column: "ds" } })
    ).toBe("ds");
  });

  it("returns null for type none", () => {
    expect(
      partitionColumnFromSourceConfiguration({ _partitionConfig: { type: "none", column: "x" } })
    ).toBeNull();
  });
});

describe("resolveRunPartitionFields", () => {
  it("fills column from pipeline when only value is passed", () => {
    const r = resolveRunPartitionFields(
      { partitionValue: "2024-06-01", triggeredBy: null },
      { _partitionConfig: { type: "date", column: "event_date" } }
    );
    expect(r).toEqual({
      partitionColumn: "event_date",
      partitionValue: "2024-06-01",
      triggeredBy: "backfill:partition:event_date:2024-06-01",
    });
  });

  it("preserves explicit triggeredBy when set", () => {
    const r = resolveRunPartitionFields(
      { partitionValue: "2024-06-01", partitionColumn: "d", triggeredBy: "monitor:x" },
      {}
    );
    expect(r.triggeredBy).toBe("monitor:x");
    expect(r.partitionValue).toBe("2024-06-01");
    expect(r.partitionColumn).toBe("d");
  });

  it("throws when value without resolvable column", () => {
    expect(() =>
      resolveRunPartitionFields({ partitionValue: "x", triggeredBy: null }, {})
    ).toThrow(RunPartitionResolutionError);
  });
});

describe("parsePartitionValuesFromMonitorConfig", () => {
  it("parses arrays and newline text", () => {
    expect(parsePartitionValuesFromMonitorConfig({ partition_values: ["a", " b "] })).toEqual(["a", "b"]);
    expect(parsePartitionValuesFromMonitorConfig({ partition_values: "x,y\nz" })).toEqual(["x", "y", "z"]);
  });
});

describe("monitorPartitionColumnFromConfig", () => {
  it("prefers config over pipeline", () => {
    expect(
      monitorPartitionColumnFromConfig(
        { partition_column: "c1" },
        { _partitionConfig: { type: "date", column: "c2" } }
      )
    ).toBe("c1");
  });

  it("falls back to pipeline", () => {
    expect(
      monitorPartitionColumnFromConfig({}, { _partitionConfig: { type: "date", column: "c2" } })
    ).toBe("c2");
  });
});
