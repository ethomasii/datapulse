import { createHmac } from "node:crypto";
import { db } from "@/lib/db/client";
import { parseRunTelemetry } from "@/lib/elt/run-telemetry";
import { dbtFailedTests } from "@/lib/elt/dbt-run-manifest";
import { runSubjectLabel } from "@/lib/elt/run-display";
import type { MetadataStorageMode } from "@prisma/client";

const UA = "eltPulse-Airgap/1";

export type AirgapRunExportPayload = {
  source: "eltpulse";
  schemaVersion: 1;
  exportKind: "run.metadata";
  runId: string;
  organizationId: string;
  event: "run.succeeded" | "run.failed" | "run.cancelled";
  pipelineId: string | null;
  pipelineName: string;
  environment: string;
  status: string;
  correlationId: string;
  errorSummary: string | null;
  startedAt: string;
  finishedAt: string | null;
  ingestionExecutor: string;
  telemetrySummary?: Record<string, unknown>;
  dbtTestFailureCount?: number;
};

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function buildAirgapRunExportPayload(args: {
  run: {
    id: string;
    status: string;
    environment: string;
    correlationId: string;
    errorSummary: string | null;
    startedAt: Date;
    finishedAt: Date | null;
    ingestionExecutor: string;
    telemetry: unknown;
    pipelineId: string | null;
    pipeline: { name: string } | null;
    dbtProject: { name: string } | null;
  };
  organizationId: string;
}): AirgapRunExportPayload | null {
  if (!["succeeded", "failed", "cancelled"].includes(args.run.status)) return null;

  const event =
    args.run.status === "succeeded"
      ? "run.succeeded"
      : args.run.status === "failed"
        ? "run.failed"
        : "run.cancelled";

  const tel = parseRunTelemetry(args.run.telemetry);
  const failures = dbtFailedTests(tel.dbt);
  const hasSummary = Object.keys(tel.summary).length > 0;

  return {
    source: "eltpulse",
    schemaVersion: 1,
    exportKind: "run.metadata",
    runId: args.run.id,
    organizationId: args.organizationId,
    event,
    pipelineId: args.run.pipelineId,
    pipelineName: runSubjectLabel(args.run),
    environment: args.run.environment,
    status: args.run.status,
    correlationId: args.run.correlationId,
    errorSummary: args.run.errorSummary,
    startedAt: args.run.startedAt.toISOString(),
    finishedAt: args.run.finishedAt?.toISOString() ?? null,
    ingestionExecutor: args.run.ingestionExecutor,
    ...(hasSummary ? { telemetrySummary: tel.summary as Record<string, unknown> } : {}),
    ...(failures.length > 0 ? { dbtTestFailureCount: failures.length } : {}),
  };
}

async function deliverAirgapExport(
  url: string,
  payload: AirgapRunExportPayload,
  secret: string | null
): Promise<{ ok: boolean; httpStatus?: number }> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": UA,
    "X-eltPulse-Export-Kind": payload.exportKind,
  };
  if (secret) {
    headers["X-eltPulse-Signature"] = createHmac("sha256", secret).update(body).digest("hex");
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(20_000),
    });
    return { ok: res.ok, httpStatus: res.status };
  } catch {
    return { ok: false };
  }
}

export type AirgapOrgConfig = {
  organizationId: string;
  metadataStorageMode: MetadataStorageMode;
  metadataExportWebhookUrl: string | null;
  metadataExportWebhookSecret: string | null;
};

export async function loadAirgapOrgConfig(organizationId: string): Promise<AirgapOrgConfig | null> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      metadataStorageMode: true,
      metadataExportWebhookUrl: true,
      metadataExportWebhookSecret: true,
    },
  });
  if (!org) return null;
  return {
    organizationId: org.id,
    metadataStorageMode: org.metadataStorageMode,
    metadataExportWebhookUrl: org.metadataExportWebhookUrl,
    metadataExportWebhookSecret: org.metadataExportWebhookSecret,
  };
}

export async function maybeDispatchAirgapMetadataExport(runId: string): Promise<void> {
  const run = await db.eltPipelineRun.findUnique({
    where: { id: runId },
    include: {
      pipeline: { select: { name: true } },
      dbtProject: { select: { name: true } },
    },
  });
  if (!run?.workspaceOrganizationId) return;

  const org = await loadAirgapOrgConfig(run.workspaceOrganizationId);
  if (!org || org.metadataStorageMode !== "customer_export") return;
  if (!org.metadataExportWebhookUrl?.trim()) return;

  const payload = buildAirgapRunExportPayload({
    run,
    organizationId: org.organizationId,
  });
  if (!payload) return;

  const result = await deliverAirgapExport(
    org.metadataExportWebhookUrl.trim(),
    payload,
    org.metadataExportWebhookSecret
  );

  await db.eltPipelineRun.update({
    where: { id: run.id },
    data: {
      airgapExportedAt: new Date(),
      airgapExportStatus: result.ok ? "ok" : `http_${result.httpStatus ?? "error"}`,
    },
  });
}

export async function sendAirgapExportTest(
  org: AirgapOrgConfig
): Promise<{ ok: boolean; httpStatus?: number; error?: string }> {
  const url = org.metadataExportWebhookUrl?.trim();
  if (!url) return { ok: false, error: "Webhook URL required" };

  const payload: AirgapRunExportPayload = {
    source: "eltpulse",
    schemaVersion: 1,
    exportKind: "run.metadata",
    runId: "test_run",
    organizationId: org.organizationId,
    event: "run.succeeded",
    pipelineId: null,
    pipelineName: "airgap-export-test",
    environment: "test",
    status: "succeeded",
    correlationId: `test-${Date.now()}`,
    errorSummary: null,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    ingestionExecutor: "customer_agent",
    telemetrySummary: { rowsLoaded: 0, note: "eltPulse air-gap export connectivity test" },
  };

  const result = await deliverAirgapExport(url, payload, org.metadataExportWebhookSecret);
  if (!result.ok) {
    return {
      ok: false,
      httpStatus: result.httpStatus,
      error: result.httpStatus ? `HTTP ${result.httpStatus}` : "Request failed",
    };
  }
  return { ok: true, httpStatus: result.httpStatus };
}

export function airgapExportDocsUrl(): string {
  return `${appBaseUrl()}/docs/security#air-gap-metadata`;
}
