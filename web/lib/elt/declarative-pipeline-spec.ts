import { z } from "zod";

/** Declarative pipeline spec v2 — vendor-agnostic; compiles to dlt/sling/dbt codegen. */
export const DECLARATIVE_PIPELINE_SPEC_VERSION = 2 as const;

/** `@workspace` resolves to the account/org default destination connection. */
export const WORKSPACE_DESTINATION_REF = "@workspace" as const;

const syncSpecSchema = z.object({
  mode: z.enum(["incremental", "full", "merge"]).default("incremental"),
  cursor: z.string().min(1).optional(),
  writeDisposition: z.enum(["append", "replace", "merge"]).optional(),
});

const slicesSpecSchema = z.object({
  column: z.string().min(1),
  granularity: z.enum(["day", "week", "month", "hour", "key"]).default("day"),
  note: z.string().max(8000).optional(),
});

const dbtTransformSpecSchema = z.object({
  enabled: z.boolean().default(true),
  project: z.string().min(1).optional(),
  package_path: z.string().min(1).optional(),
  packagePath: z.string().min(1).optional(),
  select: z.string().max(512).optional(),
  selector: z.string().max(512).optional(),
  dataset_name: z.string().max(128).optional(),
  datasetName: z.string().max(128).optional(),
  run_scope: z.enum(["all", "selection"]).optional(),
  runScope: z.enum(["all", "selection"]).optional(),
  repository_branch: z.string().max(128).optional(),
  repositoryBranch: z.string().max(128).optional(),
});

const qualityCheckSpecSchema = z.object({
  table: z.string().min(1),
  not_null: z.array(z.string().min(1)).optional(),
  unique: z.array(z.string().min(1)).optional(),
});

/** Dagster-components-style extensible step (quality, sql, python, custom). */
export const pipelineComponentSpecSchema = z.object({
  id: z.string().min(1).max(128),
  type: z.enum(["quality", "dbt", "sql", "python", "custom"]),
  /** Canonical materialized output key (Lakeflow-style asset key). */
  assetKey: z.string().min(1).max(256).optional(),
  /** Upstream asset keys this step reads. */
  inputs: z.array(z.string().min(1)).optional(),
  config: z.record(z.string(), z.unknown()).default({}),
  after: z.array(z.string().min(1)).optional(),
});

const transformSpecSchema = z.object({
  dbt: dbtTransformSpecSchema.optional(),
  post_transform_type: z.enum(["dbt", "python", "sql"]).optional(),
  postTransformType: z.enum(["dbt", "python", "sql"]).optional(),
});

const scheduleSpecSchema = z.object({
  enabled: z.boolean().optional(),
  cron: z.string().max(256).optional(),
  timezone: z.string().max(64).optional(),
  /** Run environment slug for scheduled runs (default production). */
  environment: z.string().max(64).optional(),
});

/** Per-deployment connection overrides (GitOps-safe — names only, no secrets). */
export const deploymentBindingSpecSchema = z.object({
  sourceConnection: z.string().min(1).optional(),
  destinationConnection: z.string().min(1).optional(),
  env: z.record(z.string(), z.string()).optional(),
});

export type DeploymentBindingSpec = z.infer<typeof deploymentBindingSpecSchema>;

const medallionSpecSchema = z.object({
  /** Layer assigned to landed raw tables (default bronze). */
  landing: z.enum(["bronze", "silver", "gold"]).default("bronze"),
  /** Layer for dbt transform outputs when not inferred from manifest. */
  transform: z.enum(["bronze", "silver", "gold"]).default("gold"),
});

export const declarativePipelineSpecSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "Use letters, numbers, underscore; start with a letter"),
  /** Source connector slug or shorthand alias (e.g. stripe, postgres, s3). */
  source: z.string().min(1),
  /** Destination connector slug, connection name, or `@workspace`. */
  destination: z.string().min(1),
  tool: z.enum(["auto", "dlt", "sling"]).default("auto"),
  description: z.string().optional(),
  groupName: z.string().optional(),
  /** Saved Connection profile name or id (source). */
  sourceConnection: z.string().min(1).optional(),
  /** Saved Connection profile name or id (destination). Overrides connector on profile when set. */
  destinationConnection: z.string().min(1).optional(),
  /** Tables, resources, or streams to extract. */
  tables: z.array(z.string().min(1)).optional(),
  /** Non-secret source options (merged into sourceConfiguration). */
  sourceOptions: z.record(z.string(), z.unknown()).optional(),
  sync: syncSpecSchema.optional(),
  slices: slicesSpecSchema.optional(),
  transform: transformSpecSchema.optional(),
  /** Simple data-quality checks (also expressible as `components`). */
  quality: z.array(qualityCheckSpecSchema).optional(),
  /** Extensible pipeline components (quality, dbt, sql, python). */
  components: z.array(pipelineComponentSpecSchema).optional(),
  medallion: medallionSpecSchema.optional(),
  schedule: scheduleSpecSchema.optional(),
  executionHost: z.enum(["inherit", "eltpulse_managed", "customer_gateway"]).optional(),
  runsWebhookUrl: z.string().max(2048).optional(),
  defaultTargetAgentTokenId: z.string().min(1).nullable().optional(),
  dbtProjectId: z.string().min(1).nullable().optional(),
  tests: z.string().max(16000).optional(),
  sensors: z.string().max(16000).optional(),
  otherNotes: z.string().max(8000).optional(),
  /** development / production connection profiles — promoted with pipeline YAML in Git. */
  deployments: z.record(z.string(), deploymentBindingSpecSchema).optional(),
});

export type DeclarativePipelineSpec = z.infer<typeof declarativePipelineSpecSchema>;
export type PipelineComponentSpec = z.infer<typeof pipelineComponentSpecSchema>;
export type MedallionLayer = "bronze" | "silver" | "gold";
