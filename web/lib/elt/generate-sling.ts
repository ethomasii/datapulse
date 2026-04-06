import type { PipelineRequest } from "./types";
import YAML from "yaml";

export function generateSlingReplication(request: PipelineRequest): Record<string, unknown> {
  const config = request.sourceConfiguration;
  const streams: Record<string, unknown> = {};

  if (typeof config.tables === "string" && config.tables.trim()) {
    const tables = config.tables.split(",").map((t) => t.trim()).filter(Boolean);
    for (const table of tables) {
      streams[`public.${table}`] = { object: `${request.destinationType}.${table}` };
    }
  } else {
    streams["# TODO: Configure your streams"] = { "# Example": "public.users" };
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
    defaults: {
      mode: "full-refresh",
      object: "{stream_schema}.{stream_table}",
    },
    streams,
  };

  return replication;
}

export function slingReplicationToYaml(replication: Record<string, unknown>): string {
  return YAML.stringify(replication);
}
