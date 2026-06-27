import { describe, expect, it } from "vitest";
import { formatMotherduckColumnError } from "./warehouse-column-errors";

describe("formatMotherduckColumnError", () => {
  it("suggests my_db when no columns and no specific error", () => {
    const msg = formatMotherduckColumnError("github_dlt_hub_dlt", "issues", "eltpulse");
    expect(msg).toContain("github_dlt_hub_dlt.issues");
    expect(msg).toContain("my_db");
    expect(msg).toContain("eltpulse");
  });

  it("passes through HTTP 404 attach errors", () => {
    const err = 'MotherDuck database "eltpulse" was not found (HTTP 404).';
    expect(formatMotherduckColumnError("s", "t", "db", err)).toBe(err);
  });

  it("passes through non-not-found errors", () => {
    expect(formatMotherduckColumnError("s", "t", "db", "Invalid token")).toBe("Invalid token");
  });
});
