import { describe, expect, it } from "vitest";
import { resolveCompilerTier } from "@/lib/elt/component-compiler-tier";
import { routeComponent } from "@/lib/elt/component-compile-router";
import { listComponents } from "@/lib/elt/component-registry";

describe("component-compiler-tier", () => {
  it("classifies native hl7 as executable", () => {
    expect(resolveCompilerTier("hl7_v2_parser", routeComponent("hl7_v2_parser", "transformation"))).toBe(
      "native"
    );
  });

  it("classifies generic transforms as category not native", () => {
    expect(resolveCompilerTier("acord_xml_parser", routeComponent("acord_xml_parser", "transformation"))).toBe(
      "category"
    );
    expect(resolveCompilerTier("hash", routeComponent("hash", "transformation"))).toBe("native");
  });

  it("classifies infrastructure as schema", () => {
    expect(resolveCompilerTier("terraform_asset", routeComponent("terraform_asset", "infrastructure"))).toBe(
      "schema"
    );
  });

  it("executableOnly filter returns only native catalog ids", () => {
    const { total, items } = listComponents({ executableOnly: true, limit: 200 });
    expect(total).toBeGreaterThan(65);
    expect(total).toBeLessThan(120);
    expect(items.every((c) => c.isExecutable)).toBe(true);
    expect(items.some((c) => c.id === "hl7_v2_parser")).toBe(true);
    expect(items.some((c) => c.id === "acord_xml_parser")).toBe(false);
  });
});
