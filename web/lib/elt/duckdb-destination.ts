import type { ConfigField, CredentialField } from "@/lib/elt/connectors-registry";
import { STARTER_WAREHOUSE_DEFAULT_DB } from "@/lib/elt/starter-warehouse";

/** Shared copy for DuckDB connection config (not local filesystem paths). */
export const DUCKDB_DATABASE_LOCATION_HELP =
  "Cloud URI such as s3://bucket/warehouse.duckdb or gs://bucket/warehouse.duckdb. " +
  "Leave empty on eltPulse-managed compute to use an internal database file. " +
  "For hosted DuckDB without object storage, use MotherDuck instead. " +
  "Local paths only apply when a customer gateway runs on that host.";

export const DUCKDB_DATABASE_CONFIG_FIELD: ConfigField = {
  key: "database",
  label: "Database location",
  type: "text",
  placeholder: "s3://my-bucket/warehouse.duckdb",
  help: DUCKDB_DATABASE_LOCATION_HELP,
};

/** Optional credentials when the database URI uses S3 (httpfs). */
export const DUCKDB_S3_CREDENTIAL_FIELDS: CredentialField[] = [
  {
    key: "AWS_ACCESS_KEY_ID",
    label: "AWS Access Key ID",
    type: "text",
    required: false,
    help: "For s3:// database locations. Omit if the runner uses an IAM role.",
  },
  {
    key: "AWS_SECRET_ACCESS_KEY",
    label: "AWS Secret Access Key",
    type: "password",
    required: false,
  },
  {
    key: "AWS_REGION",
    label: "AWS Region",
    type: "text",
    required: false,
    placeholder: "us-east-1",
  },
];

export function resolveDuckdbDatabaseLocation(
  secrets: Record<string, string>,
  config: Record<string, unknown>
): string {
  const fromSecret =
    secrets.DEST_DUCKDB_PATH?.trim() ||
    secrets.DUCKDB_PATH?.trim() ||
    secrets.DESTINATION__DUCKDB__CREDENTIALS?.trim() ||
    "";
  if (fromSecret) return fromSecret;
  const db = config.database;
  if (typeof db === "string" && db.trim()) return db.trim();
  const pathVal = config.path;
  if (typeof pathVal === "string" && pathVal.trim()) return pathVal.trim();
  return "";
}

/** Map non-secret connection config into env vars expected by dlt/dbt runners. */
export function mergeConnectionRuntimeSecrets(
  connectionType: "source" | "destination",
  connector: string,
  secrets: Record<string, string>,
  config: Record<string, unknown>
): Record<string, string> {
  const merged = { ...secrets };
  const slug = connector.toLowerCase().trim();

  if (slug === "duckdb") {
    const loc = resolveDuckdbDatabaseLocation(secrets, config);
    if (loc) {
      if (connectionType === "destination" && !merged.DEST_DUCKDB_PATH) {
        merged.DEST_DUCKDB_PATH = loc;
      }
      if (connectionType === "source" && !merged.DUCKDB_PATH) {
        merged.DUCKDB_PATH = loc;
      }
    }
  }

  if (connectionType === "destination" && slug === "motherduck") {
    const db =
      (typeof config.database === "string" ? config.database.trim() : "") ||
      merged.MOTHERDUCK_DATABASE?.trim() ||
      STARTER_WAREHOUSE_DEFAULT_DB;
    if (db) {
      if (!merged.MOTHERDUCK_DATABASE) merged.MOTHERDUCK_DATABASE = db;
      // dlt reads DESTINATION__MOTHERDUCK__CREDENTIALS__DATABASE, not MOTHERDUCK_DATABASE.
      // Without this, dlt defaults to my_db while the app queries the connection catalog.
      if (!merged.DESTINATION__MOTHERDUCK__CREDENTIALS__DATABASE) {
        merged.DESTINATION__MOTHERDUCK__CREDENTIALS__DATABASE = db;
      }
    }
  }

  return merged;
}
