/**
 * Per-component esbuild entries for standalone compile.mjs artifacts.
 * id → module path + exported definition symbol
 */
export const PACKAGE_COMPILE_ENTRIES = [
  { id: "join_tables", module: "definitions/join-tables", export: "joinTablesComponent" },
  { id: "filter_rows", module: "definitions/filter-rows", export: "filterRowsComponent" },
  { id: "dq_check", module: "definitions/dq-check", export: "dqCheckComponent" },
  { id: "freshness_check", module: "definitions/freshness-check", export: "freshnessCheckComponent" },
  { id: "sql_transform", module: "definitions/sql-transform", export: "sqlTransformComponent" },
  { id: "select_columns", module: "definitions/select-columns", export: "selectColumnsComponent" },
  { id: "drop_duplicates", module: "definitions/drop-duplicates", export: "dropDuplicatesComponent" },
  { id: "union_tables", module: "definitions/union-tables", export: "unionTablesComponent" },
  { id: "unique_check", module: "definitions/unique-check", export: "uniqueCheckComponent" },
  { id: "rename_columns", module: "definitions/column-ops", export: "renameColumnsComponent" },
  { id: "cast_columns", module: "definitions/column-ops", export: "castColumnsComponent" },
  { id: "group_aggregate", module: "definitions/table-ops", export: "groupAggregateComponent" },
  { id: "sort_rows", module: "definitions/table-ops", export: "sortRowsComponent" },
  { id: "limit_rows", module: "definitions/table-ops", export: "limitRowsComponent" },
  { id: "fill_nulls", module: "definitions/table-ops", export: "fillNullsComponent" },
  { id: "replace_values", module: "definitions/table-ops", export: "replaceValuesComponent" },
  { id: "sample_rows", module: "definitions/table-ops", export: "sampleRowsComponent" },
  { id: "add_column_expr", module: "definitions/table-ops", export: "addColumnExprComponent" },
  { id: "s3_monitor", module: "definitions/sensor-monitors", export: "s3MonitorComponent" },
  { id: "sqs_monitor", module: "definitions/sensor-monitors", export: "sqsMonitorComponent" },
  { id: "gcs_monitor", module: "definitions/sensor-monitors", export: "gcsMonitorComponent" },
  { id: "kafka_monitor", module: "definitions/sensor-monitors", export: "kafkaMonitorComponent" },
  { id: "sql_monitor", module: "definitions/sensor-monitors", export: "sqlMonitorComponent" },
  { id: "s3_to_database_asset", module: "definitions/ingestion-hints", export: "s3IngestComponent" },
  { id: "sqs_to_database_asset", module: "definitions/ingestion-hints", export: "sqsIngestComponent" },
  { id: "kafka_to_database_asset", module: "definitions/ingestion-hints", export: "kafkaIngestComponent" },
  { id: "rest_api_fetcher", module: "definitions/ingestion-hints", export: "restApiIngestComponent" },
  { id: "sql_to_database_asset", module: "definitions/ingestion-hints", export: "sqlToDatabaseComponent" },
] as const;
