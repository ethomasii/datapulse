import { db } from "@/lib/db/client";
import type { CreatePipelineBody } from "./types";

const LEGACY_KEYS = ["source_connection", "destination_connection"] as const;

/** Remove legacy string keys from persisted `source_configuration` — linkage is FK columns on `EltPipeline`. */
export function stripLegacyPipelineConnectionKeys(cfg: Record<string, unknown>): Record<string, unknown> {
  const next = { ...cfg };
  for (const k of LEGACY_KEYS) {
    delete next[k];
  }
  return next;
}

/** Re-inject resolved profile names for codegen / exported config YAML only (not for DB JSON persistence). */
export function withResolvedConnectionNamesForCodegen(
  cfg: Record<string, unknown>,
  names: { source: string | null; destination: string | null }
): Record<string, unknown> {
  const out = { ...cfg };
  if (names.source) out.source_connection = names.source;
  else delete out.source_connection;
  if (names.destination) out.destination_connection = names.destination;
  else delete out.destination_connection;
  return out;
}

export async function loadConnectionNamesForCodegen(
  userId: string,
  sourceConnectionId: string | null,
  destinationConnectionId: string | null
): Promise<{ source: string | null; destination: string | null }> {
  const [src, dest] = await Promise.all([
    sourceConnectionId
      ? db.connection.findFirst({
          where: { id: sourceConnectionId, userId },
          select: { name: true },
        })
      : null,
    destinationConnectionId
      ? db.connection.findFirst({
          where: { id: destinationConnectionId, userId },
          select: { name: true },
        })
      : null,
  ]);
  return { source: src?.name ?? null, destination: dest?.name ?? null };
}

export async function validatePipelineConnectionIds(
  userId: string,
  sourceType: string,
  destinationType: string,
  sourceConnectionId: string | null,
  destinationConnectionId: string | null
): Promise<{ ok: true } | { ok: false; message: string }> {
  async function check(
    id: string,
    expectType: "source" | "destination",
    expectConnector: string
  ): Promise<string | null> {
    const row = await db.connection.findFirst({
      where: { id, userId },
      select: { connectionType: true, connector: true },
    });
    if (!row) return "Invalid connection";
    if (row.connectionType !== expectType) {
      return `Connection must be a ${expectType} profile`;
    }
    if (row.connector.toLowerCase() !== expectConnector.toLowerCase()) {
      return `Connection connector does not match pipeline ${expectType} type`;
    }
    return null;
  }

  if (sourceConnectionId) {
    const err = await check(sourceConnectionId, "source", sourceType);
    if (err) return { ok: false, message: err };
  }
  if (destinationConnectionId) {
    const err = await check(destinationConnectionId, "destination", destinationType);
    if (err) return { ok: false, message: err };
  }
  return { ok: true };
}

function connectionIdsFromBody(body: CreatePipelineBody): {
  sourceConnectionId: string | null;
  destinationConnectionId: string | null;
} {
  return {
    sourceConnectionId:
      body.sourceConnectionId === undefined || body.sourceConnectionId === null
        ? null
        : body.sourceConnectionId,
    destinationConnectionId:
      body.destinationConnectionId === undefined || body.destinationConnectionId === null
        ? null
        : body.destinationConnectionId,
  };
}

/**
 * Strips legacy name keys from persisted JSON, validates FKs, and returns a body copy for artifact generation
 * (with `source_connection` / `destination_connection` names re-injected when FKs are set).
 */
export async function preparePipelinePersistenceAndArtifacts(
  userId: string,
  body: CreatePipelineBody,
  mergedSourceConfiguration: Record<string, unknown>
): Promise<
  | { ok: false; message: string }
  | {
      ok: true;
      persistedSourceConfiguration: Record<string, unknown>;
      artifactBody: CreatePipelineBody;
      sourceConnectionId: string | null;
      destinationConnectionId: string | null;
    }
> {
  const persistedSourceConfiguration = stripLegacyPipelineConnectionKeys(mergedSourceConfiguration);
  const { sourceConnectionId, destinationConnectionId } = connectionIdsFromBody(body);
  const v = await validatePipelineConnectionIds(
    userId,
    body.sourceType,
    body.destinationType,
    sourceConnectionId,
    destinationConnectionId
  );
  if (!v.ok) return { ok: false, message: v.message };

  const names = await loadConnectionNamesForCodegen(userId, sourceConnectionId, destinationConnectionId);
  const forCodegen = withResolvedConnectionNamesForCodegen(persistedSourceConfiguration, names);
  const artifactBody: CreatePipelineBody = { ...body, sourceConfiguration: forCodegen };
  return {
    ok: true,
    persistedSourceConfiguration,
    artifactBody,
    sourceConnectionId,
    destinationConnectionId,
  };
}
