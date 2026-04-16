/** Resolve partition column / value for runs and monitors (shared with dbt codegen). */

const MAX_MONITOR_PARTITION_VALUES = 100;

export function partitionColumnFromSourceConfiguration(sourceConfiguration: unknown): string | null {
  const raw =
    sourceConfiguration &&
    typeof sourceConfiguration === "object" &&
    !Array.isArray(sourceConfiguration)
      ? (sourceConfiguration as Record<string, unknown>)._partitionConfig
      : undefined;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const pc = raw as { type?: unknown; column?: unknown };
  const t = pc.type;
  if (t !== "date" && t !== "key") return null;
  const col = String(pc.column ?? "").trim();
  return col || null;
}

export type RunPartitionBody = {
  partitionColumn?: string | null;
  partitionValue?: string | null;
  triggeredBy?: string | null;
};

export class RunPartitionResolutionError extends Error {
  readonly code: "PARTITION_COLUMN_REQUIRED";

  constructor(code: "PARTITION_COLUMN_REQUIRED", message: string) {
    super(message);
    this.code = code;
    this.name = "RunPartitionResolutionError";
  }
}

/**
 * Normalize partition fields for a new run.
 * - If only `partitionValue` is set, fills column from pipeline `_partitionConfig` when possible.
 * - If `triggeredBy` is empty and both column and value are set, sets `backfill:partition:…` for Run slices UX.
 */
export function resolveRunPartitionFields(
  body: RunPartitionBody,
  pipelineSourceConfiguration: unknown
): { partitionColumn: string | null; partitionValue: string | null; triggeredBy: string | null } {
  const colIn = body.partitionColumn?.trim() || null;
  const valIn = body.partitionValue?.trim() || null;
  const fromPipeline = partitionColumnFromSourceConfiguration(pipelineSourceConfiguration);
  const column = colIn || (valIn ? fromPipeline : null);

  if (valIn && !column) {
    throw new RunPartitionResolutionError(
      "PARTITION_COLUMN_REQUIRED",
      "partitionColumn is required when partitionValue is set and the pipeline has no date/key partition column saved."
    );
  }

  let triggeredBy = body.triggeredBy?.trim() || null;
  if (valIn && column && !triggeredBy) {
    triggeredBy = `backfill:partition:${column}:${valIn}`;
  }

  return {
    partitionColumn: column,
    partitionValue: valIn,
    triggeredBy,
  };
}

/** Read `partition_values` from monitor JSON (array or newline/comma-separated string). */
export function parsePartitionValuesFromMonitorConfig(config: Record<string, unknown>): string[] {
  const raw = config.partition_values;
  let list: string[] = [];
  if (Array.isArray(raw)) {
    list = raw.map((x) => String(x).trim()).filter(Boolean);
  } else if (typeof raw === "string" && raw.trim()) {
    list = raw
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return list.slice(0, MAX_MONITOR_PARTITION_VALUES);
}

export function monitorPartitionColumnFromConfig(
  config: Record<string, unknown>,
  pipelineSourceConfiguration: unknown
): string | null {
  const fromCfg = typeof config.partition_column === "string" ? config.partition_column.trim() : "";
  if (fromCfg) return fromCfg;
  return partitionColumnFromSourceConfiguration(pipelineSourceConfiguration);
}
