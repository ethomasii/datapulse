/**
 * Map connection config + legacy env keys into dlt DESTINATION__*__CREDENTIALS__* vars.
 * Keeps app/dbt/sling env keys in sync so canvas introspection and dlt runs agree.
 */

import { STARTER_WAREHOUSE_DEFAULT_DB } from "@/lib/elt/starter-warehouse";

export type DltFieldMapping = {
  /** Non-secret connection config key (optional). */
  configKey?: string;
  /** dlt credentials dataclass field name. */
  dltField: string;
  /** Legacy env keys used by forms, dbt profiles, and sling. */
  legacyKeys: string[];
};

export type DltDestinationSpec = {
  /** dlt destination module name (postgres, snowflake, …). */
  dltName: string;
  connectors: string[];
  fields: DltFieldMapping[];
  /** Default when config + legacy + dlt keys are all empty. */
  defaults?: Partial<Record<string, string>>;
};

function dltCredentialEnvKey(dltName: string, field: string): string {
  return `DESTINATION__${dltName.toUpperCase()}__CREDENTIALS__${field.toUpperCase()}`;
}

function pickString(...values: (string | undefined)[]): string {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function configString(config: Record<string, unknown>, key: string | undefined): string {
  if (!key) return "";
  const v = config[key];
  return typeof v === "string" && v.trim() ? v.trim() : "";
}

function setIfAbsent(merged: Record<string, string>, key: string, value: string): void {
  if (value && !merged[key]?.trim()) merged[key] = value;
}

/** Whole-credentials blob env keys (BigQuery JSON, DuckDB path string). */
const CREDENTIALS_BLOB_PAIRS: { legacyKeys: string[]; dltKeys: string[] }[] = [
  {
    legacyKeys: ["GCP_CREDENTIALS", "GOOGLE_APPLICATION_CREDENTIALS"],
    dltKeys: ["DESTINATION__BIGQUERY__CREDENTIALS"],
  },
  {
    legacyKeys: ["DEST_DUCKDB_PATH", "DESTINATION__DUCKDB__CREDENTIALS"],
    dltKeys: ["DESTINATION__DUCKDB__CREDENTIALS", "DESTINATION__DUCKDB__CREDENTIALS__DATABASE"],
  },
];

export const DLT_DESTINATION_SPECS: DltDestinationSpec[] = [
  {
    dltName: "postgres",
    connectors: ["postgres", "postgresql"],
    fields: [
      { configKey: "host", dltField: "host", legacyKeys: ["POSTGRES_HOST", "DEST_POSTGRES_HOST"] },
      { configKey: "port", dltField: "port", legacyKeys: ["POSTGRES_PORT", "DEST_POSTGRES_PORT"] },
      { configKey: "database", dltField: "database", legacyKeys: ["POSTGRES_DATABASE", "DEST_POSTGRES_DATABASE"] },
      { configKey: "username", dltField: "username", legacyKeys: ["POSTGRES_USER", "DEST_POSTGRES_USER"] },
      { dltField: "password", legacyKeys: ["POSTGRES_PASSWORD", "DEST_POSTGRES_PASSWORD"] },
    ],
  },
  {
    dltName: "snowflake",
    connectors: ["snowflake"],
    fields: [
      { configKey: "account", dltField: "host", legacyKeys: ["SNOWFLAKE_ACCOUNT"] },
      { configKey: "database", dltField: "database", legacyKeys: ["SNOWFLAKE_DATABASE"] },
      { configKey: "warehouse", dltField: "warehouse", legacyKeys: ["SNOWFLAKE_WAREHOUSE"] },
      { configKey: "role", dltField: "role", legacyKeys: ["SNOWFLAKE_ROLE"] },
      { configKey: "username", dltField: "username", legacyKeys: ["SNOWFLAKE_USER"] },
      { dltField: "password", legacyKeys: ["SNOWFLAKE_PASSWORD"] },
      { dltField: "private_key", legacyKeys: ["SNOWFLAKE_PRIVATE_KEY"] },
      { dltField: "private_key_passphrase", legacyKeys: ["SNOWFLAKE_PRIVATE_KEY_PASSPHRASE"] },
    ],
  },
  {
    dltName: "redshift",
    connectors: ["redshift"],
    fields: [
      { configKey: "host", dltField: "host", legacyKeys: ["REDSHIFT_HOST"] },
      { configKey: "port", dltField: "port", legacyKeys: ["REDSHIFT_PORT"] },
      { configKey: "database", dltField: "database", legacyKeys: ["REDSHIFT_DATABASE"] },
      { configKey: "username", dltField: "username", legacyKeys: ["REDSHIFT_USER"] },
      { dltField: "password", legacyKeys: ["REDSHIFT_PASSWORD"] },
    ],
  },
  {
    dltName: "motherduck",
    connectors: ["motherduck"],
    defaults: { database: STARTER_WAREHOUSE_DEFAULT_DB },
    fields: [
      { configKey: "database", dltField: "database", legacyKeys: ["MOTHERDUCK_DATABASE"] },
      { dltField: "password", legacyKeys: ["MOTHERDUCK_TOKEN"] },
    ],
  },
  {
    dltName: "clickhouse",
    connectors: ["clickhouse"],
    fields: [
      { configKey: "host", dltField: "host", legacyKeys: ["CLICKHOUSE_HOST"] },
      { configKey: "port", dltField: "port", legacyKeys: ["CLICKHOUSE_PORT"] },
      { configKey: "database", dltField: "database", legacyKeys: ["CLICKHOUSE_DATABASE"] },
      { configKey: "username", dltField: "username", legacyKeys: ["CLICKHOUSE_USER"] },
      { dltField: "password", legacyKeys: ["CLICKHOUSE_PASSWORD"] },
    ],
  },
  {
    dltName: "mssql",
    connectors: ["mssql"],
    fields: [
      { configKey: "host", dltField: "host", legacyKeys: ["MSSQL_HOST"] },
      { configKey: "port", dltField: "port", legacyKeys: ["MSSQL_PORT"] },
      { configKey: "database", dltField: "database", legacyKeys: ["MSSQL_DATABASE"] },
      { configKey: "username", dltField: "username", legacyKeys: ["MSSQL_USER"] },
      { dltField: "password", legacyKeys: ["MSSQL_PASSWORD"] },
    ],
  },
  {
    dltName: "databricks",
    connectors: ["databricks"],
    fields: [
      { configKey: "server_hostname", dltField: "server_hostname", legacyKeys: ["DATABRICKS_HOST"] },
      { configKey: "http_path", dltField: "http_path", legacyKeys: ["DATABRICKS_HTTP_PATH"] },
      { configKey: "catalog", dltField: "catalog", legacyKeys: ["DATABRICKS_CATALOG"] },
      { dltField: "access_token", legacyKeys: ["DATABRICKS_TOKEN"] },
    ],
  },
  {
    dltName: "bigquery",
    connectors: ["bigquery", "gcp"],
    fields: [
      { configKey: "project", dltField: "project_id", legacyKeys: ["GCP_PROJECT_ID"] },
      { configKey: "project_id", dltField: "project_id", legacyKeys: ["GCP_PROJECT_ID"] },
    ],
  },
  {
    dltName: "duckdb",
    connectors: ["duckdb"],
    fields: [{ configKey: "database", dltField: "database", legacyKeys: ["DEST_DUCKDB_PATH"] }],
  },
];

const SPEC_BY_CONNECTOR = new Map<string, DltDestinationSpec>();
for (const spec of DLT_DESTINATION_SPECS) {
  for (const connector of spec.connectors) {
    SPEC_BY_CONNECTOR.set(connector, spec);
  }
}

function applyFieldMapping(
  merged: Record<string, string>,
  config: Record<string, unknown>,
  spec: DltDestinationSpec,
  mapping: DltFieldMapping
): void {
  const dltKey = dltCredentialEnvKey(spec.dltName, mapping.dltField);
  const fromConfig = configString(config, mapping.configKey);
  const fromLegacy = pickString(...mapping.legacyKeys.map((k) => merged[k]));
  const fromDlt = merged[dltKey]?.trim();
  const fallback = spec.defaults?.[mapping.dltField] ?? spec.defaults?.[mapping.configKey ?? ""];
  const value = pickString(fromConfig, fromLegacy, fromDlt, fallback);
  if (!value) return;

  setIfAbsent(merged, dltKey, value);
  for (const legacyKey of mapping.legacyKeys) {
    setIfAbsent(merged, legacyKey, value);
  }
}

function syncCredentialBlobs(merged: Record<string, string>): void {
  for (const { legacyKeys, dltKeys } of CREDENTIALS_BLOB_PAIRS) {
    const value = pickString(...legacyKeys.map((k) => merged[k]), ...dltKeys.map((k) => merged[k]));
    if (!value) continue;
    for (const key of [...legacyKeys, ...dltKeys]) {
      setIfAbsent(merged, key, value);
    }
  }
}

/** Apply dlt destination credential env mapping for a connector slug. */
export function applyDltDestinationEnvMapping(
  connector: string,
  secrets: Record<string, string>,
  config: Record<string, unknown>
): Record<string, string> {
  const slug = connector.toLowerCase().trim();
  const spec = SPEC_BY_CONNECTOR.get(slug);
  const merged = { ...secrets };
  if (!spec) return merged;

  for (const field of spec.fields) {
    applyFieldMapping(merged, config, spec, field);
  }
  syncCredentialBlobs(merged);
  return merged;
}
