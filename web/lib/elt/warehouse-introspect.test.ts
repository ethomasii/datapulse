import { describe, expect, it } from "vitest";
import {
  isTablePresentInWarehouse,
  normalizeQualifiedTable,
  parseLandingQualified,
  tableSetFromIntrospection,
} from "@/lib/elt/warehouse-introspect";

describe("warehouse-introspect", () => {
  it("normalizes qualified table names", () => {
    expect(normalizeQualifiedTable("Public", "Customers")).toBe("public.customers");
  });

  it("parses schema.table landing targets", () => {
    expect(parseLandingQualified("stripe_data.customers")).toEqual({
      full: "stripe_data.customers",
      table: "customers",
    });
  });

  it("parses bare table names", () => {
    expect(parseLandingQualified("customers")).toEqual({
      full: null,
      table: "customers",
    });
  });

  it("matches full or bare table in warehouse set", () => {
    const set = tableSetFromIntrospection([
      { schema: "stripe_data", table: "customers", qualified: "stripe_data.customers" },
    ]);
    expect(isTablePresentInWarehouse("stripe_data.customers", set)).toBe(true);
    expect(isTablePresentInWarehouse("customers", set)).toBe(true);
    expect(isTablePresentInWarehouse("missing.table", set)).toBe(false);
  });
});
