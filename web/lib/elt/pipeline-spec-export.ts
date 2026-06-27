import "server-only";

import YAML from "yaml";
import type { EltPipeline } from "@prisma/client";
import {
  WORKSPACE_DESTINATION_REF,
  declarativePipelineSpecSchema,
  type DeclarativePipelineSpec,
} from "@/lib/elt/declarative-pipeline-spec";
import { readMedallionHints } from "@/lib/elt/compile-declarative-pipeline";
import { db } from "@/lib/db/client";

function tablesFromSourceConfig(sourceType: string, cfg: Record<string, unknown>): string[] | undefined {
  const slug = sourceType.toLowerCase();
  if (slug === "github" && Array.isArray(cfg.resources)) {
    return cfg.resources.map(String);
  }
  if (typeof cfg.tables === "string" && cfg.tables.trim()) {
    return cfg.tables.split(",").map((t) => t.trim()).filter(Boolean);
  }
  if (Array.isArray(cfg.table_names)) return cfg.table_names.map(String);
  if (Array.isArray(cfg.resources)) return cfg.resources.map(String);
  return undefined;
}

function syncFromSourceConfig(cfg: Record<string, unknown>): DeclarativePipelineSpec["sync"] | undefined {
  const write = String(cfg.write_disposition ?? "").toLowerCase();
  const incremental = cfg.incremental === true;
  if (write === "replace" && !incremental) {
    return { mode: "full" };
  }
  const cursor =
    typeof cfg.incremental_field === "string"
      ? cfg.incremental_field
      : typeof cfg.cursor_field === "string"
        ? cfg.cursor_field
        : undefined;
  const mode = write === "merge" ? "merge" : "incremental";
  return { mode, ...(cursor ? { cursor } : {}) };
}

function slicesFromSourceConfig(cfg: Record<string, unknown>): DeclarativePipelineSpec["slices"] | undefined {
  const part = cfg._partitionConfig;
  if (!part || typeof part !== "object" || Array.isArray(part)) return undefined;
  const p = part as Record<string, unknown>;
  const column = typeof p.column === "string" ? p.column : undefined;
  if (!column) return undefined;
  const type = String(p.type ?? "date");
  const granularity =
    type === "key" ? "key" : type === "hour" ? "hour" : type === "week" ? "week" : type === "month" ? "month" : "day";
  return { column, granularity };
}

function transformFromSourceConfig(cfg: Record<string, unknown>): DeclarativePipelineSpec["transform"] | undefined {
  const dltDbt = cfg.dlt_dbt;
  if (!dltDbt || typeof dltDbt !== "object" || Array.isArray(dltDbt)) return undefined;
  const d = dltDbt as Record<string, unknown>;
  if (d.enabled === false) return undefined;
  return {
    dbt: {
      enabled: true,
      ...(typeof d.package_path === "string" ? { package_path: d.package_path } : {}),
      ...(typeof d.dataset_name === "string" ? { dataset_name: d.dataset_name } : {}),
      ...(typeof d.repository_branch === "string" ? { repository_branch: d.repository_branch } : {}),
      ...(typeof d.run_scope === "string" ? { run_scope: d.run_scope as "all" | "selection" } : {}),
      ...(typeof d.selector === "string" ? { select: d.selector } : {}),
    },
  };
}

function componentsFromSourceConfig(cfg: Record<string, unknown>): DeclarativePipelineSpec["components"] | undefined {
  const raw = cfg.elt_components;
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return raw as DeclarativePipelineSpec["components"];
}

