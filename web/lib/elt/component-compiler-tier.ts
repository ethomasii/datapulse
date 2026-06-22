/**
 * Honest executability tiers for the 800+ dagster-component-templates catalog.
 *
 * - native / package: faithful compilers (grow via eltpulse-pipeline-components)
 * - category: category-level fallback (ingest hints, table copy, basic checks) — not template logic
 * - schema: form + discovery only (infrastructure, integration, external, resource)
 */
import type { ComponentRoute } from "@/lib/elt/component-compile-router";
import { canCompileGenerically } from "@/lib/elt/generic-catalog-compiler";
import { isNativeComponent } from "@/lib/elt/native-components/registry";

export type ComponentCompilerTier = "native" | "category" | "schema" | "none";

const CATEGORY_TIER_TARGETS = new Set(["python", "dlt", "sling", "quality", "monitor", "dbt"]);

export function resolveCompilerTier(
  componentId: string,
  route: ComponentRoute
): ComponentCompilerTier {
  if (isNativeComponent(componentId)) return "native";
  if (!canCompileGenerically(route)) return "none";
  if (CATEGORY_TIER_TARGETS.has(route.target)) return "category";
  return "schema";
}

/** True when pipeline save/run uses a faithful native or published package compiler. */
export function isFaithfulCompiler(tier: ComponentCompilerTier, isPackage = false): boolean {
  return tier === "native" || isPackage;
}

export function compilerTierLabel(tier: ComponentCompilerTier): string {
  switch (tier) {
    case "native":
      return "Native";
    case "category":
      return "Category";
    case "schema":
      return "Schema";
    default:
      return "Unsupported";
  }
}

export function compilerTierHint(tier: ComponentCompilerTier): string {
  switch (tier) {
    case "native":
      return "Executable compiler — runs the real transform/ingest/check logic.";
    case "category":
      return "Category fallback only — wires ingest/quality/monitor or copies a table; not this template's full logic.";
    case "schema":
      return "Schema template — use for discovery and forms; needs a native compiler or custom Python for real behavior.";
    default:
      return "Not executable in eltPulse — use Connections, catalog assets, or a native component.";
  }
}
