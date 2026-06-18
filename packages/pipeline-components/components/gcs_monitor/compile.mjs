// web/lib/elt/native-components/definitions/sensor-monitors.ts
var MONITOR_TYPES = {
  s3_monitor: "s3_file_count",
  sqs_monitor: "sqs_message_count",
  gcs_monitor: "gcs_file_arrival",
  kafka_monitor: "kafka_message_count",
  sql_monitor: "sql_watermark",
  adls_monitor: "adls_file_count"
};
function buildSensorMonitor(componentId, label, cfg) {
  return {
    configPatch: {
      elt_canvas_sensors: [
        {
          component_id: componentId,
          monitor_type: MONITOR_TYPES[componentId] ?? "s3_file_count",
          label,
          config: { ...cfg, template_id: componentId }
        }
      ]
    }
  };
}
var gcsMonitorComponent = {
  id: "gcs_monitor",
  name: "GCS file sensor",
  category: "sensor",
  description: "Monitor GCS prefix for new objects.",
  compileTarget: "monitor",
  fields: [
    { key: "bucket", label: "Bucket", type: "string", required: true },
    { key: "prefix", label: "Prefix", type: "string" },
    { key: "file_pattern", label: "File pattern", type: "string", default: ".*" }
  ],
  compile: (cfg) => buildSensorMonitor("gcs_monitor", "GCS monitor", cfg)
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-ywkMkX/gcs_monitor.ts
function compile(config) {
  return gcsMonitorComponent.compile(config);
}
export {
  compile
};
