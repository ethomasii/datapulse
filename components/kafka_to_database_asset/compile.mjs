// web/lib/elt/native-components/definitions/ingestion-hints.ts
var kafkaIngestComponent = {
  id: "kafka_to_database_asset",
  name: "Kafka ingest",
  category: "ingestion",
  description: "Merge Kafka consumer hints into source configuration.",
  compileTarget: "dlt",
  fields: [
    { key: "bootstrap_servers", label: "Bootstrap servers", type: "string", required: true },
    { key: "topic", label: "Topic", type: "string", required: true },
    { key: "group_id", label: "Consumer group", type: "string", default: "eltpulse_consumer" },
    { key: "resource_name", label: "Table name", type: "string" }
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
        resource_name: String(config.resource_name ?? topic.replace(/[^a-zA-Z0-9_]/g, "_"))
      }
    };
  }
};

// ../../../../../tmp/eltpulse-compile-EyK14Q/kafka_to_database_asset.ts
function compile(config) {
  return kafkaIngestComponent.compile(config);
}
export {
  compile
};
