import type { NativeComponentDefinition } from "../types";

export const s3IngestComponent: NativeComponentDefinition = {
  id: "s3_to_database_asset",
  aliases: ["csv_file_ingestion", "file_ingestion"],
  name: "S3 / file ingest",
  category: "ingestion",
  description: "Merge filesystem/S3 ingest hints into source configuration for dlt codegen.",
  compileTarget: "dlt",
  fields: [
    {
      key: "bucket_url",
      label: "Bucket URL or path",
      description: "s3://bucket/prefix or local path",
      type: "string",
      required: true,
    },
    { key: "file_glob", label: "File glob", type: "string", default: "**/*" },
    { key: "table_name", label: "Destination table name", type: "string" },
  ],
  compile(config) {
    const bucketUrl = String(
      config.bucket_url ?? config.s3_path ?? config.path ?? config.prefix ?? ""
    ).trim();
    if (!bucketUrl) {
      return { warnings: ["s3_to_database_asset: bucket_url is required"], configPatch: {} };
    }
    const fileGlob = String(config.file_glob ?? config.glob ?? "**/*").trim();
    const tableName = String(config.table_name ?? config.resource_name ?? "files_data").trim();

    return {
      configPatch: {
        elt_native_ingestion: "filesystem",
        bucket_url: bucketUrl,
        file_glob: fileGlob,
        resource_name: tableName,
        files_path: bucketUrl,
      },
      warnings: [
        "Set pipeline source to filesystem/files when using S3 ingest component, or rely on existing source.",
      ],
    };
  },
};

export const sqsIngestComponent: NativeComponentDefinition = {
  id: "sqs_to_database_asset",
  name: "SQS queue ingest",
  category: "ingestion",
  description: "Merge SQS queue ingest hints for dlt REST/queue patterns.",
  compileTarget: "dlt",
  fields: [
    { key: "queue_url", label: "Queue URL", type: "string", required: true },
    { key: "resource_name", label: "Resource / table name", type: "string", default: "sqs_messages" },
  ],
  compile(config) {
    const queueUrl = String(config.queue_url ?? config.queueUrl ?? "").trim();
    if (!queueUrl) {
      return { warnings: ["sqs_to_database_asset: queue_url is required"], configPatch: {} };
    }
    return {
      configPatch: {
        elt_native_ingestion: "queue",
        queue_url: queueUrl,
        resource_name: String(config.resource_name ?? "sqs_messages"),
      },
    };
  },
};

export const kafkaIngestComponent: NativeComponentDefinition = {
  id: "kafka_to_database_asset",
  name: "Kafka ingest",
  category: "ingestion",
  description: "Merge Kafka consumer hints into source configuration.",
  compileTarget: "dlt",
  fields: [
    { key: "bootstrap_servers", label: "Bootstrap servers", type: "string", required: true },
    { key: "topic", label: "Topic", type: "string", required: true },
    { key: "group_id", label: "Consumer group", type: "string", default: "eltpulse_consumer" },
    { key: "resource_name", label: "Table name", type: "string" },
  ],
  compile(config) {
    const bootstrap = String(config.bootstrap_servers ?? config.brokers ?? "").trim();
    const topic = String(config.topic ?? config.topics ?? "").trim();
    if (!bootstrap || !topic) {
      return { warnings: ["kafka_to_database_asset: bootstrap_servers and topic required"], configPatch: {} };
    }
    return {
      configPatch: {
        elt_native_ingestion: "kafka",
        bootstrap_servers: bootstrap,
        topic,
        group_id: String(config.group_id ?? "eltpulse_consumer"),
        resource_name: String(config.resource_name ?? topic.replace(/[^a-zA-Z0-9_]/g, "_")),
      },
    };
  },
};

export const restApiIngestComponent: NativeComponentDefinition = {
  id: "rest_api_fetcher",
  name: "REST API fetch",
  category: "ingestion",
  description: "Merge REST API source hints for dlt rest_api connector.",
  compileTarget: "dlt",
  fields: [
    { key: "base_url", label: "Base URL", type: "string", required: true },
    { key: "endpoint", label: "Endpoint path", type: "string", default: "/" },
    { key: "resource_name", label: "Resource name", type: "string", required: true },
    {
      key: "pagination_type",
      label: "Pagination",
      type: "select",
      options: ["auto", "cursor", "offset", "none"],
      default: "auto",
    },
    { key: "data_selector", label: "Data JSON path", type: "string", placeholder: "data" },
  ],
  compile(config) {
    const baseUrl = String(config.base_url ?? "").trim();
    const resourceName = String(config.resource_name ?? config.table_name ?? "").trim();
    if (!baseUrl || !resourceName) {
      return { warnings: ["rest_api_fetcher: base_url and resource_name required"], configPatch: {} };
    }
    return {
      configPatch: {
        elt_native_ingestion: "rest_api",
        base_url: baseUrl,
        endpoint: String(config.endpoint ?? "/"),
        resource_name: resourceName,
        pagination_type: String(config.pagination_type ?? "auto"),
        ...(config.data_selector ? { data_selector: String(config.data_selector) } : {}),
      },
    };
  },
};

export const sqlToDatabaseComponent: NativeComponentDefinition = {
  id: "sql_to_database_asset",
  aliases: ["database_replication"],
  name: "SQL database replicate",
  category: "ingestion",
  description: "Merge Sling/database replication table hints into source configuration.",
  compileTarget: "sling",
  fields: [
    {
      key: "tables",
      label: "Tables",
      description: "schema.table list",
      type: "string_list",
      required: true,
    },
  ],
  compile(config) {
    const tables = Array.isArray(config.tables)
      ? config.tables.map(String).filter(Boolean)
      : String(config.tables ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
    if (!tables.length) {
      return { warnings: ["sql_to_database_asset: tables required"], configPatch: {} };
    }
    return {
      configPatch: {
        elt_native_ingestion: "sling",
        tables: tables.join(","),
      },
    };
  },
};

export const gcsIngestComponent: NativeComponentDefinition = {
  id: "gcs_to_database_asset",
  aliases: ["adls_to_database_asset"],
  name: "GCS / cloud storage ingest",
  category: "ingestion",
  description: "Merge GCS/cloud filesystem ingest hints into source configuration.",
  compileTarget: "dlt",
  fields: [
    { key: "bucket_url", label: "Bucket URL", description: "gs://bucket/prefix", type: "string", required: true },
    { key: "file_glob", label: "File glob", type: "string", default: "**/*" },
    { key: "table_name", label: "Destination table name", type: "string" },
  ],
  compile(config) {
    const bucketUrl = String(
      config.bucket_url ?? config.gcs_path ?? config.path ?? config.prefix ?? ""
    ).trim();
    if (!bucketUrl) {
      return { warnings: ["gcs_to_database_asset: bucket_url is required"], configPatch: {} };
    }
    const fileGlob = String(config.file_glob ?? config.glob ?? "**/*").trim();
    const tableName = String(config.table_name ?? config.resource_name ?? "files_data").trim();
    return {
      configPatch: {
        elt_native_ingestion: "filesystem",
        bucket_url: bucketUrl,
        file_glob: fileGlob,
        resource_name: tableName,
        files_path: bucketUrl,
      },
    };
  },
};
