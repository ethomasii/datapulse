import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { getCurrentDbUser } from "@/lib/auth/server";
import {
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { canAccessAiAssistant } from "@/lib/plans/plan-enforcement";
import { isPublicCatalogTags } from "@/lib/auth/catalog-access";
import { connectionOwnerWhere, getAccessibleResourceOwnerIds, pipelineOwnerWhere } from "@/lib/auth/workspace-access";
import {
  hasCatalogReadScope,
} from "@/lib/auth/workspace-auth-helpers";
import { getWorkspacePermissions, workspaceResourceUserId } from "@/lib/auth/org-permissions";
import { getAnthropic } from "@/lib/ai/anthropic";
import { db } from "@/lib/db/client";
import { buildAssetTechnicalProfile } from "@/lib/elt/asset-technical-profile";
import {
  buildAssetAiContextBlock,
  buildCatalogOverviewContextBlock,
} from "@/lib/elt/catalog-ai-context";
import { mergeCatalogIntoAssetsPayload, parseTags } from "@/lib/elt/catalog-entries";
import { parseCatalogMetadata } from "@/lib/elt/catalog-metadata";
import { buildWorkspaceAssets } from "@/lib/elt/pipeline-assets";
import { fetchWarehouseColumnsForAsset } from "@/lib/elt/warehouse-column-introspect";
import { sampleAssetData } from "@/lib/elt/warehouse-readonly-query";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 2048;

const bodySchema = z.object({
  action: z.enum(["generate_description", "ask"]),
  assetKey: z.string().max(512).optional(),
  question: z.string().min(1).max(4000).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      })
    )
    .max(20)
    .optional(),
  save: z.boolean().optional(),
  includeDataSample: z.boolean().optional(),
});

async function loadAssetContext(userId: string, assetKey: string) {
  const ownerIds = await getAccessibleResourceOwnerIds(userId);
  const perms = await getWorkspacePermissions(userId);

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
      destinationConnectionId: true,
      updatedAt: true,
    },
  });

  const catalogRows = await db.catalogEntry.findMany({ where: { userId: { in: ownerIds } } });
  const entriesByKey = new Map(catalogRows.map((r) => [r.assetKey, r]));
  let payload = mergeCatalogIntoAssetsPayload(buildWorkspaceAssets(rows), entriesByKey);

  if (perms.catalogVisibility === "public_only") {
    const visibleAssets = payload.assets.filter((a) => isPublicCatalogTags(a.catalogTags));
    const visiblePipelineIds = new Set(visibleAssets.map((a) => a.pipelineId));
    payload = {
      ...payload,
      assets: visibleAssets,
      pipelines: payload.pipelines.filter((b) => visiblePipelineIds.has(b.pipelineId)),
    };
  }

  const asset = payload.assets.find((a) => a.id === assetKey);
  if (!asset) return null;
  const bundle = payload.pipelines.find((b) => b.pipelineId === asset.pipelineId);
  if (!bundle) return null;

  const catalogRow = entriesByKey.get(asset.id);
  const catalogMetadata = parseCatalogMetadata(catalogRow?.metadata);

  let warehouseColumns: Awaited<ReturnType<typeof fetchWarehouseColumnsForAsset>>["columns"] = [];
  const pipelineRow = rows.find((r) => r.id === asset.pipelineId);
  if (pipelineRow?.destinationConnectionId) {
    const conn = await db.connection.findFirst({
      where: { id: pipelineRow.destinationConnectionId, ...connectionOwnerWhere(ownerIds) },
      select: { id: true, connector: true, config: true, connectionSecretsEnc: true },
    });
    if (conn) {
      const result = await fetchWarehouseColumnsForAsset(conn, asset.landingQualified);
      warehouseColumns = result.columns;
    }
  }

  const profile = buildAssetTechnicalProfile(asset, bundle, catalogMetadata, warehouseColumns);

  let dataSample: Awaited<ReturnType<typeof sampleAssetData>> | undefined;
  if (pipelineRow?.destinationConnectionId && asset.landingQualified) {
    const conn = await db.connection.findFirst({
      where: { id: pipelineRow.destinationConnectionId, ...connectionOwnerWhere(ownerIds) },
      select: { id: true, connector: true, config: true, connectionSecretsEnc: true },
    });
    if (conn) {
      dataSample = await sampleAssetData(conn, asset.landingQualified, 5);
    }
  }

  const glossaryLinks = await db.glossaryTermLink.findMany({
    where: { assetKey: asset.id },
    include: { term: true },
    take: 20,
  });

  return { asset, bundle, profile, catalogRow, perms, dataSample, glossaryLinks };
}

