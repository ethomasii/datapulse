import { describe, expect, it } from "vitest";
import { canvasStarterHref, defaultSourceTable, medallionHintsForStarter } from "@/lib/elt/lake-defaults";

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

  it("builds canvas deep link with starter and source table", () => {
    const href = canvasStarterHref({
      pipelineId: "pipe-1",
      starterId: "entity_360_profile",
      pipelineName: "Zendesk Tickets",
    });
    expect(href).toContain("/builder/canvas?");
    expect(href).toContain("pipeline=pipe-1");
    expect(href).toContain("starter=entity_360_profile");
    expect(href).toContain("source_table=staging.events");
  });

  it("uses pipeline name for source table when no fallback", () => {
    expect(
      canvasStarterHref({
        pipelineId: "pipe-2",
        sourceTable: defaultSourceTable({ pipelineName: "Zendesk Tickets" }),
      })
    ).toContain("source_table=staging.zendesk_tickets");
  });
});
