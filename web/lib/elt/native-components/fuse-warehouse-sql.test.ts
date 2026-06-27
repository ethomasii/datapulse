import { describe, expect, it } from "vitest";
import {
  extractPrimaryInputTable,
  flushFusedSqlSegment,
  fuseCtasChain,
  normalizeTableRef,
  parseCtasStatement,
} from "./fuse-warehouse-sql";
import { sqlCreateTableAs, sqlQualifiedTable } from "./definitions/_sql-helpers";

describe("parseCtasStatement", () => {
  it("parses CREATE OR REPLACE TABLE … AS", () => {
    const sql = sqlCreateTableAs("staging.filtered", "SELECT *\nFROM staging.raw\nWHERE id > 0");
    const parsed = parseCtasStatement(sql);
    expect(parsed?.outputTable).toBe("staging.filtered");
    expect(parsed?.selectSql).toContain("staging.raw");
  });
});

describe("fuseCtasChain", () => {
  it("fuses two linear filters into one CTAS", () => {
    const s1 = sqlCreateTableAs(
      "staging.step1",
      `SELECT *\nFROM ${sqlQualifiedTable("staging.raw")}\nWHERE active = true`
    );
    const s2 = sqlCreateTableAs(
      "staging.step2",
      `SELECT *\nFROM ${sqlQualifiedTable("staging.step1")}\nWHERE amount > 100`
    );
    const fused = fuseCtasChain([s1, s2]);
    expect(fused).toBeTruthy();
    expect(fused).toContain("CREATE OR REPLACE TABLE");
    expect(fused).toContain('"staging"."step2"');
    expect(fused).not.toContain("CREATE OR REPLACE TABLE \"staging\".\"step1\"");
    expect(fused).toContain("amount > 100");
    expect(fused).toContain("active = true");
  });

  it("fuses filter → select columns", () => {
    const s1 = sqlCreateTableAs(
      "staging.f",
      `SELECT *\nFROM ${sqlQualifiedTable("staging.raw")}\nWHERE x = 1`
    );
    const s2 = sqlCreateTableAs(
      "staging.out",
      `SELECT "id", "name"\nFROM ${sqlQualifiedTable("staging.f")}`
    );
    const fused = fuseCtasChain([s1, s2]);
    expect(fused).toContain('"id"');
    expect(fused).toContain("x = 1");
  });

  it("returns null when chain breaks", () => {
    const s1 = sqlCreateTableAs("staging.a", `SELECT 1`);
    const s2 = sqlCreateTableAs("staging.b", `SELECT 2`);
    expect(fuseCtasChain([s1, s2])).toBeNull();
  });
});

describe("flushFusedSqlSegment", () => {
  it("reports fused step count", () => {
    const s1 = sqlCreateTableAs(
      "staging.a",
      `SELECT *\nFROM ${sqlQualifiedTable("staging.raw")}`
    );
    const s2 = sqlCreateTableAs(
      "staging.b",
      `SELECT *\nFROM ${sqlQualifiedTable("staging.a")}`
    );
    const out = flushFusedSqlSegment([s1, s2]);
    expect(out.statements).toHaveLength(1);
    expect(out.fusedCount).toBe(2);
  });
});

describe("extractPrimaryInputTable", () => {
  it("reads first FROM table", () => {
    expect(
      extractPrimaryInputTable(`SELECT *\nFROM ${sqlQualifiedTable("staging.events")}\nWHERE 1=1`)
    ).toBe(normalizeTableRef("staging.events"));
  });
});
