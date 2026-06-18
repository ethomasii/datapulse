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
var sqlMonitorComponent = {
  id: "sql_monitor",
  name: "SQL watermark sensor",
  category: "sensor",
  description: "Monitor SQL table watermark / row count threshold.",
  compileTarget: "monitor",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "watermark_column", label: "Watermark column", type: "string", required: true },
    { key: "min_rows", label: "Min rows expected", type: "number", default: 1 }
  ],
  compile: (cfg) => buildSensorMonitor("sql_monitor", "SQL monitor", cfg)
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-rug7fN/sql_monitor.ts
function compile(config) {
  return sqlMonitorComponent.compile(config);
}
export {
  compile
};
