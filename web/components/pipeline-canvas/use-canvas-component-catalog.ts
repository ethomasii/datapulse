"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentListItem } from "@/components/elt/component-palette";

/** Quick-pick menu only needs executable native components (no package metadata). */
const CATALOG_URL = "/api/elt/components?nativeOnly=1&executableOnly=1&limit=500";

let cache: ComponentListItem[] | null = null;
let inflight: Promise<ComponentListItem[]> | null = null;

export function prefetchCanvasComponentCatalog(): void {
  if (cache || inflight) return;
  inflight = fetch(CATALOG_URL, { credentials: "same-origin" })
    .then((r) => r.json())
    .then((data: { components?: ComponentListItem[] }) => {
      cache = data.components ?? [];
      return cache;
    })
    .catch(() => {
      inflight = null;
      return [] as ComponentListItem[];
    });
}

function loadCanvasComponentCatalog(): Promise<ComponentListItem[]> {
  if (cache) return Promise.resolve(cache);
  prefetchCanvasComponentCatalog();
  return inflight ?? Promise.resolve([]);
}

export function useCanvasComponentCatalog() {
  const [catalog, setCatalog] = useState<ComponentListItem[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let cancelled = false;
    void loadCanvasComponentCatalog().then((items) => {
      if (!cancelled) {
        setCatalog(items);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const catalogById = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);

  return { catalog, catalogById, loading };
}
