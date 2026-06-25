/** Subset of Python `credentials_config` — shows env keys users must set in the target repo. */
export type CredentialHint = {
  key: string;
  label: string;
  help?: string;
};

export const CREDENTIAL_HINTS: Record<string, CredentialHint[]> = {
  github: [
    {
      key: "GITHUB_TOKEN",
      label: "GitHub Personal Access Token",
      help: "https://github.com/settings/tokens",
    },
  ],
  rest_api: [
    { key: "REST_API_*", label: "Depends on auth type in your .env (bearer, api key, basic, …)" },
  ],
  stripe: [
    { key: "STRIPE_SECRET_KEY", label: "Stripe secret key", help: "Dashboard → Developers → API keys" },
  ],
  postgres: [
    { key: "POSTGRES_HOST", label: "Host" },
    { key: "POSTGRES_PORT", label: "Port" },
    { key: "POSTGRES_DATABASE", label: "Database" },
    { key: "POSTGRES_USER", label: "User" },
    { key: "POSTGRES_PASSWORD", label: "Password" },
  ],
  mysql: [
    { key: "MYSQL_HOST", label: "Host" },
    { key: "MYSQL_DATABASE", label: "Database" },
    { key: "MYSQL_USER", label: "User" },
    { key: "MYSQL_PASSWORD", label: "Password" },
  ],
  snowflake: [
    { key: "SNOWFLAKE_ACCOUNT", label: "Account" },
    { key: "SNOWFLAKE_USER", label: "User" },
    { key: "SNOWFLAKE_PASSWORD", label: "Password" },
    { key: "SNOWFLAKE_DATABASE", label: "Database" },
    { key: "SNOWFLAKE_WAREHOUSE", label: "Warehouse" },
  ],
  bigquery: [
    {
      key: "GOOGLE_APPLICATION_CREDENTIALS",
      label: "Service account JSON path",
      help: "Or configure BigQuery credentials in the exported project secrets file",
    },
    {
      key: "DESTINATION__BIGQUERY__CREDENTIALS",
      label: "Inline / env-style credentials (advanced)",
      help: "For named credential profiles in environment variables",
    },
  ],
  duckdb: [
    {
      key: "DEST_DUCKDB_PATH",
      label: "Database location",
      help: "s3:// or gs:// URI, or leave empty for eltPulse-managed internal storage",
    },
  ],
  motherduck: [
    {
      key: "MOTHERDUCK_TOKEN",
      label: "MotherDuck token",
      help: "https://motherduck.com/docs",
    },
    {
      key: "MOTHERDUCK_DATABASE",
      label: "MotherDuck database name",
      help: "Set on the connection (config) or as MOTHERDUCK_DATABASE in exported secrets",
    },
  ],
  sqlite: [
    {
      key: "SQLITE_DATABASE",
      label: "SQLite file path",
      help: "Path to the SQLite database file",
    },
  ],
  filesystem: [
    {
      key: "FILESYSTEM_PATH",
      label: "filesystem / bucket credentials",
      help: "Local path or cloud storage credentials depending on layout",
    },
  ],
  clickhouse: [
    { key: "CLICKHOUSE_HOST", label: "Host" },
    { key: "CLICKHOUSE_DATABASE", label: "Database" },
    { key: "CLICKHOUSE_USER", label: "User" },
    { key: "CLICKHOUSE_PASSWORD", label: "Password" },
  ],
  redshift: [
    { key: "REDSHIFT_HOST", label: "Host" },
    { key: "REDSHIFT_DATABASE", label: "Database" },
    { key: "REDSHIFT_USER", label: "User" },
    { key: "REDSHIFT_PASSWORD", label: "Password" },
  ],
  databricks: [
    { key: "DATABRICKS_HOST", label: "Workspace URL" },
    { key: "DATABRICKS_TOKEN", label: "Access token" },
    { key: "DATABRICKS_HTTP_PATH", label: "SQL warehouse HTTP path (if used)" },
  ],
};
