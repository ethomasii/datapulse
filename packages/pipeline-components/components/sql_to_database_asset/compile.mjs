// web/lib/elt/native-components/definitions/ingestion-hints.ts
var sqlToDatabaseComponent = {
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
      required: true
    }
  ],
  compile(config) {
    const tables = Array.isArray(config.tables) ? config.tables.map(String).filter(Boolean) : String(config.tables ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!tables.length) {
      return { warnings: ["sql_to_database_asset: tables required"], configPatch: {} };
    }
    return {
      configPatch: {
        elt_native_ingestion: "sling",
        tables: tables.join(",")
      }
    };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-0FtTsZ/sql_to_database_asset.ts
function compile(config) {
  return sqlToDatabaseComponent.compile(config);
}
export {
  compile
};