async function loadCatalogOverview(userId: string) {
  const ownerIds = await getAccessibleResourceOwnerIds(userId);
  const perms = await getWorkspacePermissions(userId);
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
  const catalogRows = await db.catalogEntry.findMany({ where: { userId: { in: ownerIds } } });
  const entriesByKey = new Map(catalogRows.map((r) => [r.assetKey, r]));
  let payload = mergeCatalogIntoAssetsPayload(buildWorkspaceAssets(rows), entriesByKey);

  if (perms.catalogVisibility === "public_only") {
    payload = {
      ...payload,
      assets: payload.assets.filter((a) => isPublicCatalogTags(a.catalogTags)),
      pipelines: payload.pipelines.filter((b) =>
        payload.assets.some((a) => a.pipelineId === b.pipelineId)
      ),
    };
  }

  return {
    perms,
    block: buildCatalogOverviewContextBlock({
      pipelineCount: payload.pipelines.length,
      assetCount: payload.assets.length,
      sampleAssets: payload.assets.map((a) => ({
        id: a.id,
        kind: a.kind,
        displayName: a.catalogDisplayName ?? a.displayName,
        pipelineName: a.pipelineName,
      })),
    }),
  };
}

export async function POST(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasCatalogReadScope(auth)) return scopeForbiddenResponse();

  const dbUser = await getCurrentDbUser();
  const planCheck = canAccessAiAssistant(dbUser?.subscription ?? null);
  if (!planCheck.allowed) {
    return NextResponse.json(
      { error: planCheck.reason, upgradeRequired: planCheck.upgradeRequired },
      { status: 403 }
    );
  }

  const anthropic = getAnthropic();
  if (!anthropic) {
    return NextResponse.json(
      { error: "AI is not configured. Set ANTHROPIC_API_KEY on the server." },
      { status: 503 }
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const perms = await getWorkspacePermissions(auth.user.id);

  if (body.action === "generate_description") {
    if (!body.assetKey) {
      return NextResponse.json({ error: "assetKey is required" }, { status: 400 });
    }

    const ctx = await loadAssetContext(auth.user.id, body.assetKey);
    if (!ctx) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

    const contextBlock = buildAssetAiContextBlock(ctx.asset, ctx.bundle, ctx.profile, {
      dataSample: ctx.dataSample,
      glossaryTerms: ctx.glossaryLinks.map((l) => ({
        term: l.term.term,
        definition: l.term.definition,
        columnName: l.columnName,
      })),
    });

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: `You write concise data catalog documentation for analytics and data consumers.
Write 2-4 sentences describing what this asset is, where data comes from, typical usage, and key columns when known.
Use live data samples when provided to mention representative values. Do not invent columns not in context. Plain text only.`,
      messages: [
        {
          role: "user",
          content: `Generate a catalog description for this asset:\n\n${contextBlock}`,
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    if (!text) {
      return NextResponse.json({ error: "AI returned empty response" }, { status: 502 });
    }

    const shouldSave = body.save !== false && perms.canEditCatalog;
    if (shouldSave) {
      const resourceUserId = workspaceResourceUserId(perms, auth.user.id);
      const existingMeta = parseCatalogMetadata(ctx.catalogRow?.metadata);
      await db.catalogEntry.upsert({
        where: { userId_assetKey: { userId: resourceUserId, assetKey: body.assetKey } },
        create: {
          userId: resourceUserId,
          assetKey: body.assetKey,
          kind: ctx.asset.kind,
          displayName: ctx.asset.catalogDisplayName ?? ctx.asset.displayName,
          pipelineId: ctx.asset.pipelineId,
          description: text,
          tags: [],
          metadata: {
            ...existingMeta,
            aiGeneratedAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
        update: {
          description: text,
          metadata: {
            ...existingMeta,
            aiGeneratedAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
      });
    }

    return NextResponse.json({
      description: text,
      saved: shouldSave,
    });
  }

  const question = body.question?.trim();
  if (!question) {
    return NextResponse.json({ error: "question is required for ask" }, { status: 400 });
  }

  let contextBlock: string;
  let dataSampleBlock = "";
  if (body.assetKey) {
    const ctx = await loadAssetContext(auth.user.id, body.assetKey);
    if (!ctx) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    if (body.includeDataSample !== false && ctx.dataSample?.ok) {
      dataSampleBlock = `\n## Live data sample (${ctx.dataSample.rowCount} rows)\n${JSON.stringify(ctx.dataSample.rows.slice(0, 5), null, 2)}`;
    }
    contextBlock = buildAssetAiContextBlock(ctx.asset, ctx.bundle, ctx.profile, {
      dataSample: ctx.dataSample,
      glossaryTerms: ctx.glossaryLinks.map((l) => ({
        term: l.term.term,
        definition: l.term.definition,
        columnName: l.columnName,
      })),
    });
  } else {
    const overview = await loadCatalogOverview(auth.user.id);
    contextBlock = overview.block;
  }

  const history = (body.messages ?? []).slice(-10);
  const messages: { role: "user" | "assistant"; content: string }[] = [
    ...history,
    {
      role: "user",
      content: `${question}\n\n---\nContext:\n${contextBlock}${dataSampleBlock}`,
    },
  ];

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: `You are the eltPulse catalog assistant. Answer questions about data assets, pipelines, columns, lineage, and sampled row data using the provided context.
When live data samples are included, you may cite specific values from them. For analytical questions beyond the sample, explain what query would answer it.
If the context lacks information, say what is known and suggest running the pipeline or refreshing warehouse schema.
Be concise — 1-3 short paragraphs max. No emojis.`,
    messages,
  });

  const answer = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();

  return NextResponse.json({ answer });
}
