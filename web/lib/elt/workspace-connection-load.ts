import { getAccessibleResourceOwnerIds } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db/client";
import { parseStoredConnectionSecrets } from "@/lib/elt/connection-secrets-store";
import { mergeConnectionRuntimeSecrets } from "@/lib/elt/duckdb-destination";

export type LoadedWorkspaceConnection = {
  id: string;
  name: string;
  connectionType: string;
  connector: string;
  config: Record<string, unknown>;
  secrets: Record<string, string>;
};

/** Load a connection by id within the caller's workspace (org-shared resources). */
export async function loadWorkspaceConnectionById(
  userId: string,
  connectionId: string | null | undefined
): Promise<LoadedWorkspaceConnection | null> {
  if (!connectionId) return null;
  const ownerIds = await getAccessibleResourceOwnerIds(userId);
  const row = await db.connection.findFirst({
    where: { id: connectionId, userId: { in: ownerIds } },
    select: {
      id: true,
      name: true,
      connectionType: true,
      connector: true,
      config: true,
      connectionSecretsEnc: true,
    },
  });
  if (!row) return null;

  const config =
    row.config && typeof row.config === "object" && !Array.isArray(row.config)
      ? (row.config as Record<string, unknown>)
      : {};
  const secrets = mergeConnectionRuntimeSecrets(
    row.connectionType as "source" | "destination",
    row.connector,
    parseStoredConnectionSecrets(row.connectionSecretsEnc),
    config
  );

  return {
    id: row.id,
    name: row.name,
    connectionType: row.connectionType,
    connector: row.connector,
    config,
    secrets,
  };
}
