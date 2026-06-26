"use client";

import { useEffect, useState } from "react";

export type LinkedConnectionMeta = {
  id: string;
  name: string;
  connector: string;
  config: Record<string, string>;
  hasStoredSecrets: boolean;
};

function flattenConnectionConfig(raw: Record<string, unknown> | undefined): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    if (v === undefined || v === null) continue;
    flat[k] = typeof v === "string" ? v : String(v);
  }
  return flat;
}

export function useLinkedConnectionMeta(connectionId: string | null | undefined) {
  const [meta, setMeta] = useState<LinkedConnectionMeta | null>(null);

  useEffect(() => {
    if (!connectionId) {
      setMeta(null);
      return;
    }
    let cancelled = false;
    fetch("/api/elt/connections", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { connections?: Array<Record<string, unknown>> } | null) => {
        if (cancelled) return;
        const raw = (data?.connections ?? []).find((c) => c.id === connectionId);
        if (!raw) {
          setMeta(null);
          return;
        }
        setMeta({
          id: String(raw.id),
          name: String(raw.name ?? ""),
          connector: String(raw.connector ?? ""),
          config: flattenConnectionConfig(raw.config as Record<string, unknown> | undefined),
          hasStoredSecrets: Boolean(raw.hasStoredSecrets),
        });
      })
      .catch(() => {
        if (!cancelled) setMeta(null);
      });
    return () => {
      cancelled = true;
    };
  }, [connectionId]);

  return meta;
}
