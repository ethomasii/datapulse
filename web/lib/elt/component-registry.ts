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
import { getNativeComponent, isNativeComponent, isNativeCatalogAliasId, listNativeComponents } from "@/lib/elt/native-components/registry";
import type { NativeComponentDefinition } from "@/lib/elt/native-components/types";
import {
  mcpVirtualListItemStub,
  parseMcpVirtualComponentId,
} from "@/lib/elt/mcp-server/virtual-components";

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
  /** Workspace MCP tool expanded from toolsCache (compiles as mcp_tool_call). */
  isMcpVirtual?: boolean;
  mcpServerId?: string;
  mcpServerName?: string;
  /** Prefilled node config when dropped on canvas. */
  defaultConfig?: Record<string, unknown>;
};

type ManifestIndex = {
  version: string;
  repository: string;
  last_updated?: string;
  components: ComponentManifestEntry[];
};

const index = manifestIndex as ManifestIndex;

/** Not canvas components — Dagster policy/metadata only; hidden from catalog and Pulse AI. */
export const CATALOG_EXCLUDED_COMPONENT_IDS = new Set<string>(["freshness_check"]);

/** Extra search phrases → component id (helps Pulse AI match natural language). */
const COMPONENT_SEARCH_ALIASES: Record<string, string[]> = {
  alter_row: ["alter row", "alter rows", "alterrow", "cdc marker", "change type", "adf alter row"],
  fill_nulls: ["fill nulls", "fill null", "impute nulls", "replace nulls", "null with n/a"],
  litellm_structured_output: [
    "structured output",
    "extract fields",
    "extract json",
    "pydantic",
    "json schema extraction",
    "parse entities",
  ],
  litellm_function_calling: ["function calling", "tool calling per row", "openai tools"],
  rag_pipeline: ["rag", "retrieval augmented", "vector search", "retrieve and generate"],
  litellm_inference_asset: ["llm per row", "enrich column", "summarize each row", "llm enrichment"],
  litellm_agent: ["llm agent", "mcp agent", "agent per row"],
  mcp_tool_call: ["mcp tool", "deterministic mcp", "stripe refund"],
  join_tables: ["join", "dataframe join", "warehouse join", "lookup", "merge tables"],
  filter_rows: ["filter", "select records", "warehouse filter", "dataframe filter", "where"],
  union_tables: ["union", "dataframe union", "warehouse union", "stack tables"],
  sample_rows: ["sample", "create samples", "random sample"],
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
  const nativeDef = getNativeComponent(c.id);
  const aliasIds = (nativeDef?.aliases ?? []).map((a) => a.toLowerCase());
  return variants.some(
    (q) =>
      q === id ||
      id.includes(q) ||
      name.includes(q) ||
      description.includes(q) ||
      tags.some((t) => t.includes(q) || q.includes(t)) ||
      aliasIds.some((a) => a === q || a.includes(q) || q.includes(a))
  );
}

function nativeDefinitionMatchesQuery(def: NativeComponentDefinition, variants: string[]): boolean {
  const id = def.id.toLowerCase();
  const name = def.name.toLowerCase();
  const description = def.description.toLowerCase();
  const aliasIds = (def.aliases ?? []).map((a) => a.toLowerCase());
  return variants.some(
    (q) =>
      q === id ||
      id.includes(q) ||
      name.includes(q) ||
      description.includes(q) ||
      aliasIds.some((a) => a === q || a.includes(q) || q.includes(a))
  );
}

function nativeDefinitionToListItem(def: NativeComponentDefinition): ComponentListItem {
  const route = routeComponent(def.id, def.category);
  const ports = canvasPortsForCategory(def.category);
  const pair =
    route.target === "monitor" || route.target === "dlt" ? suggestMonitorPipelinePair(def.id) : null;
  const compilerTier = resolveCompilerTier(def.id, route);
  const isExecutable = isFaithfulCompiler(compilerTier);
  return {
    id: def.id,
    name: def.name,
    category: def.category,
    description: def.description,
    compileTarget: route.target,
    compileTargetLabel: compileTargetLabel(route.target),
    compileBadge: route.badge,
    compileHint: route.hint,
    canvasPorts: { left: ports.left, right: ports.right },
    isNative: true,
    hasCompiler: true,
    compilerTier,
    isExecutable,
    compilerTierHint: compilerTierHint(compilerTier),
    ...(pair ? { monitorPair: pair } : {}),
  };
}

function listNativeCatalogItems(filters?: {
  q?: string;
  category?: string;
  compileTarget?: ComponentCompileTarget;
  executableOnly?: boolean;
}): ComponentListItem[] {
  let items = listNativeComponents().map(nativeDefinitionToListItem);

  const q = filters?.q?.trim().toLowerCase();
  if (q) {
    const variants = searchQueryVariants(q);
    items = items.filter((item) => {
      const def = getNativeComponent(item.id);
      return def ? nativeDefinitionMatchesQuery(def, variants) : componentMatchesQuery(item, variants);
    });
  }

  const cat = filters?.category?.trim().toLowerCase();
  if (cat) {
    items = items.filter((c) => normalizeComponentCategory(c.category) === normalizeComponentCategory(cat));
  }

  if (filters?.executableOnly) {
    items = items.filter((c) => c.isExecutable);
  }

  if (filters?.compileTarget) {
    items = items.filter((c) => c.compileTarget === filters.compileTarget);
  }

  return items;
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
  if (filters?.nativeOnly) {
    const items = listNativeCatalogItems(filters);
    const total = items.length;
    const offset = Math.max(0, filters?.offset ?? 0);
    const limit = Math.min(100, Math.max(1, filters?.limit ?? 50));
    return { items: items.slice(offset, offset + limit), total };
  }

  let rows = index.components.filter((c) => !CATALOG_EXCLUDED_COMPONENT_IDS.has(c.id));
  rows = rows.filter((c) => !isNativeCatalogAliasId(c.id));

  const manifestNativeIds = new Set(
    rows.filter((c) => isNativeComponent(c.id) && !isNativeCatalogAliasId(c.id)).map((c) => c.id)
  );
  for (const def of listNativeComponents()) {
    if (!manifestNativeIds.has(def.id)) {
      rows.push({
        id: def.id,
        name: def.name,
        category: def.category,
        description: def.description,
      });
    }
  }

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
  if (CATALOG_EXCLUDED_COMPONENT_IDS.has(id)) return null;
  const virtual = parseMcpVirtualComponentId(id);
  if (virtual) return mcpVirtualListItemStub(virtual);
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
    if (CATALOG_EXCLUDED_COMPONENT_IDS.has(c.id)) continue;
    const key = normalizeComponentCategory(c.category);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

function enrichComponent(row: ComponentManifestEntry): ComponentListItem {
  const nativeDef = getNativeComponent(row.id);
  const category = nativeDef?.category ?? row.category;
  const route = routeComponent(row.id, category);
  const ports = canvasPortsForCategory(category);
  const pair =
    route.target === "monitor" || route.target === "dlt" ? suggestMonitorPipelinePair(row.id) : null;
  const native = isNativeComponent(row.id);
  const compilerTier = resolveCompilerTier(row.id, route);
  const isExecutable = isFaithfulCompiler(compilerTier);
  const description = sanitizeCatalogDescription(row.description);
  return {
    ...row,
    name: nativeDef?.name ?? row.name,
    category,
    description: nativeDef?.description ?? description,
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
