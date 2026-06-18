import type {
  ComponentCatalogSource,
  ComponentPackageManifest,
  ComponentPackageMeta,
} from "./types";

const manifestCache = new Map<string, { at: number; manifest: ComponentPackageManifest }>();
const componentJsonCache = new Map<string, { at: number; meta: ComponentPackageMeta }>();
const compileSourceCache = new Map<string, { at: number; source: string | null }>();

const TTL_MS = 5 * 60 * 1000;

function cacheGet<T>(map: Map<string, { at: number; value: T }>, key: string): T | null {
  const row = map.get(key) as { at: number; value: T } | undefined;
  if (!row) return null;
  if (Date.now() - row.at > TTL_MS) {
    map.delete(key);
    return null;
  }
  return row.value;
}

function cacheSet<T>(map: Map<string, { at: number; value: T }>, key: string, value: T): void {
  (map as Map<string, { at: number; value: T }>).set(key, { at: Date.now(), value });
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function fetchCatalogManifest(
  catalog: ComponentCatalogSource
): Promise<ComponentPackageManifest | null> {
  const key = catalog.id;
  const cached = manifestCache.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.manifest;

  const text = await fetchText(`${catalog.rawBase}manifest.json`);
  if (!text) return null;
  try {
    const manifest = JSON.parse(text) as ComponentPackageManifest;
    if (!Array.isArray(manifest.components)) return null;
    manifestCache.set(key, { at: Date.now(), manifest });
    return manifest;
  } catch {
    return null;
  }
}

export async function fetchComponentMeta(
  catalog: ComponentCatalogSource,
  componentId: string
): Promise<ComponentPackageMeta | null> {
  const key = `${catalog.id}#${componentId}`;
  const hit = componentJsonCache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.meta;

  const text = await fetchText(`${catalog.rawBase}components/${componentId}/component.json`);
  if (!text) return null;
  try {
    const meta = JSON.parse(text) as ComponentPackageMeta;
    if (!meta.id) meta.id = componentId;
    componentJsonCache.set(key, { at: Date.now(), meta });
    return meta;
  } catch {
    return null;
  }
}

export async function fetchCompileSource(
  catalog: ComponentCatalogSource,
  componentId: string
): Promise<string | null> {
  const key = `${catalog.id}#${componentId}#compile`;
  const hit = compileSourceCache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.source;

  const source = await fetchText(`${catalog.rawBase}components/${componentId}/compile.mjs`);
  compileSourceCache.set(key, { at: Date.now(), source });
  return source;
}

/** Test helper — clear in-memory caches. */
export function clearComponentPackageCaches(): void {
  manifestCache.clear();
  componentJsonCache.clear();
  compileSourceCache.clear();
}
