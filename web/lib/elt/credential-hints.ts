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
      key: "DESTINATION__DUCKDB__CREDENTIALS",
      label: "DuckDB database path",
      help: "Path to the DuckDB file for local or embedded analytics",
    },
    {
      key: "DUCKDB_DATABASE",
      label: "Database path (env)",
      help: "When using environment-based configuration",
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
      help: "Token and database in exported project secrets",
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
