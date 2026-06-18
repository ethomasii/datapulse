// web/lib/elt/native-components/definitions/ingestion-hints.ts
var gcsIngestComponent = {
  id: "gcs_to_database_asset",
  aliases: ["adls_to_database_asset"],
  name: "GCS / cloud storage ingest",
  category: "ingestion",
  description: "Merge GCS/cloud filesystem ingest hints into source configuration.",
  compileTarget: "dlt",
  fields: [
    { key: "bucket_url", label: "Bucket URL", description: "gs://bucket/prefix", type: "string", required: true },
    { key: "file_glob", label: "File glob", type: "string", default: "**/*" },
    { key: "table_name", label: "Destination table name", type: "string" }
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
        files_path: bucketUrl
      }
    };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-gKMp94/gcs_to_database_asset.ts
function compile(config) {
  return gcsIngestComponent.compile(config);
}
export {
  compile
};
