/**
 * Config-derived workspace asset inventory — sources, raw landing targets, and transforms
 * inferred from persisted pipeline rows (no warehouse introspection in v1).
 */

import { readDbtTransformConfig } from "@/lib/elt/dbt-run-phases";
import { dbtHubPackageDisplayName, resolveDbtHubPackage } from "@/lib/elt/dbt-hub-packages";
import type { DbtRunManifest } from "@/lib/elt/dbt-run-manifest";
import { generateSlingReplication } from "@/lib/elt/generate-sling";
import {
  pipelineSyncMode,
} from "@/lib/elt/pipeline-tool-labels";
import { parseRunTelemetry } from "@/lib/elt/run-telemetry";
import type { AssetFreshness, AssetFreshnessMeta } from "@/lib/elt/asset-freshness";
import { computePipelineFreshness } from "@/lib/elt/asset-freshness";
import { enrichBundleAssetFreshness, resourcesTouchedFromTelemetry } from "@/lib/elt/asset-level-freshness";
import { computeDbtAssetDiff, type DbtAssetDiff } from "@/lib/elt/asset-dbt-diff";
import { enrichBundleFromDbtManifest } from "@/lib/elt/asset-dbt-enrich";

export type PipelineSyncMode = "connector_sync" | "database_replication";

export type WorkspaceAssetKind = "source" | "raw" | "transform" | "post_transform" | "object";

export type WarehouseAssetStatus = "verified" | "missing" | "unknown" | "not_checked";

export type WorkspaceAsset = {
  id: string;
  kind: WorkspaceAssetKind;
  /** Stable machine name (table, resource, or model id). */
  name: string;
  /** Human label for UI. */
  displayName: string;
  pipelineId: string;
  pipelineName: string;
  syncMode: PipelineSyncMode;
  sourceType: string;
  destinationType: string;
  /** Warehouse dataset / schema for this asset when known. */
  landingDataset?: string;
  /** Fully qualified landing target when known (dataset.table or schema.table). */
  landingQualified?: string;
  parentId?: string;
  description?: string;
  dbtPackage?: string;
  /** In-pipeline dbt (connector sync) vs post-replication job (database replication). */
  transformScope?: "in_pipeline" | "post_replication";
  /** Present after warehouse verification or last-run dbt manifest match. */
  warehouseStatus?: WarehouseAssetStatus;
  /** Transform appeared in the last run dbt manifest. */
  runObserved?: boolean;
  /** Per-asset freshness from last run telemetry or dbt manifest. */
  assetFreshness?: AssetFreshnessMeta;
  /** User-editable catalog metadata (merged from CatalogEntry). */
  catalogDescription?: string;
  catalogTags?: string[];
  catalogDisplayName?: string;
  /** Column count from catalog metadata when known. */
  catalogColumnCount?: number;
  enabled: boolean;
};

export type PipelineLastRunSummary = {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  rowsLoaded?: number;
  currentPhase?: string;
  dbtManifest?: DbtRunManifest;
};

export type PipelineAssetBundle = {
  pipelineId: string;
  pipelineName: string;
  syncMode: PipelineSyncMode;
  sourceType: string;
  destinationType: string;
  enabled: boolean;
  landingDataset: string;
  freshness: AssetFreshness;
  freshnessLabel: string;
  source: WorkspaceAsset;
  rawAssets: WorkspaceAsset[];
  transforms: WorkspaceAsset[];
  postTransforms: WorkspaceAsset[];
  lastRun?: PipelineLastRunSummary;
  /** Destination catalog was queried for this pipeline. */
  warehouseChecked?: boolean;
  warehouseMessage?: string;
  /** Config-declared dbt models vs last run manifest. */
  dbtDiff?: DbtAssetDiff;
  updatedAt: string;
};

export type WorkspaceAssetsResponse = {
  summary: {
    pipelines: number;
    enabledPipelines: number;
    sources: number;
    rawAssets: number;
    transforms: number;
    postTransforms: number;
  };
  pipelines: PipelineAssetBundle[];
  assets: WorkspaceAsset[];
};

