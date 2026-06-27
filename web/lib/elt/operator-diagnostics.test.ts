import { describe, expect, it } from "vitest";
import { buildOperatorDiagnostic } from "./operator-diagnostics";

describe("buildOperatorDiagnostic", () => {
  it("adds MotherDuck hint for Not Found", () => {
    const d = buildOperatorDiagnostic("columns", {
      source: "columns",
      severity: "error",
      message: "Not Found",
    });
    expect(d.hint).toContain("my_db");
  });

  it("adds destination hint when connection missing", () => {
    const d = buildOperatorDiagnostic("input_preview", {
      source: "input_preview",
      severity: "error",
      message: "Link a destination connection to preview warehouse data.",
    });
    expect(d.hint).toContain("destination connection");
  });
});
