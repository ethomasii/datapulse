/**
 * After a terminal run, evaluate data contracts for pipeline assets and notify webhooks/Slack.
 */

import { db } from "@/lib/db/client";
import { getAccessibleResourceOwnerIds, pipelineOwnerWhere } from "@/lib/auth/workspace-access";
import { mergeCatalogIntoAssetsPayload } from "@/lib/elt/catalog-entries";
import { parseCatalogMetadata } from "@/lib/elt/catalog-metadata";
import { buildAssetTechnicalProfile } from "@/lib/elt/asset-technical-profile";
import { evaluateContractCompliance } from "@/lib/elt/data-contract";
import { buildWorkspaceAssets } from "@/lib/elt/pipeline-assets";
import { parseRunTelemetry, runTelemetryToJson } from "@/lib/elt/run-telemetry";
import { deliverRunWebhook } from "@/lib/elt/run-webhook";

export type ContractViolation = {
  contractSlug: string;
  contractName: string;
  assetKey: string;
  issues: string[];
};

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

async function notifySlackContractAlert(violations: ContractViolation[], pipelineName: string) {
  const webhook = process.env.SLACK_CATALOG_WEBHOOK_URL?.trim();
  if (!webhook || violations.length === 0) return;
  const lines = violations
    .slice(0, 5)
    .map((v) => `• *${v.contractName}* on \`${v.assetKey.split(":").pop()}\`: ${v.issues[0]}`)
    .join("\n");
  await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `:warning: Data contract violation after pipeline *${pipelineName}* run:\n${lines}`,
    }),
  }).catch(() => undefined);
}

export async function maybeDispatchContractAlerts(runId: string, userId: string): Promise<void> {
  const run = await db.eltPipelineRun.findFirst({
    where: { id: runId, userId },
    include: {
      pipeline: { select: { id: true, name: true, runsWebhookUrl: true } },
      user: { select: { runsWebhookUrl: true } },
    },
  });
  if (!run?.pipelineId || run.status !== "succeeded") return;

  const ownerIds = await getAccessibleResourceOwnerIds(userId);

  const contracts = await db.dataContract.findMany({
    where: { userId: { in: ownerIds }, status: "active" },
    include: { assets: true },
  });
  if (!contracts.length) return;

  const pipelines = await db.eltPipeline.findMany({
    where: { id: run.pipelineId, ...pipelineOwnerWhere(ownerIds) },
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
  if (!pipelines.length) return;

  const catalogRows = await db.catalogEntry.findMany({ where: { userId: { in: ownerIds } } });
  const payload = mergeCatalogIntoAssetsPayload(
    buildWorkspaceAssets(pipelines, new Map([[run.pipelineId, { ...run, pipelineId: run.pipelineId }]])),
    new Map(catalogRows.map((r) => [r.assetKey, r]))
  );
  const bundle = payload.pipelines[0];
  if (!bundle) return;

  const violations: ContractViolation[] = [];

  for (const contract of contracts) {
    for (const link of contract.assets) {
      const asset = payload.assets.find((a) => a.id === link.assetKey && a.pipelineId === run.pipelineId);
      if (!asset) continue;
      const entry = catalogRows.find((r) => r.assetKey === asset.id);
      const profile = buildAssetTechnicalProfile(
        asset,
        bundle,
        parseCatalogMetadata(entry?.metadata)
      );
      const compliance = evaluateContractCompliance({
        schemaSpec: contract.schemaSpec,
        freshnessSlaHours: contract.freshnessSlaHours,
        lastRunFinishedAt: run.finishedAt?.toISOString() ?? run.startedAt.toISOString(),
        lastRunStatus: run.status,
        assetColumns: profile.columns,
      });
      if (!compliance.ok) {
        violations.push({
          contractSlug: contract.slug,
          contractName: contract.name,
          assetKey: asset.id,
          issues: compliance.issues,
        });
      }
    }
  }

  if (!violations.length) return;

  const tel = parseRunTelemetry((run as { telemetry?: unknown }).telemetry);
  if (!tel.contractViolations?.length) {
    await db.eltPipelineRun.update({
      where: { id: runId },
      data: { telemetry: runTelemetryToJson({ ...tel, contractViolations: violations }) },
    });
  }

  const webhookUrl = run.pipeline?.runsWebhookUrl ?? run.user.runsWebhookUrl;
  if (webhookUrl) {
    const tel = parseRunTelemetry((run as { telemetry?: unknown }).telemetry);
    await deliverRunWebhook(webhookUrl, {
      source: "eltpulse",
      event: "catalog.contract_violated",
      correlationId: run.correlationId,
      pipelineId: run.pipelineId,
      pipelineName: run.pipeline?.name ?? "Pipeline",
      environment: run.environment,
      status: run.status,
      errorSummary: null,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      runUrl: `${appBaseUrl()}/runs?run=${run.id}`,
      catalogContractViolations: violations,
      ...(tel.dbt ? { dbtManifest: tel.dbt as Record<string, unknown> } : {}),
    });
  }

  await notifySlackContractAlert(violations, run.pipeline?.name ?? "Pipeline");
}
