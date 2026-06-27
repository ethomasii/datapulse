import { describe, expect, it } from "vitest";
import {
  filterPreviewRows,
  histogramBinHeights,
  profileChartKind,
  sortPreviewRows,
  topValueShares,
} from "./preview-row-utils";

describe("filterPreviewRows", () => {
  it("matches any column", () => {
    const rows = [{ a: "hello", b: 1 }, { a: "world", b: 2 }];
    expect(filterPreviewRows(rows, "world")).toHaveLength(1);
  });
});

describe("sortPreviewRows", () => {
  it("sorts numerically when possible", () => {
    const rows = [{ n: "10" }, { n: "2" }];
    expect(sortPreviewRows(rows, "n", "asc").map((r) => r.n)).toEqual(["2", "10"]);
  });
});

describe("histogramBinHeights", () => {
  it("returns normalized bins", () => {
    const bins = histogramBinHeights([1, 2, 3, 100], 4);
    expect(bins).toHaveLength(4);
    expect(Math.max(...bins)).toBe(1);
  });
});

describe("topValueShares", () => {
  it("ranks dominant values", () => {
    expect(topValueShares(["a", "a", "b"], 2)[0]).toEqual({ value: "a", share: 2 / 3 });
  });
});

describe("profileChartKind", () => {
  it("detects boolean columns", () => {
    expect(profileChartKind("boolean", [true, false, true])).toBe("boolean");
  });

  it("detects numeric columns", () => {
    expect(profileChartKind("integer", [1, 2, 3])).toBe("numeric");
  });
});
