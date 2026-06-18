import type { NativeComponentDefinition } from "../types";

const MONITOR_TYPES: Record<string, string> = {
  s3_monitor: "s3_file_count",
  sqs_monitor: "sqs_message_count",
  gcs_monitor: "gcs_file_arrival",
  kafka_monitor: "kafka_message_count",
  sql_monitor: "sql_watermark",
  adls_monitor: "adls_file_count",
};

function buildSensorMonitor(
  componentId: string,
  label: string,
  cfg: Record<string, unknown>
) {
  return {
    configPatch: {
      elt_canvas_sensors: [
        {
          component_id: componentId,
          monitor_type: MONITOR_TYPES[componentId] ?? "s3_file_count",
          label,
          config: { ...cfg, template_id: componentId },
        },
      ],
    },
  };
}

export const s3MonitorComponent: NativeComponentDefinition = {
  id: "s3_monitor",
  name: "S3 file sensor",
  category: "sensor",
  description: "Monitor S3 prefix for new files; creates EltMonitor on canvas save.",
  compileTarget: "monitor",
  fields: [
    { key: "bucket_name", label: "Bucket", type: "string", required: true },
    { key: "prefix", label: "Prefix", type: "string", placeholder: "incoming/" },
    { key: "threshold", label: "Min new files", type: "number", default: 1 },
    { key: "key_pattern", label: "Key pattern (regex)", type: "string", default: ".*" },
  ],
  compile: (cfg) => buildSensorMonitor("s3_monitor", "S3 monitor", cfg),
};

export const sqsMonitorComponent: NativeComponentDefinition = {
  id: "sqs_monitor",
  name: "SQS sensor",
  category: "sensor",
  description: "Monitor SQS queue depth / message arrival.",
  compileTarget: "monitor",
  fields: [
    { key: "queue_url", label: "Queue URL", type: "string", required: true },
    { key: "threshold", label: "Min messages", type: "number", default: 1 },
  ],
  compile: (cfg) => buildSensorMonitor("sqs_monitor", "SQS monitor", cfg),
};

export const gcsMonitorComponent: NativeComponentDefinition = {
  id: "gcs_monitor",
  name: "GCS file sensor",
  category: "sensor",
  description: "Monitor GCS prefix for new objects.",
  compileTarget: "monitor",
  fields: [
    { key: "bucket", label: "Bucket", type: "string", required: true },
    { key: "prefix", label: "Prefix", type: "string" },
    { key: "file_pattern", label: "File pattern", type: "string", default: ".*" },
  ],
  compile: (cfg) => buildSensorMonitor("gcs_monitor", "GCS monitor", cfg),
};

export const kafkaMonitorComponent: NativeComponentDefinition = {
  id: "kafka_monitor",
  name: "Kafka lag sensor",
  category: "sensor",
  description: "Monitor Kafka consumer lag for a topic.",
  compileTarget: "monitor",
  fields: [
    { key: "bootstrap_servers", label: "Bootstrap servers", type: "string", required: true },
    { key: "topic", label: "Topic", type: "string", required: true },
    { key: "group_id", label: "Consumer group", type: "string", required: true },
    { key: "max_lag", label: "Max lag threshold", type: "number", default: 1000 },
  ],
  compile: (cfg) => buildSensorMonitor("kafka_monitor", "Kafka monitor", cfg),
};

export const sqlMonitorComponent: NativeComponentDefinition = {
  id: "sql_monitor",
  name: "SQL watermark sensor",
  category: "sensor",
  description: "Monitor SQL table watermark / row count threshold.",
  compileTarget: "monitor",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "watermark_column", label: "Watermark column", type: "string", required: true },
    { key: "min_rows", label: "Min rows expected", type: "number", default: 1 },
  ],
  compile: (cfg) => buildSensorMonitor("sql_monitor", "SQL monitor", cfg),
};
