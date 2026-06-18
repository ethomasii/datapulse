import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import {
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { filterCatalogEntriesByVisibility } from "@/lib/auth/catalog-access";
import { getAccessibleResourceOwnerIds, pipelineOwnerWhere } from "@/lib/auth/workspace-access";
import {
  assertCanEditCatalog,
  hasCatalogReadScope,
  hasCatalogWriteScope,
} from "@/lib/auth/workspace-auth-helpers";
import { getWorkspacePermissions, workspaceResourceUserId } from "@/lib/auth/org-permissions";
import { db } from "@/lib/db/client";
import { parseTags } from "@/lib/elt/catalog-entries";

export async function GET(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasCatalogReadScope(auth)) return scopeForbiddenResponse();

  const pipelineId = new URL(req.url).searchParams.get("pipelineId")?.trim() || undefined;
  const q = new URL(req.url).searchParams.get("q")?.trim().toLowerCase() || "";
  const perms = await getWorkspacePermissions(auth.user.id);
  const ownerIds = await getAccessibleResourceOwnerIds(auth.user.id);

  const rows = await db.catalogEntry.findMany({
    where: {
      userId: { in: ownerIds },
      ...(pipelineId ? { pipelineId } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  const visible = filterCatalogEntriesByVisibility(rows, perms.catalogVisibility);

  const entries = q
    ? visible.filter((row) => {
        const tags = parseTags(row.tags);
        const hay = [
          row.assetKey,
          row.displayName ?? "",
          row.description ?? "",
          row.kind,
          ...tags,
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
    : visible;

  return NextResponse.json({
    entries,
    permissions: {
      canEditCatalog: perms.canEditCatalog,
      catalogVisibility: perms.catalogVisibility,
    },
  });
}

const patchSchema = z.object({
  assetKey: z.string().min(1).max(512),
  kind: z.string().max(64).optional(),
  displayName: z.string().max(256).nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
  tags: z.array(z.string().max(64)).max(32).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  pipelineId: z.string().nullable().optional(),
  certified: z.boolean().optional(),
});

export async function PUT(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasCatalogWriteScope(auth)) return scopeForbiddenResponse();

  const denied = await assertCanEditCatalog(auth.user.id);
  if (denied) return denied;

  const body = patchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const perms = await getWorkspacePermissions(auth.user.id);
  const resourceUserId = workspaceResourceUserId(perms, auth.user.id);
  const data = body.data;
  const certifiedPatch =
    data.certified === true
      ? { certifiedAt: new Date(), certifiedById: auth.user.id }
      : data.certified === false
        ? { certifiedAt: null, certifiedById: null }
        : {};

  const row = await db.catalogEntry.upsert({
    where: {
      userId_assetKey: { userId: resourceUserId, assetKey: data.assetKey },
    },
    create: {
      userId: resourceUserId,
      assetKey: data.assetKey,
      kind: data.kind ?? "asset",
      displayName: data.displayName ?? null,
      description: data.description ?? null,
      tags: data.tags ?? [],
      metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
      pipelineId: data.pipelineId ?? null,
      ...certifiedPatch,
    },
    update: {
      ...(data.kind !== undefined ? { kind: data.kind } : {}),
      ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.tags !== undefined ? { tags: data.tags } : {}),
      ...(data.metadata !== undefined ? { metadata: data.metadata as Prisma.InputJsonValue } : {}),
      ...(data.pipelineId !== undefined ? { pipelineId: data.pipelineId } : {}),
      ...certifiedPatch,
    },
  });

  return NextResponse.json({ entry: row });
}

export async function POST(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasCatalogWriteScope(auth)) return scopeForbiddenResponse();

  const denied = await assertCanEditCatalog(auth.user.id);
  if (denied) return denied;

  const url = new URL(req.url);
  if (url.searchParams.get("action") !== "import") {
    return NextResponse.json({ error: "Use POST ?action=import" }, { status: 400 });
  }

  const { catalogEntriesFromAssets } = await import("@/lib/elt/catalog-entries");
  const { parseCatalogMetadata } = await import("@/lib/elt/catalog-metadata");
  const { catalogImportMetadataPatch } = await import("@/lib/elt/asset-technical-profile");
  const { buildWorkspaceAssets } = await import("@/lib/elt/pipeline-assets");

  const perms = await getWorkspacePermissions(auth.user.id);
  const resourceUserId = workspaceResourceUserId(perms, auth.user.id);
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
  const patches = catalogEntriesFromAssets(resourceUserId, payload);
  const bundleByPipelineId = new Map(payload.pipelines.map((b) => [b.pipelineId, b]));
  const existingRows = await db.catalogEntry.findMany({
    where: { userId: resourceUserId, assetKey: { in: patches.map((p) => p.assetKey) } },
  });
  const existingByKey = new Map(existingRows.map((r) => [r.assetKey, r]));

  let imported = 0;
  for (const patch of patches) {
    const existing = existingByKey.get(patch.assetKey);
    const existingMeta = parseCatalogMetadata(existing?.metadata);
    const bundle = patch.pipelineId ? bundleByPipelineId.get(patch.pipelineId) : undefined;
    const asset =
      bundle &&
      [bundle.source, ...bundle.rawAssets, ...bundle.transforms, ...bundle.postTransforms].find(
        (a) => a.id === patch.assetKey
      );
    const metadata =
      asset && bundle
        ? catalogImportMetadataPatch(existingMeta, asset, bundle)
        : (patch.metadata ?? existingMeta);

    await db.catalogEntry.upsert({
      where: { userId_assetKey: { userId: resourceUserId, assetKey: patch.assetKey } },
      create: {
        userId: resourceUserId,
        assetKey: patch.assetKey,
        kind: patch.kind ?? "asset",
        displayName: patch.displayName ?? null,
        pipelineId: patch.pipelineId ?? null,
        importedAt: new Date(),
        tags: [],
        metadata: metadata as Prisma.InputJsonValue,
      },
      update: {
        displayName: patch.displayName ?? undefined,
        pipelineId: patch.pipelineId ?? undefined,
        importedAt: new Date(),
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
    imported += 1;
  }

  return NextResponse.json({ imported, pipelines: rows.length });
}
