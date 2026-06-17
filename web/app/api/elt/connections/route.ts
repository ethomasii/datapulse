import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import {
  API_SCOPES,
  hasScope,
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { getWorkspacePermissions, workspaceResourceUserId } from "@/lib/auth/org-permissions";
import { connectionOwnerWhere } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db/client";
import { mergeConnectionSecretsEnc } from "@/lib/elt/connection-secrets-store";
import { toPublicConnection } from "@/lib/elt/connection-public";

export async function GET(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.CONNECTIONS_READ)) return scopeForbiddenResponse();

  const ownerIds = (await getWorkspacePermissions(auth.user.id)).resourceOwnerIds;

  try {
    const rows = await db.connection.findMany({
      where: connectionOwnerWhere(ownerIds),
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        connectionType: true,
        connector: true,
        config: true,
        createdAt: true,
        updatedAt: true,
        connectionSecretsEnc: true,
      },
    });
    return NextResponse.json({
      connections: rows.map((r) => toPublicConnection(r)),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("does not exist") || msg.includes("relation") || msg.includes("P2021")) {
      return NextResponse.json({ connections: [], _migrationPending: true });
    }
    if (msg.includes("connection_secrets_enc") || msg.includes("Unknown column") || msg.includes("P2022")) {
      return NextResponse.json(
        {
          connections: [],
          _migrationPending: true,
          _hint: "Run prisma/add-connection-secrets-enc.sql or npx prisma db push to add connection_secrets_enc",
        },
        { status: 200 }
      );
    }
    throw err;
  }
}

export async function POST(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.CONNECTIONS_WRITE)) return scopeForbiddenResponse();

  const perms = await getWorkspacePermissions(auth.user.id);
  if (!perms.canWrite) {
    return NextResponse.json({ error: "View-only access" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const { name, connectionType, connector, config } = b;
  if (
    typeof name !== "string" || !name.trim() ||
    typeof connectionType !== "string" || !["source", "destination"].includes(connectionType) ||
    typeof connector !== "string" || !connector.trim()
  ) {
    return NextResponse.json({ error: "name, connectionType (source|destination), and connector are required" }, { status: 400 });
  }

  let connectionSecretsEnc: string | null = null;
  if (b.secrets !== undefined && b.secrets !== null) {
    if (typeof b.secrets !== "object" || Array.isArray(b.secrets)) {
      return NextResponse.json({ error: "secrets must be an object of string values or null" }, { status: 400 });
    }
    try {
      connectionSecretsEnc = mergeConnectionSecretsEnc(
        null,
        b.secrets as Record<string, string>,
        connectionType as "source" | "destination",
        connector.trim()
      );
    } catch {
      return NextResponse.json(
        { error: "Could not encrypt secrets — set ELTPULSE_TOKEN_ENCRYPTION_KEY on the server" },
        { status: 503 }
      );
    }
  }

  const row = await db.connection.create({
    data: {
      userId: workspaceResourceUserId(perms, auth.user.id),
      name: name.trim(),
      connectionType: connectionType as "source" | "destination",
      connector: connector.trim(),
      config: (config && typeof config === "object" && !Array.isArray(config)
        ? config
        : {}) as Prisma.InputJsonValue,
      connectionSecretsEnc,
    },
  });

  return NextResponse.json({ connection: toPublicConnection(row) }, { status: 201 });
}
