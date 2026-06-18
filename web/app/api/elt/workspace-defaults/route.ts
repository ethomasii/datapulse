import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth/server";
import { getActiveOrganizationForSession } from "@/lib/auth/active-org";
import { getWorkspacePermissions } from "@/lib/auth/org-permissions";
import { db } from "@/lib/db/client";
import { prismaSchemaDriftResponse } from "@/lib/db/prisma-schema-drift-response";
import { loadWorkspaceDefaults } from "@/lib/elt/workspace-default-destination";

const patchSchema = z.object({
  defaultDestinationConnectionId: z.string().min(1).nullable(),
});

/**
 * GET /api/elt/workspace-defaults — default destination for `destination: @workspace` pipelines.
 * PATCH — set or clear workspace default destination connection id.
 */
export async function GET() {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const defaults = await loadWorkspaceDefaults(user.id);
    return NextResponse.json({
      defaultDestinationConnectionId: defaults.defaultDestinationConnectionId,
      defaultDestinationConnector: defaults.defaultDestinationConnector,
      defaultDestinationName: defaults.defaultDestinationName,
    });
  } catch (e) {
    const drift = prismaSchemaDriftResponse(e);
    if (drift) return drift;
    throw e;
  }
}

export async function PATCH(req: Request) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perms = await getWorkspacePermissions(user.id);
  if (!perms.canWrite) {
    return NextResponse.json({ error: "View-only access" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const ownerId = perms.resourceOwnerIds[0] ?? user.id;
  const connectionId = parsed.data.defaultDestinationConnectionId;

  if (connectionId) {
    const conn = await db.connection.findFirst({
      where: { id: connectionId, userId: ownerId, connectionType: "destination" },
      select: { id: true },
    });
    if (!conn) {
      return NextResponse.json({ error: "Invalid destination connection" }, { status: 400 });
    }
  }

  try {
    const sessionOrg = await getActiveOrganizationForSession();
    const orgRow =
      sessionOrg != null
        ? await db.organization.findFirst({
            where: {
              id: sessionOrg.id,
              OR: [{ ownerUserId: user.id }, { members: { some: { id: user.id } } }],
            },
            select: { id: true },
          })
        : null;

    if (orgRow) {
      await db.organization.update({
        where: { id: orgRow.id },
        data: { defaultDestinationConnectionId: connectionId },
      });
    } else {
      await db.user.update({
        where: { id: ownerId },
        data: { defaultDestinationConnectionId: connectionId },
      });
    }

    const defaults = await loadWorkspaceDefaults(user.id);
    return NextResponse.json({
      defaultDestinationConnectionId: defaults.defaultDestinationConnectionId,
      defaultDestinationConnector: defaults.defaultDestinationConnector,
      defaultDestinationName: defaults.defaultDestinationName,
    });
  } catch (e) {
    const drift = prismaSchemaDriftResponse(e);
    if (drift) return drift;
    throw e;
  }
}
