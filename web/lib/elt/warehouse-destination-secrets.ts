import { parseStoredConnectionSecrets } from "@/lib/elt/connection-secrets-store";
import { mergeConnectionRuntimeSecrets } from "@/lib/elt/duckdb-destination";
import type { DestinationConnectionRow } from "@/lib/elt/warehouse-introspect";

/** Decrypted secrets + connection config mapped to dlt/runtime env (shared by web + agent API). */
export function resolveConnectionRuntimeSecrets(
  connectionType: "source" | "destination",
  connector: string,
  connectionSecretsEnc: string | null,
  config: unknown
): Record<string, string> {
  const cfg =
    config && typeof config === "object" && !Array.isArray(config)
      ? (config as Record<string, unknown>)
      : {};
  return mergeConnectionRuntimeSecrets(
    connectionType,
    connector,
    parseStoredConnectionSecrets(connectionSecretsEnc),
    cfg
  );
}

export function resolveDestinationConnectionContext(row: DestinationConnectionRow): {
  secrets: Record<string, string>;
  config: Record<string, unknown>;
  connector: string;
} {
  const config =
    row.config && typeof row.config === "object" && !Array.isArray(row.config)
      ? (row.config as Record<string, unknown>)
      : {};
  const secrets = resolveConnectionRuntimeSecrets(
    "destination",
    row.connector,
    row.connectionSecretsEnc,
    config
  );
  return { secrets, config, connector: row.connector.toLowerCase().trim() };
}
