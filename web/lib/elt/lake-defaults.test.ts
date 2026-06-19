import { describe, expect, it } from "vitest";
import { defaultSourceTable, medallionHintsForStarter } from "@/lib/elt/lake-defaults";

describe("lake-defaults", () => {
  it("derives staging table from pipeline name", () => {
    expect(defaultSourceTable({ pipelineName: "GitHub Issues" })).toBe("staging.github_issues");
  });

  it("respects schema override", () => {
    expect(defaultSourceTable({ pipelineName: "orders", schemaOverride: "raw" })).toBe("raw.orders");
  });

  it("returns medallion hints for medallion starter", () => {
    expect(medallionHintsForStarter("single_lake_medallion")).toEqual({
      landing: "bronze",
      transform: "gold",
    });
    expect(medallionHintsForStarter("single_source_to_mart")).toBeUndefined();
  });
});
