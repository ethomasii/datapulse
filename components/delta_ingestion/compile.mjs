// web/lib/elt/native-components/definitions/ingestion-hints.ts
var deltaIngestComponent = {
  id: "delta_ingestion",
  aliases: ["delta_lake_ingestion"],
  name: "Delta Lake ingest",
  category: "ingestion",
  description: "Merge Delta Lake table path hints for delta-rs ingestion.",
  compileTarget: "dlt",
  fields: [
    { key: "table_uri", label: "Delta table URI", description: "s3://bucket/path or abfss://...", type: "string", required: true },
    { key: "version", label: "Table version (time travel)", type: "number" },
    { key: "resource_name", label: "Destination table name", type: "string" }
  ],
  compile(config) {
    const tableUri = String(config.table_uri ?? config.delta_path ?? config.path ?? "").trim();
    if (!tableUri) {
      return { warnings: ["delta_ingestion: table_uri is required"], configPatch: {} };
    }
    const version = config.version != null ? Number(config.version) : void 0;
    return {
      configPatch: {
        elt_native_ingestion: "delta",
        delta_table_uri: tableUri,
        resource_name: String(config.resource_name ?? config.table_name ?? "delta_table"),
        ...version != null && !Number.isNaN(version) ? { delta_version: version } : {}
      }
    };
  }
};

// ../../../../../tmp/eltpulse-compile-EyK14Q/delta_ingestion.ts
function compile(config) {
  return deltaIngestComponent.compile(config);
}
export {
  compile
};
