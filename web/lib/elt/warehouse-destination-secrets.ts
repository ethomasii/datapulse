import { parseStoredConnectionSecrets } from "@/lib/elt/connection-secrets-store";
import { mergeConnectionRuntimeSecrets } from "@/lib/elt/duckdb-destination";
import type { DestinationConnectionRow } from "@/lib/elt/warehouse-introspect";

export function resolveDestinationConnectionContext(row: DestinationConnectionRow): {
  secrets: Record<string, string>;
  config: Record<string, unknown>;
  connector: string;
} {
  const config =
    row.config && typeof row.config === "object" && !Array.isArray(row.config)
      ? (row.config as Record<string, unknown>)
      : {};
  const secrets = mergeConnectionRuntimeSecrets(
    "destination",
    row.connector,
    parseStoredConnectionSecrets(row.connectionSecretsEnc),
    config
  );
  return { secrets, config, connector: row.connector.toLowerCase().trim() };
}
