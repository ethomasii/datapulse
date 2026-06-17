import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { testConnection } from "@/lib/elt/test-connection";
import { getAccessibleResourceOwnerIds } from "@/lib/auth/workspace-access";
import { resolveRouteParamId } from "@/lib/server/route-params";

type Ctx = { params: { id: string } | Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = await resolveRouteParamId(ctx.params);
  const ownerIds = await getAccessibleResourceOwnerIds(user.id);
  const row = await db.connection.findFirst({
    where: { id, userId: { in: ownerIds } },
    select: {
      connectionType: true,
      connector: true,
      config: true,
      connectionSecretsEnc: true,
    },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await testConnection({
    connectionType: row.connectionType as "source" | "destination",
    connector: row.connector,
    config: (row.config ?? {}) as Record<string, unknown>,
    connectionSecretsEnc: row.connectionSecretsEnc,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
