"use client";

import { useEffect, useState } from "react";

export type LinkedConnectionMeta = {
  id: string;
  name: string;
  hasStoredSecrets: boolean;
};

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
      .then((data: { connections?: LinkedConnectionMeta[] } | null) => {
        if (cancelled) return;
        const row = (data?.connections ?? []).find((c) => c.id === connectionId) ?? null;
        setMeta(row);
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
