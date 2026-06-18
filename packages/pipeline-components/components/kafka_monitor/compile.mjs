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
var kafkaMonitorComponent = {
  id: "kafka_monitor",
  name: "Kafka lag sensor",
  category: "sensor",
  description: "Monitor Kafka consumer lag for a topic.",
  compileTarget: "monitor",
  fields: [
    { key: "bootstrap_servers", label: "Bootstrap servers", type: "string", required: true },
    { key: "topic", label: "Topic", type: "string", required: true },
    { key: "group_id", label: "Consumer group", type: "string", required: true },
    { key: "max_lag", label: "Max lag threshold", type: "number", default: 1e3 }
  ],
  compile: (cfg) => buildSensorMonitor("kafka_monitor", "Kafka monitor", cfg)
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-owfwbk/kafka_monitor.ts
function compile(config) {
  return kafkaMonitorComponent.compile(config);
}
export {
  compile
};
