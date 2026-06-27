// web/lib/elt/native-components/definitions/ingestion-hints.ts
var mongodbIngestComponent = {
  id: "mongodb_ingestion",
  name: "MongoDB ingest",
  category: "ingestion",
  description: "Merge MongoDB connection hints for dlt mongodb source.",
  compileTarget: "dlt",
  fields: [
    { key: "connection_url", label: "MongoDB connection URL", type: "string", required: true },
    { key: "database", label: "Database", type: "string", required: true },
    { key: "collection", label: "Collection", type: "string" },
    { key: "resource_name", label: "Destination table name", type: "string" }
  ],
  compile(config) {
    const connectionUrl = String(config.connection_url ?? config.mongo_url ?? "").trim();
    const database = String(config.database ?? config.db ?? "").trim();
    if (!connectionUrl || !database) {
      return { warnings: ["mongodb_ingestion: connection_url and database required"], configPatch: {} };
    }
    const collection = String(config.collection ?? config.collection_name ?? "").trim();
    return {
      configPatch: {
        elt_native_ingestion: "mongodb",
        mongodb_connection_url: connectionUrl,
        mongodb_database: database,
        ...collection ? { mongodb_collection: collection } : {},
        resource_name: String(config.resource_name ?? (collection || database))
      }
    };
  }
};

// ../../../../../tmp/eltpulse-compile-EyK14Q/mongodb_ingestion.ts
function compile(config) {
  return mongodbIngestComponent.compile(config);
}
export {
  compile
};
