import { describe, expect, it } from "vitest";
import { compileGenericCatalogComponent, canCompileGenerically } from "@/lib/elt/generic-catalog-compiler";
import { routeComponent } from "@/lib/elt/component-compile-router";

describe("generic-catalog-compiler", () => {
  it("compiles quality checks generically", () => {
    const out = compileGenericCatalogComponent("custom_check", "check", {
      table: "staging.orders",
      not_null: ["id"],
    });
    expect(out.tests?.length).toBeGreaterThan(0);
    expect(out.quality?.[0]?.table).toBe("staging.orders");
  });

  it("compiles transforms with table copy", () => {
    const out = compileGenericCatalogComponent("my_transform", "transformation", {
      table: "raw.events",
      output_table: "staging.events",
    });
    expect(out.python?.length).toBeGreaterThan(0);
  });

  it("allows generic compile for most categories", () => {
    expect(canCompileGenerically(routeComponent("foo", "transformation"))).toBe(true);
    expect(canCompileGenerically(routeComponent("ext", "external"))).toBe(false);
  });
});
