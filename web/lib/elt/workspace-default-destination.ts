import { db } from "@/lib/db/client";
import { getWorkspacePermissions } from "@/lib/auth/org-permissions";
import {
  WORKSPACE_DESTINATION_REF,
  type DeclarativePipelineSpec,
} from "@/lib/elt/declarative-pipeline-spec";

export type ResolvedDestination = {
  destinationType: string;
  destinationConnectionId: string | null;
};

export type WorkspaceDefaultsContext = {
  defaultDestinationConnectionId: string | null;
  defaultDestinationConnector: string | null;
  defaultDestinationName: string | null;
};

/** Load workspace default destination (org default wins when user belongs to an org). */
export async function loadWorkspaceDefaults(userId: string): Promise<WorkspaceDefaultsContext> {
  const perms = await getWorkspacePermissions(userId);
  const ownerId = perms.resourceOwnerIds[0] ?? userId;

  const user = await db.user.findUnique({
    where: { id: ownerId },
    select: { defaultDestinationConnectionId: true, organizationId: true },
  });

  const org =
    user?.organizationId != null
      ? await db.organization.findUnique({
          where: { id: user.organizationId },
          select: { defaultDestinationConnectionId: true },
        })
      : null;

  const connectionId =
    org?.defaultDestinationConnectionId ?? user?.defaultDestinationConnectionId ?? null;

  if (!connectionId) {
    return {
      defaultDestinationConnectionId: null,
      defaultDestinationConnector: null,
      defaultDestinationName: null,
    };
  }

  const conn = await db.connection.findFirst({
    where: { id: connectionId, userId: ownerId, connectionType: "destination" },
    select: { id: true, connector: true, name: true },
  });

  if (!conn) {
    return {
      defaultDestinationConnectionId: null,
      defaultDestinationConnector: null,
      defaultDestinationName: null,
    };
  }

  return {
    defaultDestinationConnectionId: conn.id,
    defaultDestinationConnector: conn.connector,
    defaultDestinationName: conn.name,
  };
}

function isWorkspaceRef(ref: string): boolean {
  const v = ref.trim().toLowerCase();
  return v === WORKSPACE_DESTINATION_REF || v === "@default" || v === "default";
}

/** Resolve a connection ref (id, name) to a Connection row id. */
export async function resolveConnectionRef(
  userId: string,
  ref: string,
  expectType: "source" | "destination"
): Promise<{ id: string; connector: string } | null> {
  const trimmed = ref.trim();
  if (!trimmed) return null;

  const perms = await getWorkspacePermissions(userId);
  const ownerIds = perms.resourceOwnerIds;

  const byId = await db.connection.findFirst({
    where: { id: trimmed, userId: { in: ownerIds }, connectionType: expectType },
    select: { id: true, connector: true },
  });
  if (byId) return byId;

  const byName = await db.connection.findFirst({
    where: { name: trimmed, userId: { in: ownerIds }, connectionType: expectType },
    select: { id: true, connector: true },
  });
  return byName;
}

/** Resolve destination field from declarative spec (supports `@workspace`). */
export async function resolveSpecDestination(
  userId: string,
  spec: Pick<DeclarativePipelineSpec, "destination" | "destinationConnection">,
  defaults: WorkspaceDefaultsContext
): Promise<ResolvedDestination | { error: string }> {
  if (spec.destinationConnection) {
    const conn = await resolveConnectionRef(userId, spec.destinationConnection, "destination");
    if (!conn) return { error: `Unknown destination connection: ${spec.destinationConnection}` };
    const destType = isWorkspaceRef(spec.destination)
      ? conn.connector
      : spec.destination.trim();
    return { destinationType: destType.toLowerCase(), destinationConnectionId: conn.id };
  }

  if (isWorkspaceRef(spec.destination)) {
    if (!defaults.defaultDestinationConnectionId || !defaults.defaultDestinationConnector) {
      return {
        error:
          "No workspace default destination configured. Set one under Connections or specify an explicit destination.",
      };
    }
    return {
      destinationType: defaults.defaultDestinationConnector.toLowerCase(),
      destinationConnectionId: defaults.defaultDestinationConnectionId,
    };
  }

  return {
    destinationType: spec.destination.trim().toLowerCase(),
    destinationConnectionId: null,
  };
}

/** Resolve source connection ref when provided. */
export async function resolveSpecSource(
  userId: string,
  spec: Pick<DeclarativePipelineSpec, "source" | "sourceConnection">
): Promise<{ sourceType: string; sourceConnectionId: string | null } | { error: string }> {
  if (spec.sourceConnection) {
    const conn = await resolveConnectionRef(userId, spec.sourceConnection, "source");
    if (!conn) return { error: `Unknown source connection: ${spec.sourceConnection}` };
    return {
      sourceType: conn.connector.toLowerCase(),
      sourceConnectionId: conn.id,
    };
  }
  return {
    sourceType: spec.source.trim().toLowerCase(),
    sourceConnectionId: null,
  };
}
