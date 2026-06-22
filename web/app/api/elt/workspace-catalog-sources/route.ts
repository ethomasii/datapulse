import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth/server";
import { getActiveOrganizationForSession } from "@/lib/auth/active-org";
import { getWorkspacePermissions } from "@/lib/auth/org-permissions";
import { db } from "@/lib/db/client";
import { prismaSchemaDriftResponse } from "@/lib/db/prisma-schema-drift-response";
import { parseCatalogSource } from "@/lib/elt/component-packages/catalog-sources";
import {
  loadWorkspaceCatalogUrls,
  validateCatalogUrlList,
} from "@/lib/elt/workspace-catalog-sources";

const patchSchema = z.object({
  componentCatalogUrls: z.array(z.string().max(512)).max(20),
});

/**
 * GET /api/elt/workspace-catalog-sources — BYO component catalog repos for this workspace.
 * PATCH — set or clear workspace catalog URLs (org row when in org session, else user).
 */
export async function GET() {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const urls = await loadWorkspaceCatalogUrls(user.id);
    const resolved = urls
      .map((u) => parseCatalogSource(u))
      .filter(Boolean)
      .map((s) => ({ id: s!.id, rawBase: s!.rawBase, branch: s!.branch }));
    return NextResponse.json({ componentCatalogUrls: urls, resolved });
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

  const validated = validateCatalogUrlList(parsed.data.componentCatalogUrls);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const ownerId = perms.resourceOwnerIds[0] ?? user.id;

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
        data: { componentCatalogUrls: validated.urls },
      });
    } else {
      await db.user.update({
        where: { id: ownerId },
        data: { componentCatalogUrls: validated.urls },
      });
    }

    const urls = await loadWorkspaceCatalogUrls(user.id);
    const resolved = urls
      .map((u) => parseCatalogSource(u))
      .filter(Boolean)
      .map((s) => ({ id: s!.id, rawBase: s!.rawBase, branch: s!.branch }));
    return NextResponse.json({ componentCatalogUrls: urls, resolved });
  } catch (e) {
    const drift = prismaSchemaDriftResponse(e);
    if (drift) return drift;
    throw e;
  }
}
