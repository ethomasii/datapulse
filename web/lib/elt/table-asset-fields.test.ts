import { describe, expect, it } from "vitest";
import { isTableAssetField, tableRefFromAsset } from "@/lib/elt/table-asset-fields";

describe("table-asset-fields", () => {
  it("detects table field keys", () => {
    expect(isTableAssetField("table")).toBe(true);
    expect(isTableAssetField("left_table")).toBe(true);
    expect(isTableAssetField("prefix")).toBe(false);
  });

  it("prefers landingQualified ref", () => {
    expect(
      tableRefFromAsset({
        landingQualified: "analytics.orders",
        landingDataset: "raw",
        name: "orders",
        displayName: "Orders",
      })
    ).toBe("analytics.orders");
  });
});
