/**
 * Single source of truth for all source and destination connectors.
 *
 * Manual entries below cover warehouses, databases, and popular APIs with rich forms.
 * Every slug from dlt-hub-registry (111+ pipeline sources) is merged in automatically
 * for the Connections page — no per-source edits required.
 */

import { ALL_DLT_SOURCES, type DltHubSource } from "./dlt-hub-registry";
import {
  DUCKDB_DATABASE_CONFIG_FIELD,
  DUCKDB_S3_CREDENTIAL_FIELDS,
} from "./duckdb-destination";

export type CredentialField = {
  key: string;
  label: string;
  type: "text" | "password" | "textarea" | "select" | "boolean";
  required?: boolean;
  help?: string;
  placeholder?: string;
  default?: string | boolean | string[];
  options?: { value: string; label: string }[];
  show_if?: Record<string, unknown>;
};

export type ConfigField = {
  key: string;
  label: string;
  type: "text" | "password" | "textarea" | "select" | "boolean" | "multiselect";
  required?: boolean;
  help?: string;
  placeholder?: string;
  default?: string | boolean | string[];
  options?: { value: string; label: string }[];
  show_if?: Record<string, unknown>;
};

export type ConnectorDef = {
  slug: string;
  /** Display label — falls back to auto-capitalised slug if omitted */
  label?: string;
  /** Which connection form(s) this connector appears in */
  connectionTypes: ("source" | "destination")[];
  /** Category shown in the connection picker */
  category:
    | "Cloud Warehouses"
    | "Databases"
    | "Cloud Storage"
    | "APIs & SaaS"
    | "Files"
    | "Other";
  /** Non-secret config fields (host, bucket, project, …) */
  configFields?: ConfigField[];
  /** Secret fields shown in the stored-secrets form */
  credentialFields?: CredentialField[];
  /** Source-only: configuration fields for the pipeline wizard */
  sourceConfigFields?: ConfigField[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Cloud Warehouses (destination only)
// ─────────────────────────────────────────────────────────────────────────────

const WAREHOUSE_CONNECTORS: ConnectorDef[] = [
  {
    slug: "snowflake",
    connectionTypes: ["destination"],
    category: "Cloud Warehouses",
    configFields: [
      { key: "account", label: "Account", type: "text", placeholder: "xy12345.us-east-1" },
      { key: "database", label: "Database", type: "text" },
      { key: "warehouse", label: "Warehouse", type: "text" },
      { key: "role", label: "Role", type: "text" },
      { key: "username", label: "Username", type: "text" },
    ],
    credentialFields: [
      {
        key: "SNOWFLAKE_AUTH_METHOD",
        label: "Authentication Method",
        type: "select",
        required: true,
        options: [
          { value: "password", label: "Username & Password (least secure)" },
          { value: "keypair", label: "Key Pair Authentication (recommended)" },
        ],
        default: "password",
        help: "Key pair is more secure and recommended for production",
      },
      { key: "SNOWFLAKE_ACCOUNT", label: "Account", type: "text", required: true, placeholder: "xy12345.us-east-1", help: "Format: xy12345.us-east-1 (from Snowflake URL)" },
      { key: "SNOWFLAKE_USER", label: "Username", type: "text", required: true, placeholder: "myuser" },
      { key: "SNOWFLAKE_PASSWORD", label: "Password", type: "password", required: false, show_if: { SNOWFLAKE_AUTH_METHOD: "password" }, help: "Only required for password authentication" },
      { key: "SNOWFLAKE_PRIVATE_KEY", label: "Private Key (PEM format)", type: "textarea", required: false, show_if: { SNOWFLAKE_AUTH_METHOD: "keypair" }, help: "RSA private key in PEM format. Generate with: openssl genrsa -out rsa_key.pem 2048", placeholder: "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----" },
      { key: "SNOWFLAKE_PRIVATE_KEY_PASSPHRASE", label: "Private Key Passphrase (optional)", type: "password", required: false, show_if: { SNOWFLAKE_AUTH_METHOD: "keypair" }, help: "Only if your private key is encrypted" },
      { key: "SNOWFLAKE_DATABASE", label: "Database", type: "text", required: true, placeholder: "analytics" },
      { key: "SNOWFLAKE_WAREHOUSE", label: "Warehouse", type: "text", required: true, placeholder: "compute_wh" },
      { key: "SNOWFLAKE_ROLE", label: "Role", type: "text", required: false, placeholder: "analyst" },
    ],
  },
  {
    slug: "bigquery",
    connectionTypes: ["destination"],
    category: "Cloud Warehouses",
    configFields: [
      { key: "project", label: "Project ID", type: "text" },
      { key: "dataset", label: "Default dataset", type: "text" },
      { key: "location", label: "Location", type: "text", placeholder: "US" },
    ],
    credentialFields: [
      { key: "GCP_PROJECT_ID", label: "GCP Project ID", type: "text", required: true, placeholder: "my-project-123" },
      { key: "GCP_CREDENTIALS", label: "Service Account JSON", type: "textarea", required: true, help: "Paste the entire JSON content from your service account key file", placeholder: '{"type": "service_account", "project_id": "..."}' },
    ],
  },
  {
    slug: "redshift",
    connectionTypes: ["destination"],
    category: "Cloud Warehouses",
    configFields: [
      { key: "host", label: "Host", type: "text" },
      { key: "port", label: "Port", type: "text", placeholder: "5439" },
      { key: "database", label: "Database", type: "text" },
      { key: "username", label: "Username", type: "text" },
      { key: "schema", label: "Schema", type: "text" },
    ],
    credentialFields: [
      { key: "REDSHIFT_HOST", label: "Host", type: "text", required: true, placeholder: "cluster.xyz.region.redshift.amazonaws.com" },
      { key: "REDSHIFT_PORT", label: "Port", type: "text", required: false, placeholder: "5439" },
      { key: "REDSHIFT_DATABASE", label: "Database", type: "text", required: true, placeholder: "analytics" },
      { key: "REDSHIFT_USER", label: "Username", type: "text", required: true },
      { key: "REDSHIFT_PASSWORD", label: "Password", type: "password", required: true },
    ],
  },
  {
    slug: "databricks",
    connectionTypes: ["destination"],
    category: "Cloud Warehouses",
    configFields: [
      { key: "server_hostname", label: "Server hostname", type: "text" },
      { key: "http_path", label: "HTTP path", type: "text" },
      { key: "catalog", label: "Catalog", type: "text" },
      { key: "schema", label: "Schema", type: "text" },
    ],
    credentialFields: [
      { key: "DATABRICKS_HOST", label: "Databricks Host", type: "text", required: true, placeholder: "adb-1234567890123456.7.azuredatabricks.net" },
      { key: "DATABRICKS_TOKEN", label: "Access Token", type: "password", required: true, help: "Create at: User Settings → Developer → Access Tokens" },
      { key: "DATABRICKS_HTTP_PATH", label: "HTTP Path", type: "text", required: true, placeholder: "/sql/1.0/warehouses/abc123", help: "Find in SQL Warehouse → Connection Details" },
      { key: "DATABRICKS_CATALOG", label: "Catalog", type: "text", required: false, placeholder: "main" },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Databases (source + destination)
// ─────────────────────────────────────────────────────────────────────────────

const DATABASE_CONNECTORS: ConnectorDef[] = [
  {
    slug: "postgres",
    connectionTypes: ["source", "destination"],
    category: "Databases",
    configFields: [
      { key: "host", label: "Host", type: "text", placeholder: "db.example.com" },
      { key: "port", label: "Port", type: "text", placeholder: "5432" },
      { key: "database", label: "Database", type: "text" },
      { key: "username", label: "Username", type: "text" },
    ],
    credentialFields: [
      {
        key: "POSTGRES_AUTH_METHOD",
        label: "Authentication Method",
        type: "select",
        required: true,
        options: [
          { value: "password", label: "Password" },
          { value: "certificate", label: "SSL Certificate (more secure)" },
        ],
        default: "password",
      },
      { key: "POSTGRES_HOST", label: "Host", type: "text", required: true, placeholder: "localhost" },
      { key: "POSTGRES_PORT", label: "Port", type: "text", required: false, placeholder: "5432" },
      { key: "POSTGRES_DATABASE", label: "Database", type: "text", required: true, placeholder: "mydb" },
      { key: "POSTGRES_USER", label: "Username", type: "text", required: true, placeholder: "postgres" },
      { key: "POSTGRES_PASSWORD", label: "Password", type: "password", required: false, show_if: { POSTGRES_AUTH_METHOD: "password" }, help: "Only required for password authentication" },
      { key: "POSTGRES_SSL_CERT", label: "SSL Client Certificate Path", type: "text", required: false, show_if: { POSTGRES_AUTH_METHOD: "certificate" }, placeholder: "/path/to/client-cert.pem", help: "Path to client certificate file" },
      { key: "POSTGRES_SSL_KEY", label: "SSL Client Key Path", type: "text", required: false, show_if: { POSTGRES_AUTH_METHOD: "certificate" }, placeholder: "/path/to/client-key.pem", help: "Path to client private key file" },
      { key: "POSTGRES_SSL_ROOT_CERT", label: "SSL Root Certificate Path", type: "text", required: false, show_if: { POSTGRES_AUTH_METHOD: "certificate" }, placeholder: "/path/to/root-cert.pem", help: "Path to root CA certificate" },
    ],
    sourceConfigFields: [
      { key: "schemas", label: "Schema names (comma-separated)", type: "text", required: false, placeholder: "public, analytics", help: "Leave empty to load all schemas" },
      { key: "tables", label: "Table names (comma-separated)", type: "text", required: false, placeholder: "users, orders, products", help: "Leave empty to load all tables" },
      { key: "incremental", label: "Use incremental loading", type: "boolean", default: true, help: "Only load new/changed data on subsequent runs" },
    ],
  },
  {
    slug: "mysql",
    connectionTypes: ["source", "destination"],
    category: "Databases",
    configFields: [
      { key: "host", label: "Host", type: "text" },
      { key: "port", label: "Port", type: "text", placeholder: "3306" },
      { key: "database", label: "Database", type: "text" },
      { key: "username", label: "Username", type: "text" },
    ],
    credentialFields: [
      { key: "MYSQL_HOST", label: "Host", type: "text", required: true, placeholder: "localhost" },
      { key: "MYSQL_PORT", label: "Port", type: "text", required: false, placeholder: "3306" },
      { key: "MYSQL_DATABASE", label: "Database", type: "text", required: true, placeholder: "mydb" },
      { key: "MYSQL_USER", label: "Username", type: "text", required: true, placeholder: "root" },
      { key: "MYSQL_PASSWORD", label: "Password", type: "password", required: true },
    ],
    sourceConfigFields: [
      { key: "schemas", label: "Database/Schema names (comma-separated)", type: "text", required: false, placeholder: "mydb, analytics", help: "Leave empty to load all databases" },
      { key: "tables", label: "Table names (comma-separated)", type: "text", required: false, placeholder: "users, orders, products", help: "Leave empty to load all tables" },
      { key: "incremental", label: "Use incremental loading", type: "boolean", default: true },
    ],
  },
  {
    slug: "mssql",
    label: "SQL Server",
    connectionTypes: ["source", "destination"],
    category: "Databases",
    configFields: [
      { key: "host", label: "Host", type: "text" },
      { key: "port", label: "Port", type: "text", placeholder: "1433" },
      { key: "database", label: "Database", type: "text" },
      { key: "username", label: "Username", type: "text" },
    ],
    credentialFields: [
      { key: "MSSQL_HOST", label: "Server", type: "text", required: true, placeholder: "localhost" },
      { key: "MSSQL_PORT", label: "Port", type: "text", required: false, placeholder: "1433" },
      { key: "MSSQL_DATABASE", label: "Database", type: "text", required: true, placeholder: "master" },
      { key: "MSSQL_USER", label: "Username", type: "text", required: true, placeholder: "sa" },
      { key: "MSSQL_PASSWORD", label: "Password", type: "password", required: true },
    ],
  },
  {
    slug: "clickhouse",
    connectionTypes: ["source", "destination"],
    category: "Databases",
    configFields: [
      { key: "host", label: "Host", type: "text" },
      { key: "port", label: "Port", type: "text", placeholder: "9440" },
      { key: "database", label: "Database", type: "text" },
      { key: "username", label: "Username", type: "text" },
    ],
    credentialFields: [
      { key: "CLICKHOUSE_HOST", label: "Host", type: "text", required: true, placeholder: "localhost" },
      { key: "CLICKHOUSE_PORT", label: "Port", type: "text", required: false, placeholder: "9000" },
      { key: "CLICKHOUSE_DATABASE", label: "Database", type: "text", required: true, placeholder: "default" },
      { key: "CLICKHOUSE_USER", label: "Username", type: "text", required: true, placeholder: "default" },
      { key: "CLICKHOUSE_PASSWORD", label: "Password", type: "password", required: false },
    ],
  },
  {
    slug: "mongodb",
    connectionTypes: ["source"],
    category: "Databases",
    configFields: [
      { key: "host", label: "Host", type: "text" },
      { key: "database", label: "Database", type: "text" },
    ],
    credentialFields: [
      { key: "MONGODB_CONNECTION_STRING", label: "Connection String", type: "password", required: true, help: "Format: mongodb://user:password@host:port/database", placeholder: "mongodb://localhost:27017/mydb" },
    ],
    sourceConfigFields: [
      { key: "collections", label: "Collection names (comma-separated)", type: "text", required: false, placeholder: "users, orders, products", help: "Leave empty to load all collections" },
    ],
  },
  {
    slug: "trino",
    connectionTypes: ["source", "destination"],
    category: "Databases",
    credentialFields: [
      { key: "TRINO_HOST", label: "Host", type: "text", required: true, placeholder: "localhost" },
      { key: "TRINO_PORT", label: "Port", type: "text", required: false, placeholder: "8080" },
      { key: "TRINO_USER", label: "Username", type: "text", required: true, placeholder: "trino" },
      { key: "TRINO_CATALOG", label: "Catalog", type: "text", required: true, placeholder: "hive" },
      { key: "TRINO_SCHEMA", label: "Schema", type: "text", required: true, placeholder: "default" },
    ],
  },
  {
    slug: "duckdb",
    label: "DuckDB",
    connectionTypes: ["source", "destination"],
    category: "Databases",
    configFields: [DUCKDB_DATABASE_CONFIG_FIELD],
    credentialFields: [...DUCKDB_S3_CREDENTIAL_FIELDS],
    sourceConfigFields: [
      {
        key: "database",
        label: "Database location",
        type: "text",
        required: false,
        placeholder: "s3://my-bucket/source.duckdb",
        help: DUCKDB_DATABASE_CONFIG_FIELD.help,
      },
    ],
  },
  {
    slug: "motherduck",
    label: "MotherDuck",
    connectionTypes: ["destination"],
    category: "Cloud Warehouses",
    configFields: [
      {
        key: "database",
        label: "Database",
        type: "text",
        placeholder: "my_analytics",
        help: "MotherDuck database name (created if it does not exist).",
      },
    ],
    credentialFields: [
      {
        key: "MOTHERDUCK_TOKEN",
        label: "MotherDuck Token",
        type: "password",
        required: true,
        help: "app.motherduck.com → Settings → API Tokens",
      },
    ],
  },
  {
    slug: "sqlite",
    label: "SQLite",
    connectionTypes: ["source", "destination"],
    category: "Databases",
    credentialFields: [
      { key: "SQLITE_PATH", label: "Database File Path", type: "text", required: true, placeholder: "/path/to/database.db" },
    ],
  },
  {
    slug: "elasticsearch",
    label: "Elasticsearch",
    connectionTypes: ["destination"],
    category: "Databases",
    credentialFields: [
      { key: "ELASTICSEARCH_HOST", label: "Host", type: "text", required: true, placeholder: "localhost:9200", help: "Elasticsearch host with port" },
      { key: "ELASTICSEARCH_USERNAME", label: "Username", type: "text", required: false, placeholder: "elastic" },
      { key: "ELASTICSEARCH_PASSWORD", label: "Password", type: "password", required: false },
      { key: "ELASTICSEARCH_API_KEY", label: "API Key (alternative to password)", type: "password", required: false, help: "Use either API key or username/password" },
    ],
  },
  {
    slug: "druid",
    label: "Apache Druid",
    connectionTypes: ["destination"],
    category: "Databases",
    credentialFields: [
      { key: "DRUID_HOST", label: "Host", type: "text", required: true, placeholder: "localhost:8888", help: "Druid router host with port" },
      { key: "DRUID_USER", label: "Username (optional)", type: "text", required: false },
      { key: "DRUID_PASSWORD", label: "Password (optional)", type: "password", required: false },
    ],
  },
  {
    slug: "pinot",
    label: "Apache Pinot",
    connectionTypes: ["destination"],
    category: "Databases",
    credentialFields: [
      { key: "PINOT_BROKER_HOST", label: "Broker Host", type: "text", required: true, placeholder: "localhost" },
      { key: "PINOT_BROKER_PORT", label: "Broker Port", type: "text", required: false, placeholder: "8099" },
      { key: "PINOT_CONTROLLER_HOST", label: "Controller Host", type: "text", required: true, placeholder: "localhost" },
      { key: "PINOT_CONTROLLER_PORT", label: "Controller Port", type: "text", required: false, placeholder: "9000" },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Cloud Storage (source + destination)
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_CONNECTORS: ConnectorDef[] = [
  {
    slug: "s3",
    label: "Amazon S3",
    connectionTypes: ["source", "destination"],
    category: "Cloud Storage",
    configFields: [
      { key: "bucket", label: "Bucket", type: "text" },
      { key: "region", label: "Region", type: "text", placeholder: "us-east-1" },
      { key: "prefix", label: "Prefix / path", type: "text" },
    ],
    credentialFields: [
      { key: "AWS_ACCESS_KEY_ID", label: "AWS Access Key ID", type: "text", required: true },
      { key: "AWS_SECRET_ACCESS_KEY", label: "AWS Secret Access Key", type: "password", required: true },
      { key: "AWS_REGION", label: "AWS Region", type: "text", required: false, placeholder: "us-east-1" },
    ],
    sourceConfigFields: [
      { key: "bucket", label: "S3 Bucket Name", type: "text", required: true, placeholder: "my-data-bucket" },
      { key: "prefix", label: "Prefix/Path", type: "text", required: false, placeholder: "data/exports/", help: "Optional path within the bucket" },
      { key: "file_format", label: "File Format", type: "text", required: false, placeholder: "csv, json, parquet", help: "Expected file format in the bucket" },
    ],
  },
  {
    slug: "gcs",
    label: "Google Cloud Storage",
    connectionTypes: ["source", "destination"],
    category: "Cloud Storage",
    configFields: [
      { key: "bucket", label: "Bucket", type: "text" },
      { key: "project", label: "Project ID", type: "text" },
    ],
    credentialFields: [
      { key: "GCS_CREDENTIALS", label: "Service Account JSON", type: "textarea", required: true, help: "Service account with Storage Object Admin permission" },
    ],
  },
  {
    slug: "azure_blob",
    label: "Azure Blob",
    connectionTypes: ["source", "destination"],
    category: "Cloud Storage",
    configFields: [
      { key: "account_name", label: "Account name", type: "text" },
      { key: "container", label: "Container", type: "text" },
    ],
    credentialFields: [
      { key: "AZURE_STORAGE_ACCOUNT_NAME", label: "Storage Account Name", type: "text", required: true },
      { key: "AZURE_STORAGE_ACCOUNT_KEY", label: "Storage Account Key", type: "password", required: true },
    ],
  },
  {
    slug: "iceberg",
    label: "Apache Iceberg (S3 / object store)",
    connectionTypes: ["source", "destination"],
    category: "Cloud Storage",
    configFields: [
      { key: "warehouse", label: "Warehouse URI", type: "text", placeholder: "s3://my-lake/warehouse/", help: "Iceberg warehouse path (typically S3/GCS/ADLS)" },
      { key: "catalog", label: "Catalog", type: "select", default: "rest", options: [
        { value: "rest", label: "REST catalog" },
        { value: "glue", label: "AWS Glue" },
        { value: "hive", label: "Hive Metastore" },
        { value: "nessie", label: "Project Nessie" },
      ]},
      { key: "namespace", label: "Default namespace / schema", type: "text", placeholder: "analytics" },
      { key: "table_format", label: "Table format", type: "text", default: "iceberg", help: "Always iceberg — stored for destination codegen hints" },
    ],
    credentialFields: [
      { key: "AWS_ACCESS_KEY_ID", label: "AWS Access Key ID", type: "text", required: false, help: "For S3-backed warehouses" },
      { key: "AWS_SECRET_ACCESS_KEY", label: "AWS Secret Access Key", type: "password", required: false },
      { key: "AWS_REGION", label: "AWS Region", type: "text", required: false, placeholder: "us-east-1" },
      { key: "ICEBERG_REST_URI", label: "REST catalog URI", type: "text", required: false, placeholder: "https://catalog.example.com/api", show_if: { catalog: "rest" } },
    ],
    sourceConfigFields: [
      { key: "warehouse", label: "Warehouse URI", type: "text", required: true, placeholder: "s3://my-lake/warehouse/" },
      { key: "namespace", label: "Namespace", type: "text", required: false },
      { key: "table", label: "Table name", type: "text", required: false, help: "Optional — omit to sync all tables in namespace" },
      { key: "slice_column", label: "Slice column", type: "text", required: false, help: "Column for run-slice row filters (e.g. event_date). Omit for full table scans." },
      { key: "table_format", label: "Table format", type: "text", default: "iceberg" },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// APIs & SaaS (source only)
// ─────────────────────────────────────────────────────────────────────────────

const API_CONNECTORS: ConnectorDef[] = [
  {
    slug: "rest_api",
    label: "REST API",
    connectionTypes: ["source"],
    category: "APIs & SaaS",
    configFields: [
      { key: "base_url", label: "Base URL", type: "text" },
    ],
    credentialFields: [
      {
        key: "REST_API_AUTH_TYPE",
        label: "Authentication Type",
        type: "select",
        required: true,
        options: [
          { value: "none", label: "No Authentication" },
          { value: "bearer", label: "Bearer Token" },
          { value: "api_key", label: "API Key (Header)" },
          { value: "basic", label: "Basic Authentication" },
        ],
        default: "none",
        help: "Select how to authenticate with the API",
      },
      { key: "REST_API_BEARER_TOKEN", label: "Bearer Token", type: "password", required: true, show_if: { REST_API_AUTH_TYPE: "bearer" }, placeholder: "your-bearer-token", help: "Token will be sent as: Authorization: Bearer <token>" },
      { key: "REST_API_KEY_NAME", label: "API Key Header Name", type: "text", required: true, show_if: { REST_API_AUTH_TYPE: "api_key" }, placeholder: "X-API-Key", help: "Header name for the API key (e.g., X-API-Key, ApiKey)" },
      { key: "REST_API_KEY_VALUE", label: "API Key Value", type: "password", required: true, show_if: { REST_API_AUTH_TYPE: "api_key" }, placeholder: "your-api-key" },
      { key: "REST_API_BASIC_USERNAME", label: "Username", type: "text", required: true, show_if: { REST_API_AUTH_TYPE: "basic" }, placeholder: "username" },
      { key: "REST_API_BASIC_PASSWORD", label: "Password", type: "password", required: true, show_if: { REST_API_AUTH_TYPE: "basic" }, placeholder: "password" },
    ],
    sourceConfigFields: [
      { key: "base_url", label: "Base URL", type: "text", required: true, help: "The base URL for your API (e.g., https://api.example.com)", placeholder: "https://api.example.com" },
      { key: "resource_name", label: "Resource Name", type: "text", required: true, help: "Name for this data resource (will be used as table name)", placeholder: "users" },
      { key: "endpoint", label: "Endpoint Path", type: "text", required: true, help: "API endpoint path (e.g., /v1/users)", placeholder: "/v1/users" },
      { key: "http_method", label: "HTTP Method", type: "select", required: true, options: [{ value: "GET", label: "GET" }, { value: "POST", label: "POST" }], default: "GET" },
      { key: "pagination_type", label: "Pagination Strategy", type: "select", required: false, options: [{ value: "none", label: "No Pagination" }, { value: "auto", label: "Auto-detect" }, { value: "offset", label: "Offset-based (page number or offset)" }, { value: "cursor", label: "Cursor-based (next page token)" }, { value: "json_link", label: "JSON Link (next page URL in response)" }], default: "auto", help: "How the API handles pagination" },
      { key: "data_selector", label: "Data Selector (JSON Path)", type: "text", required: false, help: "Path to data in response (e.g., 'data.items' or 'results')", placeholder: "data" },
      { key: "advanced_mode", label: "Advanced Mode", type: "boolean", default: false, help: "Enable advanced JSON configuration for complex APIs" },
      { key: "advanced_config", label: "Advanced Configuration (JSON)", type: "textarea", required: false, show_if: { advanced_mode: true }, help: "Full REST API client configuration in JSON format. See eltPulse connector docs for examples.", placeholder: '{\n  "client": {\n    "base_url": "https://api.example.com"\n  },\n  "resources": [\n    {\n      "name": "users",\n      "endpoint": { "path": "/users" }\n    }\n  ]\n}' },
    ],
  },
  {
    slug: "github",
    connectionTypes: ["source"],
    category: "APIs & SaaS",
    configFields: [
      { key: "org", label: "Organization", type: "text" },
      { key: "repo", label: "Repository (optional)", type: "text" },
    ],
    credentialFields: [
      { key: "GITHUB_TOKEN", label: "GitHub Personal Access Token", type: "password", required: true, help: "Fine-grained (recommended): select repos + read Contents & Issues. Classic: enable repo scope.", placeholder: "ghp_xxxxxxxxxxxx" },
    ],
    sourceConfigFields: [
      { key: "repos", label: "Which repositories do you want to load?", type: "text", required: true, help: "Comma-separated list of repos in format owner/repo", placeholder: "my-org/my-repo, your-org/your-repo" },
      { key: "resources", label: "Select resources to load", type: "multiselect", required: false, help: "Select which GitHub resources to sync", options: [{ value: "issues", label: "Issues" }, { value: "pull_requests", label: "Pull Requests" }, { value: "repo_events", label: "Repository events" }, { value: "stargazers", label: "Stargazers" }], default: ["issues", "pull_requests"] },
    ],
  },
  {
    slug: "stripe",
    connectionTypes: ["source"],
    category: "APIs & SaaS",
    configFields: [
      { key: "account_id", label: "Account ID (optional)", type: "text" },
    ],
    credentialFields: [
      { key: "STRIPE_SECRET_KEY", label: "Stripe Secret Key", type: "password", required: true, help: "Find in Stripe Dashboard → Developers → API Keys", placeholder: "sk_live_xxxxxxxxxxxx" },
    ],
    sourceConfigFields: [
      { key: "resources", label: "Select resources to load", type: "multiselect", required: false, help: "Select which Stripe resources to sync", options: [{ value: "customers", label: "Customers" }, { value: "invoices", label: "Invoices" }, { value: "charges", label: "Charges / balance transactions" }, { value: "subscriptions", label: "Subscriptions" }, { value: "products", label: "Products" }, { value: "events", label: "Events" }], default: ["customers", "invoices", "subscriptions"] },
    ],
  },
  {
    slug: "shopify",
    connectionTypes: ["source"],
    category: "APIs & SaaS",
    configFields: [
      { key: "shop", label: "Shop subdomain", type: "text", placeholder: "my-store.myshopify.com" },
    ],
    credentialFields: [
      { key: "SHOPIFY_ACCESS_TOKEN", label: "Shopify Access Token", type: "password", required: true, help: "Create a private app in Shopify admin", placeholder: "shpat_xxxxxxxxxxxx" },
      { key: "SHOPIFY_SHOP_NAME", label: "Shop Name", type: "text", required: true, help: "Your store name (from mystore.myshopify.com)", placeholder: "mystore" },
    ],
    sourceConfigFields: [
      { key: "resources", label: "Select resources to load", type: "multiselect", required: false, options: [{ value: "orders", label: "Orders" }, { value: "customers", label: "Customers" }, { value: "products", label: "Products" }], default: ["orders", "customers", "products"] },
    ],
  },
  {
    slug: "salesforce",
    connectionTypes: ["source"],
    category: "APIs & SaaS",
    configFields: [
      { key: "domain", label: "Domain", type: "text", placeholder: "login" },
    ],
    credentialFields: [
      { key: "SALESFORCE_USERNAME", label: "Salesforce Username", type: "text", required: true, placeholder: "user@company.com" },
      { key: "SALESFORCE_PASSWORD", label: "Salesforce Password", type: "password", required: true },
      { key: "SALESFORCE_SECURITY_TOKEN", label: "Security Token", type: "password", required: true, help: "Reset at: Setup → My Personal Information → Reset Security Token" },
    ],
    sourceConfigFields: [
      { key: "standard_objects", label: "Select Standard Salesforce Objects", type: "multiselect", required: false, help: "Objects supported by the verified Salesforce dlt source", options: [{ value: "Account", label: "Account" }, { value: "Contact", label: "Contact" }, { value: "Lead", label: "Lead" }, { value: "Opportunity", label: "Opportunity" }, { value: "OpportunityLineItem", label: "Opportunity Line Item" }, { value: "Task", label: "Task" }, { value: "Event", label: "Event" }, { value: "Campaign", label: "Campaign" }, { value: "CampaignMember", label: "Campaign Member" }, { value: "Product2", label: "Product" }, { value: "Pricebook2", label: "Pricebook" }, { value: "PricebookEntry", label: "Pricebook Entry" }, { value: "User", label: "User" }, { value: "UserRole", label: "User Role" }], default: ["Account", "Contact", "Lead"] },
      { key: "custom_objects", label: "Custom Objects (optional)", type: "text", required: false, help: "Comma-separated list of custom Salesforce objects", placeholder: "MyCustomObject__c, AnotherObject__c" },
      { key: "use_bulk_api", label: "Use Bulk API (for large datasets)", type: "boolean", default: true },
    ],
  },
  {
    slug: "pipedrive",
    label: "Pipedrive",
    connectionTypes: ["source"],
    category: "APIs & SaaS",
    credentialFields: [
      {
        key: "PIPEDRIVE_API_KEY",
        label: "API Token",
        type: "password",
        required: true,
        help: "Find in Pipedrive → Personal preferences → API",
      },
    ],
  },
  {
    slug: "hubspot",
    label: "HubSpot",
    connectionTypes: ["source"],
    category: "APIs & SaaS",
    configFields: [
      { key: "account_id", label: "Account ID", type: "text" },
    ],
    credentialFields: [
      { key: "HUBSPOT_API_KEY", label: "HubSpot API Key", type: "password", required: true, help: "Find in Settings → Integrations → API Key" },
    ],
    sourceConfigFields: [
      { key: "resources", label: "Select resources to load", type: "multiselect", required: false, options: [{ value: "contacts", label: "Contacts" }, { value: "companies", label: "Companies" }, { value: "deals", label: "Deals" }, { value: "tickets", label: "Tickets" }, { value: "products", label: "Products" }], default: ["contacts", "companies", "deals"] },
    ],
  },
  {
    slug: "google_analytics",
    label: "Google Analytics",
    connectionTypes: ["source"],
    category: "APIs & SaaS",
    configFields: [
      { key: "property_id", label: "Property ID", type: "text" },
    ],
    credentialFields: [
      { key: "GOOGLE_ANALYTICS_CREDENTIALS", label: "Service Account JSON", type: "textarea", required: true, help: "Service account with Analytics API access" },
    ],
    sourceConfigFields: [
      { key: "property_id", label: "GA4 Property ID", type: "text", required: true, placeholder: "123456789" },
      { key: "dimensions", label: "Dimensions (comma-separated)", type: "text", required: false, placeholder: "date, city, deviceCategory", help: "GA4 dimension names" },
      { key: "metrics", label: "Metrics (comma-separated)", type: "text", required: false, placeholder: "activeUsers, sessions, pageviews", help: "GA4 metric names" },
    ],
  },
  {
    slug: "matomo",
    label: "Matomo",
    connectionTypes: ["source"],
    category: "APIs & SaaS",
    credentialFields: [
      { key: "MATOMO_URL", label: "Matomo URL", type: "text", required: true, placeholder: "https://analytics.example.com", help: "Base URL of your Matomo instance" },
      { key: "MATOMO_TOKEN_AUTH", label: "Token Auth", type: "password", required: true, help: "Administration → Personal → Security → Auth tokens" },
    ],
    sourceConfigFields: [
      { key: "site_id", label: "Site ID", type: "text", required: true, placeholder: "1", help: "Numeric site ID from Matomo" },
      { key: "live_events_site_id", label: "Live events site ID", type: "text", required: false, help: "Defaults to site_id for matomo_visits live stream" },
      { key: "queries", label: "Report queries (JSON)", type: "textarea", required: false, help: "When set, uses matomo_reports with incremental date slices per resource_name" },
    ],
  },
  {
    slug: "slack",
    label: "Slack",
    connectionTypes: ["source"],
    category: "APIs & SaaS",
    credentialFields: [
      { key: "SLACK_BOT_TOKEN", label: "Bot Token", type: "password", required: true, help: "Starts with xoxb-", placeholder: "xoxb-xxxxxxxxxxxx" },
    ],
    sourceConfigFields: [
      { key: "channels", label: "Channel IDs (comma-separated)", type: "text", required: false, placeholder: "C1234567890, C0987654321", help: "Leave empty to load all channels" },
      { key: "include_private", label: "Include private channels", type: "boolean", default: false },
    ],
  },
  {
    slug: "notion",
    label: "Notion",
    connectionTypes: ["source"],
    category: "APIs & SaaS",
    credentialFields: [
      { key: "NOTION_TOKEN", label: "Integration Token", type: "password", required: true, help: "Create at: https://www.notion.so/my-integrations" },
    ],
  },
  {
    slug: "airtable",
    label: "Airtable",
    connectionTypes: ["source"],
    category: "APIs & SaaS",
    credentialFields: [
      { key: "AIRTABLE_API_KEY", label: "API Key", type: "password", required: true, help: "Find in Account settings" },
    ],
    sourceConfigFields: [
      { key: "base_id", label: "Base ID", type: "text", required: true, placeholder: "appXXXXXXXXXXXXXX", help: "From the Airtable base URL (starts with app)" },
      { key: "table_names", label: "Table names (optional)", type: "text", required: false, placeholder: "Orders, Customers", help: "Comma-separated; leave empty to load all tables" },
    ],
  },
  {
    slug: "zendesk",
    label: "Zendesk",
    connectionTypes: ["source"],
    category: "APIs & SaaS",
    credentialFields: [
      { key: "ZENDESK_SUBDOMAIN", label: "Subdomain", type: "text", required: true, placeholder: "mycompany", help: "From mycompany.zendesk.com" },
      { key: "ZENDESK_EMAIL", label: "Email", type: "text", required: true },
      { key: "ZENDESK_API_TOKEN", label: "API Token", type: "password", required: true },
    ],
    sourceConfigFields: [
      { key: "resources", label: "Select resources to load", type: "multiselect", required: false, options: [{ value: "tickets", label: "Tickets" }, { value: "users", label: "Users" }, { value: "organizations", label: "Organizations" }, { value: "groups", label: "Groups" }], default: ["tickets", "users"] },
    ],
  },
  {
    slug: "freshdesk",
    label: "Freshdesk",
    connectionTypes: ["source"],
    category: "APIs & SaaS",
    credentialFields: [
      { key: "FRESHDESK_DOMAIN", label: "Domain", type: "text", required: true, placeholder: "mycompany", help: "From mycompany.freshdesk.com" },
      { key: "FRESHDESK_API_KEY", label: "API Key", type: "password", required: true, help: "Profile Settings → View API Key" },
    ],
    sourceConfigFields: [
      {
        key: "endpoints",
        label: "Endpoints to load",
        type: "multiselect",
        required: false,
        options: [
          { value: "tickets", label: "Tickets" },
          { value: "contacts", label: "Contacts" },
          { value: "agents", label: "Agents" },
          { value: "companies", label: "Companies" },
          { value: "groups", label: "Groups" },
          { value: "roles", label: "Roles" },
        ],
        default: ["tickets", "contacts"],
      },
    ],
  },
  {
    slug: "jira",
    label: "Jira",
    connectionTypes: ["source"],
    category: "APIs & SaaS",
    credentialFields: [
      { key: "JIRA_DOMAIN", label: "Domain", type: "text", required: true, placeholder: "mycompany.atlassian.net" },
      { key: "JIRA_EMAIL", label: "Email", type: "text", required: true },
      { key: "JIRA_API_TOKEN", label: "API Token", type: "password", required: true },
    ],
    sourceConfigFields: [
      { key: "projects", label: "Project keys (comma-separated)", type: "text", required: false, placeholder: "PROJ1, PROJ2", help: "Leave empty to load all projects" },
      { key: "resources", label: "Select resources to load", type: "multiselect", required: false, options: [{ value: "issues", label: "Issues" }, { value: "users", label: "Users" }, { value: "projects", label: "Projects" }, { value: "workflows", label: "Workflows" }], default: ["issues", "projects"] },
    ],
  },
  {
    slug: "facebook_ads",
    label: "Facebook Ads",
    connectionTypes: ["source"],
    category: "APIs & SaaS",
    credentialFields: [
      { key: "FACEBOOK_ACCESS_TOKEN", label: "Access Token", type: "password", required: true, help: "Create at: developers.facebook.com" },
      { key: "FACEBOOK_ADS_ACCOUNT_ID", label: "Ad Account ID", type: "text", required: true, placeholder: "act_1234567890" },
    ],
    sourceConfigFields: [
      { key: "resources", label: "Load mode", type: "select", default: "insights", options: [
        { value: "insights", label: "Insights (incremental, sliceable)" },
      ]},
    ],
  },
  {
    slug: "facebook_ads_catalog",
    label: "Facebook Ads (Catalog)",
    connectionTypes: ["source"],
    category: "APIs & SaaS",
    credentialFields: [
      { key: "FACEBOOK_ACCESS_TOKEN", label: "Access Token", type: "password", required: true, help: "Create at: developers.facebook.com" },
      { key: "FACEBOOK_ADS_ACCOUNT_ID", label: "Ad Account ID", type: "text", required: true, placeholder: "act_1234567890" },
    ],
    sourceConfigFields: [
      { key: "resources", label: "Object types", type: "multiselect", required: false, options: [
        { value: "campaigns", label: "Campaigns" },
        { value: "ads", label: "Ads" },
        { value: "ad_sets", label: "Ad sets" },
        { value: "ad_creatives", label: "Ad creatives" },
        { value: "leads", label: "Leads" },
      ], default: ["campaigns", "ads", "ad_sets"] },
    ],
  },
  {
    slug: "google_ads",
    label: "Google Ads",
    connectionTypes: ["source"],
    category: "APIs & SaaS",
    credentialFields: [
      { key: "GOOGLE_ADS_DEVELOPER_TOKEN", label: "Developer Token", type: "password", required: true },
      { key: "GOOGLE_ADS_CLIENT_ID", label: "Client ID", type: "text", required: true },
      { key: "GOOGLE_ADS_CLIENT_SECRET", label: "Client Secret", type: "password", required: true },
      { key: "GOOGLE_ADS_REFRESH_TOKEN", label: "Refresh Token", type: "password", required: true },
    ],
  },
  {
    slug: "intercom",
    label: "Intercom",
    connectionTypes: ["source"],
    category: "APIs & SaaS",
    credentialFields: [
      { key: "INTERCOM_ACCESS_TOKEN", label: "Access Token", type: "password", required: true, help: "Find in Intercom Developer Hub" },
    ],
    sourceConfigFields: [
      { key: "region", label: "Data region", type: "select", default: "us", options: [
        { value: "us", label: "US (api.intercom.io)" },
        { value: "eu", label: "EU (api.eu.intercom.io)" },
        { value: "au", label: "AU (api.au.intercom.io)" },
      ]},
    ],
  },
  {
    slug: "mixpanel",
    label: "Mixpanel",
    connectionTypes: ["source"],
    category: "APIs & SaaS",
    credentialFields: [
      { key: "MIXPANEL_API_SECRET", label: "API Secret", type: "password", required: true, help: "Find in Project Settings" },
    ],
    sourceConfigFields: [
      { key: "project_id", label: "Project ID", type: "text", required: true, help: "Numeric project ID from Mixpanel project settings" },
    ],
  },
  {
    slug: "segment",
    label: "Segment",
    connectionTypes: ["source"],
    category: "APIs & SaaS",
    credentialFields: [
      { key: "SEGMENT_ACCESS_TOKEN", label: "Config API Token", type: "password", required: true, help: "Workspace token for Segment Public API (not the source write key)" },
      { key: "SEGMENT_WRITE_KEY", label: "Write Key (optional)", type: "password", required: false, help: "For event ingestion only — not used by this connector" },
    ],
  },
  {
    slug: "asana",
    label: "Asana",
    connectionTypes: ["source"],
    category: "APIs & SaaS",
    credentialFields: [
      { key: "ASANA_ACCESS_TOKEN", label: "Personal Access Token", type: "password", required: true, help: "Create at: app.asana.com/0/my-apps" },
    ],
  },
  {
    slug: "personio",
    label: "Personio",
    connectionTypes: ["source"],
    category: "APIs & SaaS",
    credentialFields: [
      { key: "PERSONIO_CLIENT_ID", label: "Client ID", type: "text", required: true },
      { key: "PERSONIO_CLIENT_SECRET", label: "Client Secret", type: "password", required: true, help: "Developer credentials in Personio Settings" },
    ],
  },
  {
    slug: "strapi",
    label: "Strapi",
    connectionTypes: ["source"],
    category: "APIs & SaaS",
    credentialFields: [
      { key: "STRAPI_API_TOKEN", label: "API Token", type: "password", required: true },
      { key: "STRAPI_DOMAIN", label: "Domain", type: "text", required: true, placeholder: "cms.example.com", help: "Host only — no https://" },
    ],
    sourceConfigFields: [
      {
        key: "endpoints",
        label: "Content types (collections)",
        type: "text",
        required: true,
        placeholder: "articles, categories",
        help: "Comma-separated Strapi collection API names",
      },
    ],
  },
  {
    slug: "workable",
    label: "Workable",
    connectionTypes: ["source"],
    category: "APIs & SaaS",
    credentialFields: [
      { key: "WORKABLE_ACCESS_TOKEN", label: "API Token", type: "password", required: true, help: "Generate in Workable → Integrations → API" },
      { key: "WORKABLE_SUBDOMAIN", label: "Account Subdomain", type: "text", required: true, placeholder: "acme", help: "From acme.workable.com" },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Files (source only)
// ─────────────────────────────────────────────────────────────────────────────

const FILE_CONNECTORS: ConnectorDef[] = [
  {
    slug: "csv",
    label: "CSV",
    connectionTypes: ["source"],
    category: "Files",
    credentialFields: [],
    sourceConfigFields: [
      { key: "file_path", label: "CSV File Path", type: "text", required: true, placeholder: "/path/to/data.csv" },
      { key: "delimiter", label: "Delimiter", type: "text", required: false, placeholder: ",", default: "," },
    ],
  },
  {
    slug: "json",
    label: "JSON",
    connectionTypes: ["source"],
    category: "Files",
    credentialFields: [],
  },
  {
    slug: "parquet",
    label: "Parquet",
    connectionTypes: ["source"],
    category: "Files",
    credentialFields: [],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Hub registry bridge (111+ pipeline sources → connection forms)
// ─────────────────────────────────────────────────────────────────────────────

function hubCategoryToConnectionCategory(
  category: DltHubSource["category"]
): ConnectorDef["category"] {
  if (category === "Databases") return "Databases";
  if (category === "Storage & Files") return "Cloud Storage";
  return "APIs & SaaS";
}

function envKeyForHubParam(slug: string, param: string): string {
  const normalized = param.toUpperCase().replace(/-/g, "_");
  const prefix = slug.toUpperCase().replace(/-/g, "_");
  if (
    normalized === "API_KEY" ||
    normalized === "ACCESS_TOKEN" ||
    normalized === "API_TOKEN" ||
    normalized === "PRIVATE_TOKEN" ||
    normalized === "AUTH_TOKEN"
  ) {
    return `${prefix}_${normalized}`;
  }
  return normalized.includes("_") ? normalized : `${prefix}_${normalized}`;
}

function credentialFieldsFromHubSource(src: DltHubSource): CredentialField[] {
  if (src.params.length === 0) {
    const prefix = src.slug.toUpperCase().replace(/-/g, "_");
    return [
      {
        key: `${prefix}_ACCESS_TOKEN`,
        label: "API credentials",
        type: "password",
        required: true,
        help: src.auth.length ? `Auth: ${src.auth.join(", ")}` : "Paste API token or key for this source",
      },
    ];
  }

  return src.params.map((param) => ({
    key: envKeyForHubParam(src.slug, param),
    label: param.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    type: /password|secret|token|key|pass/i.test(param) ? "password" : "text",
    required: !/optional/i.test(param),
    help: src.auth.length ? src.auth.join(", ") : undefined,
  }));
}

function extendConnectorsWithHubSources(manual: ConnectorDef[]): ConnectorDef[] {
  const seen = new Set(manual.map((c) => c.slug.toLowerCase()));
  const extras: ConnectorDef[] = [];

  for (const src of ALL_DLT_SOURCES) {
    const slug = src.slug.toLowerCase();
    if (seen.has(slug)) continue;
    seen.add(slug);
    extras.push({
      slug: src.slug,
      label: src.name,
      connectionTypes: ["source"],
      category: hubCategoryToConnectionCategory(src.category),
      credentialFields: credentialFieldsFromHubSource(src),
    });
  }

  return [...manual, ...extras];
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

const MANUAL_CONNECTORS: ConnectorDef[] = [
  ...WAREHOUSE_CONNECTORS,
  ...DATABASE_CONNECTORS,
  ...STORAGE_CONNECTORS,
  ...API_CONNECTORS,
  ...FILE_CONNECTORS,
];

/** Manual connectors + every dlt-hub-registry source (111+) for connections UI. */
export const ALL_CONNECTORS: ConnectorDef[] = extendConnectorsWithHubSources(MANUAL_CONNECTORS);

/** Human-readable label for a connector slug */
export function connectorLabel(slug: string): string {
  const found = ALL_CONNECTORS.find((c) => c.slug === slug);
  if (found?.label) return found.label;
  return slug.charAt(0).toUpperCase() + slug.slice(1).replace(/_/g, " ");
}

/** All slugs valid as source connections */
export const SOURCE_CONNECTOR_SLUGS: string[] = ALL_CONNECTORS
  .filter((c) => c.connectionTypes.includes("source"))
  .map((c) => c.slug);

/** All slugs valid as destination connections */
export const DESTINATION_CONNECTOR_SLUGS: string[] = ALL_CONNECTORS
  .filter((c) => c.connectionTypes.includes("destination"))
  .map((c) => c.slug);

/** Config fields (non-secret) for a connector, keyed by slug */
export function getConnectorConfigFields(slug: string): ConfigField[] {
  return ALL_CONNECTORS.find((c) => c.slug === slug)?.configFields ?? [];
}

/** Credential (secret) fields for a source connector */
export function getConnectorSourceCredentials(slug: string): CredentialField[] {
  const c = ALL_CONNECTORS.find((x) => x.slug === slug);
  if (!c) return [];
  if (!c.connectionTypes.includes("source")) return [];
  return c.credentialFields ?? [];
}

/** Credential (secret) fields for a destination connector */
export function getConnectorDestinationCredentials(slug: string): CredentialField[] {
  const c = ALL_CONNECTORS.find((x) => x.slug === slug);
  if (!c) return [];
  if (!c.connectionTypes.includes("destination")) return [];
  return c.credentialFields ?? [];
}

/** Flat option list for ConnectorCombobox — sources */
export const SOURCE_CONNECTOR_OPTIONS: { slug: string; label: string; category: string }[] =
  ALL_CONNECTORS
    .filter((c) => c.connectionTypes.includes("source"))
    .map((c) => ({ slug: c.slug, label: c.label ?? connectorLabel(c.slug), category: c.category }));

/** Flat option list for ConnectorCombobox — destinations */
export const DESTINATION_CONNECTOR_OPTIONS: { slug: string; label: string; category: string }[] =
  ALL_CONNECTORS
    .filter((c) => c.connectionTypes.includes("destination"))
    .map((c) => ({ slug: c.slug, label: c.label ?? connectorLabel(c.slug), category: c.category }));

/** Source-wizard configuration fields for a source connector */
export function getConnectorSourceConfigFields(slug: string): ConfigField[] {
  return ALL_CONNECTORS.find((c) => c.slug === slug)?.sourceConfigFields ?? [];
}
