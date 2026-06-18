import type { NativeComponentDefinition } from "../types";

const MONITOR_TYPES: Record<string, string> = {
  s3_monitor: "s3_file_count",
  sqs_monitor: "sqs_message_count",
  gcs_monitor: "gcs_file_arrival",
  kafka_monitor: "kafka_message_count",
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
