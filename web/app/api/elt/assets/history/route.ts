import { NextResponse } from "next/server";
import {
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { getAccessibleResourceOwnerIds, pipelineOwnerWhere } from "@/lib/auth/workspace-access";
import { hasCatalogReadScope } from "@/lib/auth/workspace-auth-helpers";
import { db } from "@/lib/db/client";
import {
  buildAssetActivityEvents,
  buildAssetMetricsTimeSeries,
  buildAssetRunHistory,
  buildAssetSliceRows,
} from "@/lib/elt/asset-run-history";
import { mergeCatalogIntoAssetsPayload } from "@/lib/elt/catalog-entries";
import { buildWorkspaceAssets } from "@/lib/elt/pipeline-assets";
import { getGithubAccessTokenForUser } from "@/lib/integrations/github-access-token";
import { fetchPipelineGithubHistory } from "@/lib/elt/asset-pipeline-github-history";

export async function GET(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasCatalogReadScope(auth)) return scopeForbiddenResponse();

  const url = new URL(req.url);
  const assetKey = url.searchParams.get("assetKey")?.trim();
  if (!assetKey) {
    return NextResponse.json({ error: "assetKey required" }, { status: 400 });
  }

  const windowDays = Math.min(90, Math.max(7, Number(url.searchParams.get("days") ?? 30) || 30));
  const ownerIds = await getAccessibleResourceOwnerIds(auth.user.id);
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

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
  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const pipeline = pipelines.find((p) => p.id === asset.pipelineId);
  const sc = (pipeline?.sourceConfiguration ?? {}) as Record<string, unknown>;
  const partitionConfig = sc._partitionConfig ?? null;

  const runs = await db.eltPipelineRun.findMany({
    where: {
      pipelineId: asset.pipelineId,
      userId: { in: ownerIds },
      startedAt: { gte: since },
    },
    orderBy: { startedAt: "desc" },
    take: 200,
    select: {
      id: true,
      status: true,
      environment: true,
      startedAt: true,
      finishedAt: true,
      triggeredBy: true,
      partitionColumn: true,
      partitionValue: true,
      telemetry: true,
      logEntries: true,
    },
  });

  const history = buildAssetRunHistory(asset, runs);
  const metrics = buildAssetMetricsTimeSeries(history, windowDays);
  const slices = buildAssetSliceRows(runs);

  const catalogEntry = catalogRows.find((r) => r.assetKey === assetKey);
  const comments = await db.catalogAssetComment.findMany({
    where: { assetKey, parentId: null },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, body: true, authorName: true, createdAt: true },
  });

  const githubCommits = pipeline
    ? await fetchPipelineGithubHistory(auth.user.id, pipeline.name, 12)
    : [];
  const githubConnected = Boolean(await getGithubAccessTokenForUser(auth.user.id));

  const activity = buildAssetActivityEvents({
    history,
    catalogUpdatedAt: catalogEntry?.updatedAt.toISOString() ?? null,
    catalogDescription: catalogEntry?.description,
    comments,
    githubCommits,
  });

  return NextResponse.json({
    assetKey,
    pipelineId: asset.pipelineId,
    pipelineName: asset.pipelineName,
    windowDays,
    partitionConfig,
    runHistory: history,
    metrics,
    slices,
    activity,
    github: {
      connected: githubConnected,
      commits: githubCommits,
      pipelineYamlPath: pipeline ? `eltpulse/pipelines/${pipeline.name}.yaml` : null,
    },
  });
}
