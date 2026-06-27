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
var s3MonitorComponent = {
  id: "s3_monitor",
  name: "S3 file sensor",
  category: "sensor",
  description: "Monitor S3 prefix for new files; creates EltMonitor on canvas save.",
  compileTarget: "monitor",
  fields: [
    { key: "bucket_name", label: "Bucket", type: "string", required: true },
    { key: "prefix", label: "Prefix", type: "string", placeholder: "incoming/" },
    { key: "threshold", label: "Min new files", type: "number", default: 1 },
    { key: "key_pattern", label: "Key pattern (regex)", type: "string", default: ".*" }
  ],
  compile: (cfg) => buildSensorMonitor("s3_monitor", "S3 monitor", cfg)
};

// ../../../../../tmp/eltpulse-compile-EyK14Q/s3_monitor.ts
function compile(config) {
  return s3MonitorComponent.compile(config);
}
export {
  compile
};
