import { describe, expect, it } from "vitest";
import { formatMotherduckColumnError } from "./warehouse-column-introspect";

describe("formatMotherduckColumnError", () => {
  it("suggests my_db when MotherDuck returns Not Found", () => {
    const msg = formatMotherduckColumnError("github_dlt_hub_dlt", "issues", "eltpulse", "Not Found");
    expect(msg).toContain("github_dlt_hub_dlt.issues");
    expect(msg).toContain("my_db");
    expect(msg).not.toBe("Not Found");
  });

  it("passes through non-not-found errors", () => {
    expect(formatMotherduckColumnError("s", "t", "db", "Invalid token")).toBe("Invalid token");
  });
});
