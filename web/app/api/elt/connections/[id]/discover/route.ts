import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { getAccessibleResourceOwnerIds } from "@/lib/auth/workspace-access";
import { discoverSource } from "@/lib/elt/source-discover";
import { resolveRouteParamId } from "@/lib/server/route-params";

type Ctx = { params: { id: string } | Promise<{ id: string }> };

/** GET /api/elt/connections/:id/discover */
export async function GET(req: Request, ctx: Ctx) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const discoverPhaseRaw = url.searchParams.get("phase");
  const discoverPhase =
    discoverPhaseRaw === "repos" || discoverPhaseRaw === "resources" ? discoverPhaseRaw : undefined;

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

  const result = await discoverSource({
    connectionType: row.connectionType as "source" | "destination",
    connector: row.connector,
    config: (row.config ?? {}) as Record<string, unknown>,
    connectionSecretsEnc: row.connectionSecretsEnc,
    discoverPhase,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
