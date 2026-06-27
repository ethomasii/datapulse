import { NextResponse } from "next/server";
import {
  API_SCOPES,
  hasScope,
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { getWorkspacePermissions } from "@/lib/auth/org-permissions";
import { connectionOwnerWhere } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db/client";
import { testConnection } from "@/lib/elt/test-connection";
import { resolveRouteParamId } from "@/lib/server/route-params";

type Ctx = { params: { id: string } | Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const auth = await resolveApiUser(_req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.CONNECTIONS_READ)) return scopeForbiddenResponse();

  const id = await resolveRouteParamId(ctx.params);
  const ownerIds = (await getWorkspacePermissions(auth.user.id)).resourceOwnerIds;
  const row = await db.connection.findFirst({
    where: { id, ...connectionOwnerWhere(ownerIds) },
    select: {
      connectionType: true,
      connector: true,
      config: true,
      connectionSecretsEnc: true,
    },
  });
  if (!row) {
    return NextResponse.json(
      { ok: false, message: "Connection not found or not accessible in this workspace." },
      { status: 404 }
    );
  }

  const result = await testConnection({
    connectionType: row.connectionType as "source" | "destination",
    connector: row.connector,
    config: (row.config ?? {}) as Record<string, unknown>,
    connectionSecretsEnc: row.connectionSecretsEnc,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
