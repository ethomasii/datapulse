/**
 * Read-only registry of dagster-component-templates (manifest index bundled at build time).
 * Full manifest + remote schema.json fetched on demand for detail views.
 */

import manifestIndex from "@/lib/elt/data/component-manifest-index.json";
import { canvasPortsForCategory, normalizeComponentCategory } from "@/lib/elt/component-canvas-io";
import { routeComponent, suggestMonitorPipelinePair, TOP_COMPONENT_ROUTES, type ComponentCompileTarget, type ComponentRoute } from "@/lib/elt/component-compile-router";
import { canCompileGenerically } from "@/lib/elt/generic-catalog-compiler";
import {
  compilerTierHint,
  isFaithfulCompiler,
  resolveCompilerTier,
  type ComponentCompilerTier,
} from "@/lib/elt/component-compiler-tier";
import { compileTargetLabel } from "@/lib/elt/compile-target-labels";
import { sanitizeCatalogDescription } from "@/lib/elt/sanitize-catalog-copy";
import { isNativeComponent } from "@/lib/elt/native-components/registry";

export type ComponentManifestEntry = {
  id: string;
  name: string;
  category: string;
  description: string;
  tags?: string[];
  path?: string;
  icon?: string;
  schema_url?: string;
  example_url?: string;
};

export type ComponentListItem = ComponentManifestEntry & {
  compileTarget: ComponentCompileTarget;
  compileBadge?: ComponentRoute["badge"];
  compileHint: string;
  canvasPorts: { left: boolean; right: boolean };
  monitorPair?: ReturnType<typeof suggestMonitorPipelinePair>;
  /** Has an eltPulse native compiler (executable on worker). */
  isNative?: boolean;
  /** Compiles via native, package, or generic category compiler. */
  hasCompiler?: boolean;
  /** Honest executability tier (see component-compiler-tier.ts). */
  compilerTier?: ComponentCompilerTier;
  /** Native or published package — faithful template behavior. */
  isExecutable?: boolean;
  compilerTierHint?: string;
  /** User-facing compile target label (no vendor names). */
  compileTargetLabel?: string;
};

type ManifestIndex = {
  version: string;
  repository: string;
  last_updated?: string;
  components: ComponentManifestEntry[];
};

const index = manifestIndex as ManifestIndex;

/** Extra search phrases → component id (helps Genie match natural language). */
const COMPONENT_SEARCH_ALIASES: Record<string, string[]> = {
  alter_row: ["alter row", "alter rows", "alterrow", "cdc marker", "change type", "adf alter row"],
};

function searchQueryVariants(q: string): string[] {
  const base = q.trim().toLowerCase();
  if (!base) return [];
  const variants = new Set<string>([base]);
  variants.add(base.replace(/\s+/g, "_"));
  variants.add(base.replace(/\s+/g, "-"));
  variants.add(base.replace(/[^a-z0-9]+/g, ""));
  if (base.endsWith("s") && base.length > 4) {
    const singular = base.slice(0, -1);
    variants.add(singular);
    variants.add(singular.replace(/\s+/g, "_"));
  }
  for (const [id, aliases] of Object.entries(COMPONENT_SEARCH_ALIASES)) {
    if (aliases.some((a) => base.includes(a) || a.includes(base))) variants.add(id);
  }
  return Array.from(variants);
}

function componentMatchesQuery(c: ComponentManifestEntry, variants: string[]): boolean {
  const id = c.id.toLowerCase();
  const name = c.name.toLowerCase();
  const description = c.description.toLowerCase();
  const tags = (c.tags ?? []).map((t) => t.toLowerCase());
  return variants.some(
    (q) =>
      q === id ||
      id.includes(q) ||
      name.includes(q) ||
      description.includes(q) ||
      tags.some((t) => t.includes(q) || q.includes(t))
  );
}

export const COMPONENT_MANIFEST_META = {
  version: index.version,
  repository: index.repository,
  lastUpdated: index.last_updated,
  count: index.components.length,
};