export type PipelineAssetInput = {
  id: string;
  name: string;
  tool: string;
  enabled: boolean;
  sourceType: string;
  destinationType: string;
  sourceConfiguration: unknown;
  updatedAt: Date | string;
};

export type PipelineRunAssetInput = {
  pipelineId: string;
  id: string;
  status: string;
  startedAt: Date | string;
  finishedAt: Date | string | null;
  telemetry: unknown;
};

function asConfig(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function sanitizeIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((x) => String(x).trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

const DEFAULT_RESOURCES: Record<string, string[]> = {
  github: ["issues", "pull_requests"],
  stripe: ["customers", "charges", "subscriptions"],
  stripe_analytics: ["customers", "charges", "subscriptions"],
  hubspot: ["contacts", "companies", "deals"],
  salesforce: ["accounts", "opportunities"],
  shopify: ["orders", "customers", "products"],
  shopify_dlt: ["orders", "customers", "products"],
};

/** Match codegen dataset naming for connector sync pipelines. */
export function resolveLandingDataset(
  sourceType: string,
  config: Record<string, unknown>,
  pipelineName: string
): string {
  const override = typeof config.schema_override === "string" ? config.schema_override.trim() : "";
  if (override) return override.replace(/[^a-zA-Z0-9_]/g, "_");

  const st = sourceType.toLowerCase().trim();
  if (st === "github") {
    const owner = String(config.repo_owner ?? "repo").replace(/[^a-zA-Z0-9_]/g, "_");
    const repo = String(config.repo_name ?? "name").replace(/[^a-zA-Z0-9_]/g, "_");
    return `github_${owner}_${repo}`;
  }
  if (st === "rest_api") {
    const resourceName = String(config.resource_name ?? config.name ?? "api");
    return `${resourceName.replace(/[^a-zA-Z0-9_]/g, "_")}_data`;
  }
  const fromName = pipelineName.replace(/[^a-zA-Z0-9_]/g, "_");
  if (fromName) return `${st}_data`.replace(/[^a-zA-Z0-9_]/g, "_") || fromName;
  return `${st}_data`.replace(/[^a-zA-Z0-9_]/g, "_");
}

function resolveConnectorResources(sourceType: string, config: Record<string, unknown>): string[] {
  const fromConfig = stringList(config.resources);
  if (fromConfig.length) return fromConfig;

  const st = sourceType.toLowerCase().trim();
  if (DEFAULT_RESOURCES[st]?.length) return DEFAULT_RESOURCES[st];

  if (st === "rest_api") {
    const advanced = config.advanced_config;
    if (typeof advanced === "string" && advanced.trim()) {
      try {
        const parsed = JSON.parse(advanced) as { resources?: unknown[] };
        if (Array.isArray(parsed.resources)) {
          const names = parsed.resources
            .map((r) => {
              if (r && typeof r === "object" && "name" in r) return String((r as { name: unknown }).name);
              return "";
            })
            .filter(Boolean);
          if (names.length) return names;
        }
      } catch {
        /* ignore invalid JSON */
      }
    }
    const endpoints = stringList(config.endpoints);
    if (endpoints.length) return endpoints;
    return ["rest_api_data"];
  }

  return [st.replace(/[^a-zA-Z0-9_]/g, "_") || "data"];
}

function resolveReplicationTargets(
  sourceType: string,
  destinationType: string,
  config: Record<string, unknown>
): { name: string; qualified: string; dataset: string }[] {
  const replication = generateSlingReplication({
    name: "asset-preview",
    sourceType,
    destinationType,
    sourceConfiguration: config,
  });
  const streams = replication.streams as Record<string, { object?: string }> | undefined;
  if (!streams) return [];

  return Object.entries(streams).map(([streamKey, stream]) => {
    const qualified = String(stream?.object ?? streamKey).trim();
    const parts = qualified.split(".");
    const dataset = parts.length > 1 ? parts.slice(0, -1).join(".") : qualified;
    const table = parts.length > 1 ? parts[parts.length - 1]! : streamKey;
    return {
      name: table,
      qualified,
      dataset,
    };
  });
}

function resolveTransformAssets(
  pipeline: PipelineAssetInput,
  config: Record<string, unknown>,
  syncMode: PipelineSyncMode,
  _landingDataset: string
): WorkspaceAsset[] {
  const dbt = readDbtTransformConfig(config);
  if (!dbt || !Boolean(dbt.enabled)) return [];

  const packagePath = String(dbt.package_path ?? "").trim();
  if (!packagePath) return [];

  const transformScope: "in_pipeline" | "post_replication" =
    syncMode === "database_replication" ? "post_replication" : "in_pipeline";

  const hubPkg = resolveDbtHubPackage(pipeline.sourceType);
  const dbtDatasetRaw =
    typeof dbt.dataset_name === "string" && dbt.dataset_name.trim()
      ? dbt.dataset_name.trim()
      : `${pipeline.name}_dbt`;
  const dbtDataset = dbtDatasetRaw.replace(/[^a-zA-Z0-9_]/g, "_");
  const models = hubPkg?.models?.length ? hubPkg.models : [];
  const scopeNote =
    transformScope === "post_replication"
      ? "Post-replication dbt job (separate from sync runner)"
      : "In-pipeline dbt transform";

  if (models.length === 0) {
    return [
      {
        id: `${pipeline.id}:transform:dbt`,
        kind: "transform",
        name: packagePath,
        displayName: dbtHubPackageDisplayName(packagePath) || "dbt project",
        pipelineId: pipeline.id,
        pipelineName: pipeline.name,
        syncMode,
        sourceType: pipeline.sourceType,
        destinationType: pipeline.destinationType,
        landingDataset: dbtDataset,
        dbtPackage: packagePath,
        transformScope,
        description: hubPkg?.description ?? scopeNote,
        enabled: pipeline.enabled,
      },
    ];
  }

  return models.map((model) => ({
    id: `${pipeline.id}:transform:${sanitizeIdPart(model)}`,
    kind: "transform" as const,
    name: model,
    displayName: model,
    pipelineId: pipeline.id,
    pipelineName: pipeline.name,
    syncMode,
    sourceType: pipeline.sourceType,
    destinationType: pipeline.destinationType,
    landingDataset: dbtDataset,
    landingQualified: `${dbtDataset}.${model}`,
    parentId: `${pipeline.id}:source`,
    dbtPackage: packagePath,
    transformScope,
    description: scopeNote,
    enabled: pipeline.enabled,
  }));
}

function resolveObjectStoreTargets(
  pipeline: PipelineAssetInput,
  config: Record<string, unknown>,
  syncMode: PipelineSyncMode,
  sourceId: string
): WorkspaceAsset[] {
  const dest = pipeline.destinationType.toLowerCase().trim();
  if (!["s3", "gcs", "azure_blob", "filesystem"].includes(dest)) return [];

  let qualified = "";
  let name = "";
  if (dest === "s3") {
    const bucket = String(config.bucket ?? config.target_bucket ?? "").trim();
    const prefix = String(config.prefix ?? config.path ?? "").trim();
    if (!bucket) return [];
    qualified = prefix ? `s3://${bucket}/${prefix.replace(/\/$/, "")}` : `s3://${bucket}`;
    name = prefix || bucket;
  } else if (dest === "gcs") {
    const bucket = String(config.bucket ?? "").trim();
    const prefix = String(config.prefix ?? config.path ?? "").trim();
    if (!bucket) return [];
    qualified = prefix ? `gs://${bucket}/${prefix.replace(/\/$/, "")}` : `gs://${bucket}`;
    name = prefix || bucket;
  } else if (dest === "azure_blob") {
    const account = String(config.account_name ?? config.account ?? "").trim();
    const container = String(config.container ?? "").trim();
    const prefix = String(config.prefix ?? config.path ?? "").trim();
    if (!account || !container) return [];
    qualified = prefix
      ? `azure://${account}/${container}/${prefix.replace(/\/$/, "")}`
      : `azure://${account}/${container}`;
    name = prefix || container;
  } else {
    const path = String(config.path ?? config.DEST_FILESYSTEM_PATH ?? "").trim();
    if (!path) return [];
    qualified = path;
    name = path.split("/").pop() || path;
  }

  return [
    {
      id: `${pipeline.id}:object:${sanitizeIdPart(qualified)}`,
      kind: "object",
      name,
      displayName: qualified,
      pipelineId: pipeline.id,
      pipelineName: pipeline.name,
      syncMode,
      sourceType: pipeline.sourceType,
      destinationType: pipeline.destinationType,
      landingQualified: qualified,
      parentId: sourceId,
      description: "Object store landing path",
      enabled: pipeline.enabled,
    },
  ];
}

function resolvePostTransformAssets(
  pipeline: PipelineAssetInput,
  config: Record<string, unknown>,
  syncMode: PipelineSyncMode
): WorkspaceAsset[] {
  const post = config.post_transform;
  if (!post || typeof post !== "object") return [];
  const type = String((post as { type?: unknown }).type ?? "").trim();
  const code = String((post as { code?: unknown }).code ?? "").trim();
  if (!code || (type !== "python" && type !== "sql")) return [];

  const label = type === "sql" ? "SQL post-transform" : "Python post-transform";
  return [
    {
      id: `${pipeline.id}:post_transform:${type}`,
      kind: "post_transform",
      name: type,
      displayName: label,
      pipelineId: pipeline.id,
      pipelineName: pipeline.name,
      syncMode,
      sourceType: pipeline.sourceType,
      destinationType: pipeline.destinationType,
      description: `${label} step after load`,
      enabled: pipeline.enabled,
    },
  ];
}

/** Derive asset bundle for a single pipeline row. */
export function derivePipelineAssets(pipeline: PipelineAssetInput): PipelineAssetBundle {
  const config = asConfig(pipeline.sourceConfiguration);
  const syncMode = pipelineSyncMode(pipeline.tool);
  const landingDataset =
    syncMode === "database_replication"
      ? String(config.target_schema ?? config.schema ?? "public").trim() || "public"
      : resolveLandingDataset(pipeline.sourceType, config, pipeline.name);

  const sourceAsset: WorkspaceAsset = {
    id: `${pipeline.id}:source`,
    kind: "source",
    name: pipeline.sourceType,
    displayName: pipeline.sourceType.replace(/_/g, " "),
    pipelineId: pipeline.id,
    pipelineName: pipeline.name,
    syncMode,
    sourceType: pipeline.sourceType,
    destinationType: pipeline.destinationType,
    landingDataset,
    description: `Ingest from ${pipeline.sourceType}`,
    enabled: pipeline.enabled,
  };

  let rawAssets: WorkspaceAsset[] = [];

  if (syncMode === "database_replication") {
    const targets = resolveReplicationTargets(pipeline.sourceType, pipeline.destinationType, config);
    rawAssets = targets.map((t) => ({
      id: `${pipeline.id}:raw:${sanitizeIdPart(t.qualified)}`,
      kind: "raw" as const,
      name: t.name,
      displayName: t.qualified,
      pipelineId: pipeline.id,
      pipelineName: pipeline.name,
      syncMode,
      sourceType: pipeline.sourceType,
      destinationType: pipeline.destinationType,
      landingDataset: t.dataset,
      landingQualified: t.qualified,
      parentId: sourceAsset.id,
      description: "Replicated table",
      enabled: pipeline.enabled,
    }));
  } else {
    const resources = resolveConnectorResources(pipeline.sourceType, config);
    rawAssets = resources.map((resource) => {
      const table = resource.replace(/[^a-zA-Z0-9_]/g, "_");
      const qualified = `${landingDataset}.${table}`;
      return {
        id: `${pipeline.id}:raw:${sanitizeIdPart(resource)}`,
        kind: "raw" as const,
        name: resource,
        displayName: resource.replace(/_/g, " "),
        pipelineId: pipeline.id,
        pipelineName: pipeline.name,
        syncMode,
        sourceType: pipeline.sourceType,
        destinationType: pipeline.destinationType,
        landingDataset,
        landingQualified: qualified,
        parentId: sourceAsset.id,
        description: "Loaded resource / table",
        enabled: pipeline.enabled,
      };
    });
  }

  rawAssets = [...rawAssets, ...resolveObjectStoreTargets(pipeline, config, syncMode, sourceAsset.id)];

  const transforms = resolveTransformAssets(pipeline, config, syncMode, landingDataset);
  const postTransforms = resolvePostTransformAssets(pipeline, config, syncMode);

  const bundle: PipelineAssetBundle = {
    pipelineId: pipeline.id,
    pipelineName: pipeline.name,
    syncMode,
    sourceType: pipeline.sourceType,
    destinationType: pipeline.destinationType,
    enabled: pipeline.enabled,
    landingDataset,
    freshness: "never_run",
    freshnessLabel: "Never run",
    source: sourceAsset,
    rawAssets,
    transforms,
    postTransforms,
    updatedAt:
      pipeline.updatedAt instanceof Date ? pipeline.updatedAt.toISOString() : String(pipeline.updatedAt),
  };

  return bundle;
}

export function attachLastRun(
  bundle: PipelineAssetBundle,
  run: PipelineRunAssetInput | undefined
): PipelineAssetBundle {
  const base = { ...bundle };
  if (!run) {
    const meta = computePipelineFreshness(undefined, bundle.enabled);
    return enrichBundleAssetFreshness(
      { ...base, freshness: meta.freshness, freshnessLabel: meta.label },
      new Set()
    );
  }
  const telemetry = parseRunTelemetry(run.telemetry);
  const resourcesTouched = resourcesTouchedFromTelemetry(run.telemetry);
  const lastRun: PipelineLastRunSummary = {
    id: run.id,
    status: run.status,
    startedAt: run.startedAt instanceof Date ? run.startedAt.toISOString() : String(run.startedAt),
    finishedAt: run.finishedAt
      ? run.finishedAt instanceof Date
        ? run.finishedAt.toISOString()
        : String(run.finishedAt)
      : null,
    rowsLoaded: telemetry.summary.rowsLoaded,
    currentPhase: telemetry.summary.currentPhase,
    ...(telemetry.dbt ? { dbtManifest: telemetry.dbt } : {}),
  };
  const meta = computePipelineFreshness(lastRun, bundle.enabled);
  const withRun = {
    ...base,
    lastRun,
    freshness: meta.freshness,
    freshnessLabel: meta.label,
    dbtDiff: computeDbtAssetDiff({ ...base, lastRun, freshness: meta.freshness, freshnessLabel: meta.label }) ?? undefined,
  };
  return enrichBundleAssetFreshness(withRun, resourcesTouched);
}

/** Aggregate workspace assets across pipelines (newest pipeline first). */
export function buildWorkspaceAssets(
  pipelines: PipelineAssetInput[],
  latestRunsByPipelineId: Map<string, PipelineRunAssetInput> = new Map()
): WorkspaceAssetsResponse {
  const sorted = [...pipelines].sort((a, b) => {
    const at = a.updatedAt instanceof Date ? a.updatedAt.getTime() : Date.parse(String(a.updatedAt));
    const bt = b.updatedAt instanceof Date ? b.updatedAt.getTime() : Date.parse(String(b.updatedAt));
    return bt - at;
  });

  const bundles = sorted.map((p) =>
    enrichBundleFromDbtManifest(
      attachLastRun(derivePipelineAssets(p), latestRunsByPipelineId.get(p.id))
    )
  );

  const assets = bundles.flatMap((b) => [
    b.source,
    ...b.rawAssets,
    ...b.transforms,
    ...b.postTransforms,
  ]);

  return {
    summary: {
      pipelines: bundles.length,
      enabledPipelines: bundles.filter((b) => b.enabled).length,
      sources: bundles.length,
      rawAssets: bundles.reduce((n, b) => n + b.rawAssets.length, 0),
      transforms: bundles.reduce((n, b) => n + b.transforms.length, 0),
      postTransforms: bundles.reduce((n, b) => n + b.postTransforms.length, 0),
    },
    pipelines: bundles,
    assets,
  };
}
