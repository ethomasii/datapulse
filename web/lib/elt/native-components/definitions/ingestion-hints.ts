import type { NativeComponentDefinition } from "../types";

export const s3IngestComponent: NativeComponentDefinition = {
  id: "s3_to_database_asset",
  aliases: ["csv_file_ingestion"],
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

export const sqlToDatabaseComponent: NativeComponentDefinition = {
  id: "sql_to_database_asset",
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
