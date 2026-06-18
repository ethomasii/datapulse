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

  const q = new URL(req.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  const ownerIds = await getAccessibleResourceOwnerIds(auth.user.id);

  const terms = await db.glossaryTerm.findMany({
    where: { userId: { in: ownerIds } },
    orderBy: { term: "asc" },
    include: { links: true },
  });

  const filtered = q
    ? terms.filter((t) => {
        const hay = [t.term, t.definition, ...((t.aliases as string[]) ?? [])].join(" ").toLowerCase();
        return hay.includes(q);
      })
    : terms;

  return NextResponse.json({ terms: filtered });
}

const upsertSchema = z.object({
  term: z.string().min(1).max(128),
  definition: z.string().min(1).max(8000),
  aliases: z.array(z.string().max(64)).max(16).optional(),
  links: z
    .array(z.object({ assetKey: z.string().max(512), columnName: z.string().max(256).nullable().optional() }))
    .max(50)
    .optional(),
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

  const row = await db.glossaryTerm.upsert({
    where: { userId_term: { userId: resourceUserId, term: body.term } },
    create: {
      userId: resourceUserId,
      term: body.term,
      definition: body.definition,
      aliases: body.aliases ?? [],
    },
    update: {
      definition: body.definition,
      ...(body.aliases !== undefined ? { aliases: body.aliases } : {}),
    },
  });

  if (body.links) {
    await db.glossaryTermLink.deleteMany({ where: { termId: row.id } });
    await db.glossaryTermLink.createMany({
      data: body.links.map((l) => ({
        termId: row.id,
        assetKey: l.assetKey,
        columnName: l.columnName ?? null,
      })),
    });
  }

  const full = await db.glossaryTerm.findUnique({ where: { id: row.id }, include: { links: true } });
  return NextResponse.json({ term: full });
}

export async function DELETE(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasCatalogWriteScope(auth)) return scopeForbiddenResponse();
  const denied = await assertCanEditCatalog(auth.user.id);
  if (denied) return denied;

  const term = new URL(req.url).searchParams.get("term")?.trim();
  if (!term) return NextResponse.json({ error: "term required" }, { status: 400 });

  const perms = await getWorkspacePermissions(auth.user.id);
  const resourceUserId = workspaceResourceUserId(perms, auth.user.id);
  await db.glossaryTerm.deleteMany({ where: { userId: resourceUserId, term } });
  return NextResponse.json({ ok: true });
}
