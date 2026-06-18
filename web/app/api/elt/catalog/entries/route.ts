import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import {
  API_SCOPES,
  hasScope,
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { getAccessibleResourceOwnerIds } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db/client";
export async function GET(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.PIPELINES_READ)) return scopeForbiddenResponse();

  const pipelineId = new URL(req.url).searchParams.get("pipelineId")?.trim() || undefined;
  const ownerIds = await getAccessibleResourceOwnerIds(auth.user.id);

  const rows = await db.catalogEntry.findMany({
    where: {
      userId: { in: ownerIds },
      ...(pipelineId ? { pipelineId } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ entries: rows });
}

const patchSchema = z.object({
  assetKey: z.string().min(1).max(512),
  kind: z.string().max(64).optional(),
  displayName: z.string().max(256).nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
  tags: z.array(z.string().max(64)).max(32).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  pipelineId: z.string().nullable().optional(),
});

export async function PUT(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.PIPELINES_WRITE)) return scopeForbiddenResponse();

  const body = patchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const data = body.data;
  const row = await db.catalogEntry.upsert({
    where: {
      userId_assetKey: { userId: auth.user.id, assetKey: data.assetKey },
    },
    create: {
      userId: auth.user.id,
      assetKey: data.assetKey,
      kind: data.kind ?? "asset",
      displayName: data.displayName ?? null,
      description: data.description ?? null,
      tags: data.tags ?? [],
      metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
      pipelineId: data.pipelineId ?? null,
    },
    update: {
      ...(data.kind !== undefined ? { kind: data.kind } : {}),
      ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.tags !== undefined ? { tags: data.tags } : {}),
      ...(data.metadata !== undefined ? { metadata: data.metadata as Prisma.InputJsonValue } : {}),
      ...(data.pipelineId !== undefined ? { pipelineId: data.pipelineId } : {}),
    },
  });

  return NextResponse.json({ entry: row });
}

export async function POST(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.PIPELINES_WRITE)) return scopeForbiddenResponse();

  const url = new URL(req.url);
  if (url.searchParams.get("action") !== "import") {
    return NextResponse.json({ error: "Use POST ?action=import" }, { status: 400 });
  }

  const { catalogEntriesFromAssets } = await import("@/lib/elt/catalog-entries");
  const { buildWorkspaceAssets } = await import("@/lib/elt/pipeline-assets");
  const { pipelineOwnerWhere } = await import("@/lib/auth/workspace-access");

  const ownerIds = await getAccessibleResourceOwnerIds(auth.user.id);
  const rows = await db.eltPipeline.findMany({
    where: pipelineOwnerWhere(ownerIds),
    select: {
      id: true,
      name: true,
      tool: true,
      enabled: true,
      sourceType: true,
      destinationType: true,
      sourceConfiguration: true,
      updatedAt: true,
    },
  });
  const payload = buildWorkspaceAssets(rows);
  const patches = catalogEntriesFromAssets(auth.user.id, payload);
  let imported = 0;
  for (const patch of patches) {
    await db.catalogEntry.upsert({
      where: { userId_assetKey: { userId: auth.user.id, assetKey: patch.assetKey } },
      create: {
        userId: auth.user.id,
        assetKey: patch.assetKey,
        kind: patch.kind ?? "asset",
        displayName: patch.displayName ?? null,
        pipelineId: patch.pipelineId ?? null,
        importedAt: new Date(),
        tags: [],
        metadata: {},
      },
      update: {
        displayName: patch.displayName ?? undefined,
        pipelineId: patch.pipelineId ?? undefined,
        importedAt: new Date(),
      },
    });
    imported += 1;
  }

  return NextResponse.json({ imported, pipelines: rows.length });
}
