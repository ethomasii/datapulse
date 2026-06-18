import { NextResponse } from "next/server";
import { z } from "zod";
import {
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { getAccessibleResourceOwnerIds } from "@/lib/auth/workspace-access";
import {
  assertCanEditCatalog,
  hasCatalogReadScope,
  hasCatalogWriteScope,
} from "@/lib/auth/workspace-auth-helpers";
import { getWorkspacePermissions, workspaceResourceUserId } from "@/lib/auth/org-permissions";
import { db } from "@/lib/db/client";

export async function GET(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasCatalogReadScope(auth)) return scopeForbiddenResponse();

  const perms = await getWorkspacePermissions(auth.user.id);
  const ownerIds = await getAccessibleResourceOwnerIds(auth.user.id);

  const collections = await db.catalogCollection.findMany({
    where: { userId: { in: ownerIds } },
    orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({ collections, canEditCatalog: perms.canEditCatalog });
}

const upsertSchema = z.object({
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(128),
  description: z.string().max(4000).nullable().optional(),
  featured: z.boolean().optional(),
  assetKeys: z.array(z.string().max(512)).max(200).optional(),
});

export async function PUT(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasCatalogWriteScope(auth)) return scopeForbiddenResponse();
  const denied = await assertCanEditCatalog(auth.user.id);
  if (denied) return denied;

  let body: z.infer<typeof upsertSchema>;
  try {
    body = upsertSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const perms = await getWorkspacePermissions(auth.user.id);
  const resourceUserId = workspaceResourceUserId(perms, auth.user.id);

  const collection = await db.catalogCollection.upsert({
    where: { userId_slug: { userId: resourceUserId, slug: body.slug } },
    create: {
      userId: resourceUserId,
      slug: body.slug,
      name: body.name,
      description: body.description ?? null,
      featured: body.featured ?? false,
    },
    update: {
      name: body.name,
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.featured !== undefined ? { featured: body.featured } : {}),
    },
  });

  if (body.assetKeys) {
    await db.catalogCollectionItem.deleteMany({ where: { collectionId: collection.id } });
    await db.catalogCollectionItem.createMany({
      data: body.assetKeys.map((assetKey, i) => ({
        collectionId: collection.id,
        assetKey,
        sortOrder: i,
      })),
    });
  }

  const full = await db.catalogCollection.findUnique({
    where: { id: collection.id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({ collection: full });
}

export async function DELETE(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasCatalogWriteScope(auth)) return scopeForbiddenResponse();
  const denied = await assertCanEditCatalog(auth.user.id);
  if (denied) return denied;

  const slug = new URL(req.url).searchParams.get("slug")?.trim();
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const perms = await getWorkspacePermissions(auth.user.id);
  const resourceUserId = workspaceResourceUserId(perms, auth.user.id);

  await db.catalogCollection.deleteMany({ where: { userId: resourceUserId, slug } });
  return NextResponse.json({ ok: true });
}
