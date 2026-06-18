import { describe, it, expect } from "vitest";
import { runCompileInSandbox } from "./run-compile-sandbox";
import { parseCatalogSource, resolveCatalogSources } from "./catalog-sources";

describe("component-packages", () => {
  it("parseCatalogSource accepts owner/repo slug", () => {
    const src = parseCatalogSource("ethomasii/eltpulse-pipeline-components");
    expect(src?.id).toBe("ethomasii/eltpulse-pipeline-components");
    expect(src?.rawBase).toContain("raw.githubusercontent.com");
  });

  it("resolveCatalogSources merges pipeline URLs with defaults", () => {
    const sources = resolveCatalogSources({
      component_catalog_urls: ["acme/custom-components"],
    });
    expect(sources.some((s) => s.id === "acme/custom-components")).toBe(true);
    expect(sources.some((s) => s.id.includes("eltpulse-pipeline-components"))).toBe(true);
  });

  it("runCompileInSandbox executes export function compile", () => {
    const source = `
export function compile(config) {
  return { python: ["# hello " + config.table] };
}
`;
    const out = runCompileInSandbox(source, { table: "staging.orders" });
    expect(out.python?.[0]).toContain("staging.orders");
  });

  it("runCompileInSandbox executes bundled package compile.mjs", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(process.cwd(), "../packages/pipeline-components/components/join_tables/compile.mjs"),
      "utf8"
    );
    const out = runCompileInSandbox(source, {
      left_table: "staging.a",
      right_table: "staging.b",
      on: "id",
      output_table: "staging.joined",
    });
    expect(out.python?.length).toBeGreaterThan(0);
    expect(out.python?.some((l) => l.includes("staging.joined"))).toBe(true);
  });

  it("runCompileInSandbox supports monitor configPatch", () => {
    const source = `
export function compile(config) {
  return {
    configPatch: {
      elt_canvas_sensors: [{ monitor_type: "s3_file_count", config: { bucket_name: config.bucket_name } }],
    },
  };
}
`;
    const out = runCompileInSandbox(source, { bucket_name: "b" });
    const patch = out.configPatch as { elt_canvas_sensors: unknown[] };
    expect(patch.elt_canvas_sensors.length).toBe(1);
  });
});
