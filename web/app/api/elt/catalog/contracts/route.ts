import { NextResponse } from "next/server";
import { z } from "zod";
import {
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { getAccessibleResourceOwnerIds, pipelineOwnerWhere } from "@/lib/auth/workspace-access";
import {
  assertCanEditCatalog,
  hasCatalogReadScope,
  hasCatalogWriteScope,
} from "@/lib/auth/workspace-auth-helpers";
import { getWorkspacePermissions, workspaceResourceUserId } from "@/lib/auth/org-permissions";
import { db } from "@/lib/db/client";
import { evaluateContractCompliance, parseContractSchemaSpec } from "@/lib/elt/data-contract";
import { mergeCatalogIntoAssetsPayload } from "@/lib/elt/catalog-entries";
import { parseCatalogMetadata } from "@/lib/elt/catalog-metadata";
import { buildWorkspaceAssets } from "@/lib/elt/pipeline-assets";
import { buildAssetTechnicalProfile } from "@/lib/elt/asset-technical-profile";

export async function GET(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasCatalogReadScope(auth)) return scopeForbiddenResponse();

  const assetKey = new URL(req.url).searchParams.get("assetKey")?.trim();
  const ownerIds = await getAccessibleResourceOwnerIds(auth.user.id);

  const contracts = await db.dataContract.findMany({
    where: { userId: { in: ownerIds } },
    orderBy: { updatedAt: "desc" },
    include: { assets: true, products: { select: { id: true, slug: true, name: true } } },
  });

  if (!assetKey) {
    return NextResponse.json({ contracts });
  }

  const linked = contracts.filter((c) => c.assets.some((a) => a.assetKey === assetKey));
  if (!linked.length) {
    return NextResponse.json({ contracts: linked, compliance: null });
  }

  const pipelines = await db.eltPipeline.findMany({
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
  const catalogRows = await db.catalogEntry.findMany({ where: { userId: { in: ownerIds } } });
  const payload = mergeCatalogIntoAssetsPayload(
    buildWorkspaceAssets(pipelines),
    new Map(catalogRows.map((r) => [r.assetKey, r]))
  );
  const asset = payload.assets.find((a) => a.id === assetKey);
  const bundle = asset ? payload.pipelines.find((b) => b.pipelineId === asset.pipelineId) : undefined;
  const entry = catalogRows.find((r) => r.assetKey === assetKey);
  const profile =
    asset && bundle
      ? buildAssetTechnicalProfile(asset, bundle, parseCatalogMetadata(entry?.metadata))
      : null;

  const contract = linked[0]!;
  const compliance = evaluateContractCompliance({
    schemaSpec: contract.schemaSpec,
    freshnessSlaHours: contract.freshnessSlaHours,
    lastRunFinishedAt: bundle?.lastRun?.finishedAt ?? null,
    lastRunStatus: bundle?.lastRun?.status ?? null,
    assetColumns: profile?.columns,
  });

  return NextResponse.json({
    contract,
    compliance,
    schemaSpec: parseContractSchemaSpec(contract.schemaSpec),
  });
}

const upsertSchema = z.object({
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(128),
  description: z.string().max(4000).nullable().optional(),
  ownerName: z.string().max(128).nullable().optional(),
  ownerEmail: z.string().max(256).nullable().optional(),
  status: z.enum(["draft", "active", "deprecated"]).optional(),
  freshnessSlaHours: z.number().int().min(1).max(8760).nullable().optional(),
  schemaSpec: z
    .array(
      z.object({
        name: z.string().max(256),
        type: z.string().max(128).optional(),
        required: z.boolean().optional(),
        description: z.string().max(2000).optional(),
      })
    )
    .max(500)
    .optional(),
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

  const row = await db.dataContract.upsert({
    where: { userId_slug: { userId: resourceUserId, slug: body.slug } },
    create: {
      userId: resourceUserId,
      slug: body.slug,
      name: body.name,
      description: body.description ?? null,
      ownerName: body.ownerName ?? null,
      ownerEmail: body.ownerEmail ?? null,
      status: body.status ?? "draft",
      freshnessSlaHours: body.freshnessSlaHours ?? null,
      schemaSpec: body.schemaSpec ?? [],
    },
    update: {
      name: body.name,
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.ownerName !== undefined ? { ownerName: body.ownerName } : {}),
      ...(body.ownerEmail !== undefined ? { ownerEmail: body.ownerEmail } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.freshnessSlaHours !== undefined ? { freshnessSlaHours: body.freshnessSlaHours } : {}),
      ...(body.schemaSpec !== undefined ? { schemaSpec: body.schemaSpec } : {}),
    },
  });

  if (body.assetKeys) {
    await db.dataContractAsset.deleteMany({ where: { contractId: row.id } });
    await db.dataContractAsset.createMany({
      data: body.assetKeys.map((assetKey) => ({ contractId: row.id, assetKey })),
    });
  }

  const full = await db.dataContract.findUnique({
    where: { id: row.id },
    include: { assets: true },
  });

  return NextResponse.json({ contract: full });
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
  await db.dataContract.deleteMany({ where: { userId: resourceUserId, slug } });
  return NextResponse.json({ ok: true });
}
