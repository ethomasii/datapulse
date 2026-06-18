import { runCompileInSandbox } from "./run-compile-sandbox";
import {
  fetchCatalogManifest,
  fetchCompileSource,
  fetchComponentMeta,
} from "./fetch-catalog";
import { resolveCatalogSources } from "./catalog-sources";
import type {
  ComponentCatalogIndexEntry,
  ComponentCatalogSource,
  ComponentPackageDefinition,
} from "./types";

const definitionCache = new Map<string, ComponentPackageDefinition>();

function defKey(catalogId: string, componentId: string): string {
  return `${catalogId}::${componentId}`;
}

function aliasKeys(meta: { id: string; aliases?: string[] }): string[] {
  return [meta.id, ...(meta.aliases ?? [])];
}

export async function loadPackageComponent(
  catalog: ComponentCatalogSource,
  componentId: string
): Promise<ComponentPackageDefinition | null> {
  const cacheKey = defKey(catalog.id, componentId);
  const cached = definitionCache.get(cacheKey);
  if (cached) return cached;

  const meta = await fetchComponentMeta(catalog, componentId);
  if (!meta) return null;

  const compileSource = await fetchCompileSource(catalog, componentId);
  if (!compileSource?.trim()) return null;

  const def: ComponentPackageDefinition = {
    ...meta,
    catalog,
    compileSource,
    compile: async (config) => runCompileInSandbox(compileSource, config),
  };

  for (const key of aliasKeys(meta)) {
    definitionCache.set(defKey(catalog.id, key), def);
  }
  return def;
}

export async function resolvePackageComponent(
  componentId: string,
  sourceConfiguration?: Record<string, unknown> | null,
  workspaceCatalogUrls?: string[] | null
): Promise<ComponentPackageDefinition | null> {
  const id = componentId.trim();
  if (!id) return null;

  const catalogs = resolveCatalogSources(sourceConfiguration, workspaceCatalogUrls);

  for (const catalog of catalogs) {
    const manifest = await fetchCatalogManifest(catalog);
    if (!manifest) continue;

    const ids = new Set<string>();
    for (const cid of manifest.components) {
      ids.add(cid);
      const meta = await fetchComponentMeta(catalog, cid);
      if (meta?.aliases) for (const a of meta.aliases) ids.add(a);
    }

    if (!ids.has(id)) continue;

    const resolvedId = manifest.components.includes(id)
      ? id
      : (await findCanonicalId(catalog, manifest.components, id));
    if (!resolvedId) continue;

    const def = await loadPackageComponent(catalog, resolvedId);
    if (def) return def;
  }

  return null;
}

async function findCanonicalId(
  catalog: ComponentCatalogSource,
  componentIds: string[],
  aliasOrId: string
): Promise<string | null> {
  for (const cid of componentIds) {
    const meta = await fetchComponentMeta(catalog, cid);
    if (!meta) continue;
    if (meta.id === aliasOrId || (meta.aliases ?? []).includes(aliasOrId)) return meta.id;
  }
  return null;
}

export async function listPackageCatalogComponents(
  sourceConfiguration?: Record<string, unknown> | null,
  workspaceCatalogUrls?: string[] | null
): Promise<ComponentCatalogIndexEntry[]> {
  const catalogs = resolveCatalogSources(sourceConfiguration, workspaceCatalogUrls);
  const out: ComponentCatalogIndexEntry[] = [];
  const seen = new Set<string>();

  for (const catalog of catalogs) {
    const manifest = await fetchCatalogManifest(catalog);
    if (!manifest) continue;

    for (const cid of manifest.components) {
      if (seen.has(cid)) continue;
      const meta = await fetchComponentMeta(catalog, cid);
      const compileSource = await fetchCompileSource(catalog, cid);
      if (!meta || !compileSource?.trim()) continue;
      seen.add(cid);
      out.push({
        ...meta,
        id: meta.id || cid,
        catalogId: catalog.id,
        isPackage: true,
        packageCompile: true,
      });
    }
  }

  return out;
}

export function clearPackageRegistryCache(): void {
  definitionCache.clear();
}
