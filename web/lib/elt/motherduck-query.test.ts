import { describe, expect, it } from "vitest";
import { parseMotherduckSqlResponse } from "@/lib/elt/warehouse-introspect-connectors";

describe("parseMotherduckSqlResponse", () => {
  it("maps columns and rows from MotherDuck SQL API shape", () => {
    const parsed = parseMotherduckSqlResponse({
      columns: [{ name: "id" }, { name: "name" }],
      rows: [
        [1, "alpha"],
        [2, "beta"],
      ],
    });
    expect(parsed.columns).toEqual(["id", "name"]);
    expect(parsed.rows).toHaveLength(2);
  });

  it("falls back to col_N when column metadata is missing", () => {
    const parsed = parseMotherduckSqlResponse({
      data: [[10, 20]],
    });
    expect(parsed.columns).toEqual(["col_0", "col_1"]);
    expect(parsed.rows[0]).toEqual([10, 20]);
  });
});