export function listComponents(filters?: {
  q?: string;
  category?: string;
  compileTarget?: ComponentCompileTarget;
  /** When true, only native catalog ids + caller merges package components separately. */
  executableOnly?: boolean;
  /** When true, only components with an eltPulse native compiler. */
  nativeOnly?: boolean;
  limit?: number;
  offset?: number;
}): { items: ComponentListItem[]; total: number } {
  let rows = index.components;

  const q = filters?.q?.trim().toLowerCase();
  if (q) {
    const variants = searchQueryVariants(q);
    rows = rows.filter((c) => componentMatchesQuery(c, variants));
  }

  const cat = filters?.category?.trim().toLowerCase();
  if (cat) {
    rows = rows.filter((c) => normalizeComponentCategory(c.category) === normalizeComponentCategory(cat));
  }

  let items: ComponentListItem[] = rows.map(enrichComponent);

  if (filters?.executableOnly) {
    items = items.filter((c) => c.isExecutable);
  }

  if (filters?.nativeOnly) {
    items = items.filter((c) => c.isNative);
  }

  if (filters?.compileTarget) {
    items = items.filter((c) => c.compileTarget === filters.compileTarget);
  }

  const total = items.length;
  const offset = Math.max(0, filters?.offset ?? 0);
  const limit = Math.min(100, Math.max(1, filters?.limit ?? 50));
  items = items.slice(offset, offset + limit);

  return { items, total };
}

export function getComponentById(id: string): ComponentListItem | null {
  const row = index.components.find((c) => c.id === id);
  if (row) return enrichComponent(row);

  const curated = TOP_COMPONENT_ROUTES[id];
  if (!curated || curated.target === "skip") return null;

  const category =
    curated.target === "quality"
      ? "check"
      : curated.target === "monitor"
        ? "sensor"
        : curated.target === "dbt"
          ? "dbt"
          : curated.target === "dlt" || curated.target === "sling"
            ? "ingestion"
            : "transformation";
  const ports = canvasPortsForCategory(category);
  const pair =
    curated.target === "monitor" || curated.target === "dlt"
      ? suggestMonitorPipelinePair(id)
      : null;

  const native = isNativeComponent(id);
  const compilerTier = resolveCompilerTier(id, curated);
  return {
    id,
    name: id.replace(/_/g, " "),
    category,
    description: curated.hint,
    compileTarget: curated.target,
    compileTargetLabel: compileTargetLabel(curated.target),
    compileBadge: curated.badge,
    compileHint: curated.hint,
    canvasPorts: { left: ports.left, right: ports.right },
    isNative: native,
    hasCompiler: native || canCompileGenerically(curated),
    compilerTier,
    isExecutable: isFaithfulCompiler(compilerTier),
    compilerTierHint: compilerTierHint(compilerTier),
    ...(pair ? { monitorPair: pair } : {}),
  };
}

export function listComponentCategories(): { category: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const c of index.components) {
    const key = normalizeComponentCategory(c.category);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

function enrichComponent(row: ComponentManifestEntry): ComponentListItem {
  const route = routeComponent(row.id, row.category);
  const ports = canvasPortsForCategory(row.category);
  const pair =
    route.target === "monitor" || route.target === "dlt" ? suggestMonitorPipelinePair(row.id) : null;
  const native = isNativeComponent(row.id);
  const compilerTier = resolveCompilerTier(row.id, route);
  const isExecutable = isFaithfulCompiler(compilerTier);
  const description = sanitizeCatalogDescription(row.description);
  return {
    ...row,
    description,
    compileTarget: route.target,
    compileTargetLabel: compileTargetLabel(route.target),
    compileBadge: route.badge,
    compileHint: route.hint,
    canvasPorts: { left: ports.left, right: ports.right },
    isNative: native,
    hasCompiler: native || canCompileGenerically(route),
    compilerTier,
    isExecutable,
    compilerTierHint: compilerTierHint(compilerTier),
    ...(pair ? { monitorPair: pair } : {}),
  };
}

/** Fetch remote schema.json for a component (server-side). */
export async function fetchComponentSchema(schemaUrl: string): Promise<unknown | null> {
  if (!schemaUrl.startsWith("https://")) return null;
  try {
    const res = await fetch(schemaUrl, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
