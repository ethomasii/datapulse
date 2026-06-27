import { describe, expect, it } from "vitest";
import {
  computeColumnProfilesFromSample,
  enrichProfilesFromSampleRows,
  parseSummarizeRowset,
  profileKindForType,
  type ColumnProfile,
} from "./warehouse-column-profile";

describe("parseSummarizeRowset", () => {
  it("parses numeric and varchar summarize rows", () => {
    const profiles = parseSummarizeRowset({
      columns: [
        "column_name",
        "column_type",
        "min",
        "max",
        "approx_unique",
        "avg",
        "q25",
        "q50",
        "q75",
        "null_percentage",
      ],
      rows: [
        ["amount", "DOUBLE", 1, 100, 80, 50, 25, 50, 75, 0],
        ["status", "VARCHAR", "a", "z", 3, null, null, null, null, 5],
      ],
    });
    expect(profiles.amount).toMatchObject({
      name: "amount",
      kind: "numeric",
      min: 1,
      max: 100,
      q50: 50,
      nullPct: 0,
    });
    expect(profiles.status).toMatchObject({
      name: "status",
      kind: "other",
      approxUnique: 3,
      nullPct: 5,
    });
  });
});

describe("enrichProfilesFromSampleRows", () => {
  it("adds top value share for categorical columns", () => {
    const profiles: Record<string, ColumnProfile> = {
      state: { name: "state", type: "VARCHAR", kind: "other", nullPct: 0, approxUnique: 2 },
    };
    const enriched = enrichProfilesFromSampleRows(
      profiles,
      ["state"],
      [{ state: "open" }, { state: "open" }, { state: "closed" }]
    );
    expect(enriched.state.topValue).toBe("open");
    expect(enriched.state.topValueShare).toBeCloseTo(2 / 3);
  });
});

describe("profileKindForType", () => {
  it("recognizes warehouse numeric type names", () => {
    expect(profileKindForType("int4", [])).toBe("numeric");
    expect(profileKindForType("float8", [])).toBe("numeric");
    expect(profileKindForType("NUMBER(38,0)", [])).toBe("numeric");
    expect(profileKindForType("varchar", [])).toBe("other");
  });
});

describe("computeColumnProfilesFromSample", () => {
  it("computes numeric quartiles and categorical top values from sample rows", () => {
    const profiles = computeColumnProfilesFromSample(
      [
        { name: "amount", type: "double precision" },
        { name: "status", type: "text" },
      ],
      [
        { amount: 10, status: "open" },
        { amount: 20, status: "open" },
        { amount: 30, status: "closed" },
        { amount: null, status: null },
      ]
    );
    expect(profiles.amount).toMatchObject({
      kind: "numeric",
      min: 10,
      max: 30,
      q50: 20,
      nullPct: 25,
    });
    expect(profiles.status).toMatchObject({
      kind: "other",
      topValue: "open",
      topValueShare: 0.5,
      nullPct: 25,
    });
  });
});
