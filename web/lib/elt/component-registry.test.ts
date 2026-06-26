import { describe, expect, it } from "vitest";
import { getComponentById, listComponents, listComponentCategories } from "@/lib/elt/component-registry";
import { routeComponent } from "@/lib/elt/component-compile-router";
import { companionIngestionForSensor } from "@/lib/elt/component-sensor-pairs";
import {
  canvasPortsForCategory,
  isTerminalComponentCategory,
  isValidComponentEdge,
} from "@/lib/elt/component-canvas-io";

describe("component-registry", () => {
  it("loads manifest index", () => {
    expect(listComponentCategories().length).toBeGreaterThan(5);
    const { total } = listComponents({ limit: 1 });
    expect(total).toBeGreaterThan(100);
  });

  it("finds s3 ingest component", () => {
    const c = getComponentById("s3_to_database_asset");
    expect(c?.compileTarget).toBe("dlt");
    expect(c?.isExecutable).toBe(true);
  });

  it("routes quality checks", () => {
    expect(routeComponent("great_expectations_check", "check").target).toBe("quality");
  });

  it("sensor pair mapping", () => {
    const pair = companionIngestionForSensor("s3_monitor");
    expect(pair?.ingestionId).toBe("s3_to_database_asset");
  });

  it("canvas ports for transformation", () => {
    const p = canvasPortsForCategory("transformation");
    expect(p.left).toBe(true);
    expect(p.right).toBe(true);
  });

  it("canvas ports for validate checks are terminal", () => {
    const p = canvasPortsForCategory("check");
    expect(p.left).toBe(true);
    expect(p.right).toBe(false);
    expect(isTerminalComponentCategory("check")).toBe(true);
    expect(isValidComponentEdge("check", "transformation")).toBe(false);
    expect(isValidComponentEdge("transformation", "check")).toBe(true);
  });

  it("finds alter_row when user searches alter rows", () => {
    const { items, total } = listComponents({ q: "alter rows", limit: 10 });
    expect(total).toBeGreaterThan(0);
    expect(items.some((c) => c.id === "alter_row")).toBe(true);
  });

  it("excludes freshness_check (Freshness Policy) from catalog", () => {
    expect(getComponentById("freshness_check")).toBeNull();
    const { items } = listComponents({ q: "freshness policy", limit: 20 });
    expect(items.some((c) => c.id === "freshness_check")).toBe(false);
  });
});