/** Build v2 declarative spec from a persisted pipeline row (best-effort reverse compile). */
export async function eltPipelineToDeclarativeSpec(
  row: EltPipeline,
  opts?: { destinationRef?: string }
): Promise<DeclarativePipelineSpec> {
  const cfg = { ...(row.sourceConfiguration as Record<string, unknown>) };
  const medallion = readMedallionHints(cfg);

  let destination = opts?.destinationRef ?? row.destinationType;
  if (row.destinationConnectionId && !opts?.destinationRef) {
    const conn = await db.connection.findFirst({
      where: { id: row.destinationConnectionId },
      select: { name: true },
    });
    if (conn) destination = WORKSPACE_DESTINATION_REF;
  }

  let sourceConnection: string | undefined;
  if (row.sourceConnectionId) {
    const conn = await db.connection.findFirst({
      where: { id: row.sourceConnectionId },
      select: { name: true },
    });
    if (conn) sourceConnection = conn.name;
  }

  let destinationConnection: string | undefined;
  if (row.destinationConnectionId) {
    const conn = await db.connection.findFirst({
      where: { id: row.destinationConnectionId },
      select: { name: true },
    });
    if (conn) destinationConnection = conn.name;
  }

  const scheduleEnabled = typeof cfg.schedule_enabled === "boolean" ? cfg.schedule_enabled : undefined;
  const scheduleCron = typeof cfg.cron_schedule === "string" ? cfg.cron_schedule : undefined;
  const scheduleTimezone = typeof cfg.schedule_timezone === "string" ? cfg.schedule_timezone : undefined;

  const spec: DeclarativePipelineSpec = {
    name: row.name,
    source: row.sourceType,
    destination,
    tool: row.tool === "dlt" || row.tool === "sling" ? row.tool : "auto",
    ...(row.description ? { description: row.description } : {}),
    ...(row.groupName ? { groupName: row.groupName } : {}),
    ...(sourceConnection ? { sourceConnection } : {}),
    ...(destinationConnection ? { destinationConnection } : {}),
    ...(tablesFromSourceConfig(row.sourceType, cfg) ? { tables: tablesFromSourceConfig(row.sourceType, cfg) } : {}),
    ...(syncFromSourceConfig(cfg) ? { sync: syncFromSourceConfig(cfg) } : {}),
    ...(slicesFromSourceConfig(cfg) ? { slices: slicesFromSourceConfig(cfg) } : {}),
    ...(transformFromSourceConfig(cfg) ? { transform: transformFromSourceConfig(cfg) } : {}),
    ...(componentsFromSourceConfig(cfg) ? { components: componentsFromSourceConfig(cfg) } : {}),
    medallion,
    ...(scheduleEnabled !== undefined || scheduleCron || scheduleTimezone
      ? {
          schedule: {
            ...(scheduleEnabled !== undefined ? { enabled: scheduleEnabled } : {}),
            ...(scheduleCron ? { cron: scheduleCron } : {}),
            ...(scheduleTimezone ? { timezone: scheduleTimezone } : {}),
          },
        }
      : {}),
    executionHost: row.executionHost,
    ...(row.runsWebhookUrl ? { runsWebhookUrl: row.runsWebhookUrl } : {}),
    ...(row.defaultTargetAgentTokenId ? { defaultTargetAgentTokenId: row.defaultTargetAgentTokenId } : {}),
    ...(row.dbtProjectId ? { dbtProjectId: row.dbtProjectId } : {}),
  };

  return declarativePipelineSpecSchema.parse(spec);
}

/** Serialize pipeline as declarative YAML v2 for GitOps. */
export async function eltPipelineToDeclarativeYamlString(
  row: EltPipeline,
  opts?: { includeDeployments?: boolean; actingUserId?: string }
): Promise<string> {
  const spec = await eltPipelineToDeclarativeSpec(row);
  if (opts?.includeDeployments && opts.actingUserId) {
    const { exportDeploymentBindingsToSpec } = await import("@/lib/elt/deployments");
    const deployments = await exportDeploymentBindingsToSpec(opts.actingUserId, row.id);
    if (deployments) {
      (spec as Record<string, unknown>).deployments = deployments;
    }
  }

  if (row.declarativeSpecYaml?.trim() && !opts?.includeDeployments) {
    return row.declarativeSpecYaml.trimEnd() + "\n";
  }

  const doc: Record<string, unknown> = {
    eltpulse_pipeline: 2,
    upsert: true,
    ...spec,
  };
  return YAML.stringify(doc, { lineWidth: 0 }).trimEnd() + "\n";
}
