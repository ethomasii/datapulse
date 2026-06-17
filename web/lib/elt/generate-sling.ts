import type { PipelineRequest } from "./types";
import YAML from "yaml";

/**
 * Partition config shape as stored in sourceConfiguration._partitionConfig.
 * Matches the PartitionConfig type in partition-config-editor.tsx (slice UI only uses type/column here).
 */
type PartitionConfig = {
  type: "date" | "key" | "none";
  column: string;
  granularity?: string;
  description?: string;
  dayCoverageFrom?: string;
  dayCoverageTo?: string;
};

export function generateSlingReplication(request: PipelineRequest): Record<string, unknown> {
  const config = request.sourceConfiguration;
  const streams: Record<string, unknown> = {};

  // Read stored partition config (saved from the Builder / partition editor).
  const pc = config._partitionConfig as PartitionConfig | undefined;
  const hasIncrementalPartition = pc && pc.type !== "none" && pc.column?.trim();

  // Build stream defaults:
  //   - If a date or key partition is configured, use incremental mode with update_key
  //     so the slice value passed at run time maps to the incremental range (Sling incremental + update_key).
  //   - Otherwise fall back to full-refresh so a plain run always works.
  const streamDefaults: Record<string, unknown> = {
    object: "{stream_schema}.{stream_table}",
  };

  if (hasIncrementalPartition) {
    streamDefaults.mode = "incremental";
    streamDefaults.update_key = pc!.column.trim();
    // primary_key is the same column when doing key-based slices; for date-based
    // slices it acts as the cursor -- sling treats it as the incremental boundary.
    streamDefaults.primary_key = [pc!.column.trim()];
  } else {
    streamDefaults.mode = "full-refresh";
  }

  const schema =
    typeof config.schema === "string" && config.schema.trim() ? config.schema.trim() : "public";
  const destSchema =
    typeof config.target_schema === "string" && config.target_schema.trim()
      ? config.target_schema.trim()
      : request.destinationType.toLowerCase() === "snowflake"
        ? "PUBLIC"
        : "public";

  if (typeof config.tables === "string" && config.tables.trim()) {
    const tables = config.tables.split(",").map((t) => t.trim()).filter(Boolean);
    for (const table of tables) {
      const srcKey = table.includes(".") ? table : `${schema}.${table}`;
      const destTable = table.includes(".") ? table.split(".").pop()! : table;
      streams[srcKey] = { object: `${destSchema}.${destTable}` };
    }
  } else if (request.sourceType === "postgres" || request.sourceType === "postgresql") {
    for (const table of ["users", "orders"]) {
      streams[`${schema}.${table}`] = { object: `${destSchema}.${table}` };
    }
  } else {
    streams[`${schema}.users`] = { object: `${destSchema}.users` };
  }

  const sourceConn = request.sourceType.toUpperCase();
  let destConn: string;
  if (request.destinationInstance) {
    destConn = `${request.destinationType.toUpperCase()}_${request.destinationInstance.toUpperCase()}`;
  } else {
    destConn = request.destinationType.toUpperCase();
  }

  const replication: Record<string, unknown> = {
    source: sourceConn,
    target: destConn,
    defaults: streamDefaults,
    streams,
  };

  return replication;
}

export function slingReplicationToYaml(replication: Record<string, unknown>): string {
  return YAML.stringify(replication);
}
