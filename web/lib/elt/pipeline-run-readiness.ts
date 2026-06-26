import {
  getConnectorDestinationCredentials,
  getConnectorSourceCredentials,
  type CredentialField,
} from "@/lib/elt/connectors-registry";
import { getAccessibleResourceOwnerIds } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db/client";
import { loadWorkspaceConnectionById } from "@/lib/elt/workspace-connection-load";

function requiredCredentialKeys(fields: CredentialField[]): string[] {
  return fields.filter((f) => f.required !== false).map((f) => f.key);
}

function missingSecretKeys(secrets: Record<string, string>, keys: string[]): string[] {
  return keys.filter((k) => !secrets[k]?.trim());
}

async function resolveImplicitConnectionId(
  userId: string,
  side: "source" | "destination",
  connector: string,
  connectionId: string | null
): Promise<string | null> {
  if (connectionId) return connectionId;
  const ownerIds = await getAccessibleResourceOwnerIds(userId);
  const rows = await db.connection.findMany({
    where: {
      userId: { in: ownerIds },
      connectionType: side,
      connector: { equals: connector, mode: "insensitive" },
    },
    select: { id: true },
    take: 2,
  });
  return rows.length === 1 ? rows[0].id : null;
}

/** Re-link saved connections when the pipeline row lost FKs but the workspace has a single matching profile. */
export async function healPipelineConnectionLinks(
  userId: string,
  pipelineId: string
): Promise<{ sourceConnectionId: string | null; destinationConnectionId: string | null } | null> {
  const ownerIds = await getAccessibleResourceOwnerIds(userId);
  const pipeline = await db.eltPipeline.findFirst({
    where: { id: pipelineId, userId: { in: ownerIds } },
    select: {
      id: true,
      sourceType: true,
      destinationType: true,
      sourceConnectionId: true,
      destinationConnectionId: true,
    },
  });
  if (!pipeline) return null;

  let sourceConnectionId = pipeline.sourceConnectionId;
  let destinationConnectionId = pipeline.destinationConnectionId;
  let changed = false;

  if (!sourceConnectionId && requiredCredentialKeys(getConnectorSourceCredentials(pipeline.sourceType)).length > 0) {
    const inferred = await resolveImplicitConnectionId(userId, "source", pipeline.sourceType, null);
    if (inferred) {
      sourceConnectionId = inferred;
      changed = true;
    }
  }
  if (
    !destinationConnectionId &&
    requiredCredentialKeys(getConnectorDestinationCredentials(pipeline.destinationType)).length > 0
  ) {
    const inferred = await resolveImplicitConnectionId(userId, "destination", pipeline.destinationType, null);
    if (inferred) {
      destinationConnectionId = inferred;
      changed = true;
    }
  }

  if (changed) {
    await db.eltPipeline.update({
      where: { id: pipeline.id },
      data: { sourceConnectionId, destinationConnectionId },
    });
  }

  return { sourceConnectionId, destinationConnectionId };
}

async function validateConnectionSide(
  userId: string,
  side: "source" | "destination",
  connector: string,
  connectionId: string | null,
  requiredKeys: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (requiredKeys.length === 0) return { ok: true };
  if (!connectionId) {
    const noun = side === "source" ? "source" : "destination";
    return {
      ok: false,
      error: `Link a ${connector} ${noun} connection in the builder before running this pipeline.`,
    };
  }

  const row = await loadWorkspaceConnectionById(userId, connectionId);
  if (!row) {
    return {
      ok: false,
      error: `${side === "source" ? "Source" : "Destination"} connection not found — re-select it in the builder.`,
    };
  }

  const missing = missingSecretKeys(row.secrets, requiredKeys);
  if (missing.length === 0) return { ok: true };

  return {
    ok: false,
    error: `${side === "source" ? "Source" : "Destination"} connection is missing required secret${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Update it on the Connections page.`,
  };
}

/** Managed runs always receive credentials from saved connections — validate before enqueue. */
export async function validateManagedPipelineConnections(params: {
  userId: string;
  sourceType: string;
  destinationType: string;
  sourceConnectionId: string | null;
  destinationConnectionId: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const sourceConnectionId = await resolveImplicitConnectionId(
    params.userId,
    "source",
    params.sourceType,
    params.sourceConnectionId
  );
  const destinationConnectionId = await resolveImplicitConnectionId(
    params.userId,
    "destination",
    params.destinationType,
    params.destinationConnectionId
  );

  const sourceCheck = await validateConnectionSide(
    params.userId,
    "source",
    params.sourceType,
    sourceConnectionId,
    requiredCredentialKeys(getConnectorSourceCredentials(params.sourceType))
  );
  if (!sourceCheck.ok) return sourceCheck;

  return validateConnectionSide(
    params.userId,
    "destination",
    params.destinationType,
    destinationConnectionId,
    requiredCredentialKeys(getConnectorDestinationCredentials(params.destinationType))
  );
}
