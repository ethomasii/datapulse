"use client";

import { useCallback, useEffect, useState } from "react";

export type QuickStartConnection = {
  id: string;
  name: string;
  connectionType: "source" | "destination";
  connector: string;
  hasStoredSecrets: boolean;
  updatedAt: string;
};

export function useQuickStartConnections() {
  const [connections, setConnections] = useState<QuickStartConnection[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => {
    fetch("/api/elt/connections", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { connections?: QuickStartConnection[] } | null) => {
        setConnections(
          (data?.connections ?? []).map((c) => ({
            ...c,
            connectionType: c.connectionType as "source" | "destination",
          }))
        );
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { connections, loaded, refresh };
}

/** Saved connections that match a quick-start connector slug and have encrypted secrets. */
export function matchingQuickStartConnections(
  connections: QuickStartConnection[],
  connectionType: "source" | "destination",
  connectorSlug: string
): QuickStartConnection[] {
  const slug = connectorSlug.toLowerCase().trim();
  return connections.filter(
    (c) =>
      c.connectionType === connectionType &&
      c.connector.toLowerCase().trim() === slug &&
      c.hasStoredSecrets
  );
}
