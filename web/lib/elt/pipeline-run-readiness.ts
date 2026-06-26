import {
  getConnectorDestinationCredentials,
  getConnectorSourceCredentials,
  type CredentialField,
} from "@/lib/elt/connectors-registry";
import { loadWorkspaceConnectionById } from "@/lib/elt/workspace-connection-load";

function requiredCredentialKeys(fields: CredentialField[]): string[] {
  return fields.filter((f) => f.required !== false).map((f) => f.key);
}

function missingSecretKeys(secrets: Record<string, string>, keys: string[]): string[] {
  return keys.filter((k) => !secrets[k]?.trim());
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
  const sourceCheck = await validateConnectionSide(
    params.userId,
    "source",
    params.sourceType,
    params.sourceConnectionId,
    requiredCredentialKeys(getConnectorSourceCredentials(params.sourceType))
  );
  if (!sourceCheck.ok) return sourceCheck;

  return validateConnectionSide(
    params.userId,
    "destination",
    params.destinationType,
    params.destinationConnectionId,
    requiredCredentialKeys(getConnectorDestinationCredentials(params.destinationType))
  );
}
