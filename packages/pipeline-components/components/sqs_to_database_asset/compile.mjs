// web/lib/elt/native-components/definitions/ingestion-hints.ts
var sqsIngestComponent = {
  id: "sqs_to_database_asset",
  name: "SQS queue ingest",
  category: "ingestion",
  description: "Merge SQS queue ingest hints for dlt REST/queue patterns.",
  compileTarget: "dlt",
  fields: [
    { key: "queue_url", label: "Queue URL", type: "string", required: true },
    { key: "resource_name", label: "Resource / table name", type: "string", default: "sqs_messages" }
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
        resource_name: String(config.resource_name ?? "sqs_messages")
      }
    };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-gKMp94/sqs_to_database_asset.ts
function compile(config) {
  return sqsIngestComponent.compile(config);
}
export {
  compile
};
