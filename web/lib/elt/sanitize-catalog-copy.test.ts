import { describe, expect, it } from "vitest";
import { sanitizeCatalogDescription } from "@/lib/elt/sanitize-catalog-copy";

describe("sanitizeCatalogDescription", () => {
  it("replaces Dagster vendor names with neutral terms", () => {
    expect(sanitizeCatalogDescription("Sync via dagster-airbyte from Dagster")).toBe(
      "Sync via connector sync from pipeline"
    );
    expect(sanitizeCatalogDescription("dagster-airflow bridge for dagster-airlift")).toBe(
      "workflow bridge bridge for orchestration bridge"
    );
  });

  it("collapses extra whitespace", () => {
    expect(sanitizeCatalogDescription("  Dagster   asset  ")).toBe("pipeline asset");
  });
});
