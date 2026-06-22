"use client";

import { useCallback, useEffect, useState } from "react";

export type WorkspaceDefaultDestination = {
  connectionId: string | null;
  connector: string | null;
  name: string | null;
  loaded: boolean;
};

/** Client hook for workspace default destination (`destination: @workspace`). */
export function useWorkspaceDefaultDestination(): WorkspaceDefaultDestination & {
  refresh: () => void;
} {
  const [state, setState] = useState<WorkspaceDefaultDestination>({
    connectionId: null,
    connector: null,
    name: null,
    loaded: false,
  });

  const refresh = useCallback(() => {
    fetch("/api/elt/workspace-defaults", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Record<string, unknown> | null) => {
        if (!d) {
          setState((s) => ({ ...s, loaded: true }));
          return;
        }
        setState({
          connectionId:
            typeof d.defaultDestinationConnectionId === "string"
              ? d.defaultDestinationConnectionId
              : null,
          connector:
            typeof d.defaultDestinationConnector === "string"
              ? d.defaultDestinationConnector
              : null,
          name:
            typeof d.defaultDestinationName === "string" ? d.defaultDestinationName : null,
          loaded: true,
        });
      })
      .catch(() => setState((s) => ({ ...s, loaded: true })));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, refresh };
}
