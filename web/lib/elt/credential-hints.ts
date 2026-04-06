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
  /** dlt BigQuery destination — see https://dlthub.com/docs/dlt-ecosystem/destinations/bigquery */
  bigquery: [
    {
      key: "GOOGLE_APPLICATION_CREDENTIALS",
      label: "Service account JSON path",
      help: "Or configure the bigquery block in .dlt/secrets.toml",
    },
    {
      key: "DESTINATION__BIGQUERY__CREDENTIALS",
      label: "Inline / env-style credentials (advanced)",
      help: "Per dlt secrets resolution for named profiles",
    },
  ],
  /** dlt DuckDB — file path is the main secret */
  duckdb: [
    {
      key: ".dlt/secrets.toml",
      label: "duckdb.credentials",
      help: "Typically database path for the DuckDB file (see dlt DuckDB destination)",
    },
    {
      key: "DESTINATION__DUCKDB__CREDENTIALS",
      label: "Env-style path object",
      help: "When using environment-based dlt configuration",
    },
  ],
  motherduck: [
    {
      key: "MOTHERDUCK_TOKEN",
      label: "MotherDuck token",
      help: "https://motherduck.com/docs",
    },
    {
      key: ".dlt/secrets.toml",
      label: "motherduck.credentials",
      help: "Token and database in dlt secrets",
    },
  ],
  sqlite: [
    {
      key: ".dlt/secrets.toml",
      label: "sqlite.credentials (file path)",
      help: "dlt SQLite destination",
    },
  ],
  filesystem: [
    {
      key: ".dlt/secrets.toml",
      label: "filesystem / bucket credentials",
      help: "Depends on layout (local path vs cloud); see dlt filesystem destination",
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
