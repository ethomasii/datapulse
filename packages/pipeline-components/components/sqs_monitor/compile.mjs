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
var sqsMonitorComponent = {
  id: "sqs_monitor",
  name: "SQS sensor",
  category: "sensor",
  description: "Monitor SQS queue depth / message arrival.",
  compileTarget: "monitor",
  fields: [
    { key: "queue_url", label: "Queue URL", type: "string", required: true },
    { key: "threshold", label: "Min messages", type: "number", default: 1 }
  ],
  compile: (cfg) => buildSensorMonitor("sqs_monitor", "SQS monitor", cfg)
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-0FtTsZ/sqs_monitor.ts
function compile(config) {
  return sqsMonitorComponent.compile(config);
}
export {
  compile
};
