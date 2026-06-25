import { describe, expect, it } from "vitest";
import {
  assetColumnsToContractSchema,
  mergeContractSchemaSpecs,
  slugifyContract,
  suggestContractIdentity,
} from "@/lib/elt/contract-from-asset";

describe("assetColumnsToContractSchema", () => {
  it("maps asset columns to required contract spec by default", () => {
    const spec = assetColumnsToContractSchema([
      { name: "id", type: "integer", description: "Primary key" },
      { name: "email", type: "varchar" },
    ]);
    expect(spec).toEqual([
      { name: "email", type: "varchar", required: true },
      { name: "id", type: "integer", description: "Primary key", required: true },
    ]);
  });

  it("deduplicates columns case-insensitively", () => {
    const spec = assetColumnsToContractSchema([
      { name: "ID", type: "int" },
      { name: "id", type: "bigint" },
    ]);
    expect(spec).toHaveLength(1);
    expect(spec[0]?.name).toBe("ID");
  });
});

describe("mergeContractSchemaSpecs", () => {
  it("unions columns and merges metadata", () => {
    const merged = mergeContractSchemaSpecs(
      [{ name: "a", type: "int", required: true }],
      [{ name: "b", required: true }, { name: "a", description: "col a" }]
    );
    expect(merged).toEqual([
      { name: "a", type: "int", description: "col a", required: true },
      { name: "b", required: true },
    ]);
  });
});

describe("suggestContractIdentity", () => {
  it("builds name and slug from display name", () => {
    const id = suggestContractIdentity({
      displayName: "Orders Raw",
      assetKey: "table:abc:orders",
      pipelineName: "Shopify",
    });
    expect(id.name).toBe("Orders Raw contract");
    expect(id.slug).toBe("orders-raw-shopify");
  });
});

describe("slugifyContract", () => {
  it("normalizes to kebab-case", () => {
    expect(slugifyContract("My Table!")).toBe("my-table");
  });
});
