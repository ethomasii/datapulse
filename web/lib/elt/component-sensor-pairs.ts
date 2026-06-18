/**
 * Dagster component-templates sensor → ingestion asset pairs.
 * Used to suggest monitor + pipeline combos (S3 monitor triggers S3 ingest pipeline).
 * @see https://github.com/eric-thomas-dagster/dagster-component-templates
 */

export type SensorIngestionPair = {
  sensorId: string;
  ingestionId: string;
  label: string;
};

export const SENSOR_INGESTION_PAIRS: SensorIngestionPair[] = [
  { sensorId: "s3_monitor", ingestionId: "s3_to_database_asset", label: "S3 → warehouse" },
  { sensorId: "gcs_monitor", ingestionId: "gcs_to_database_asset", label: "GCS → warehouse" },
  { sensorId: "adls_monitor", ingestionId: "adls_to_database_asset", label: "ADLS → warehouse" },
  { sensorId: "kafka_monitor", ingestionId: "kafka_to_database_asset", label: "Kafka → warehouse" },
  { sensorId: "sqs_monitor", ingestionId: "sqs_to_database_asset", label: "SQS → warehouse" },
  { sensorId: "kinesis_monitor", ingestionId: "kinesis_to_database_asset", label: "Kinesis → warehouse" },
  { sensorId: "eventhubs_monitor", ingestionId: "eventhubs_to_database_asset", label: "Event Hubs → warehouse" },
  { sensorId: "servicebus_monitor", ingestionId: "servicebus_to_database_asset", label: "Service Bus → warehouse" },
  { sensorId: "rabbitmq_monitor", ingestionId: "rabbitmq_to_database_asset", label: "RabbitMQ → warehouse" },
  { sensorId: "pubsub_monitor", ingestionId: "pubsub_to_database_asset", label: "Pub/Sub → warehouse" },
  { sensorId: "redis_streams_monitor", ingestionId: "redis_streams_to_database_asset", label: "Redis Streams → warehouse" },
  { sensorId: "nats_monitor", ingestionId: "nats_to_database_asset", label: "NATS → warehouse" },
  { sensorId: "pulsar_monitor", ingestionId: "pulsar_to_database_asset", label: "Pulsar → warehouse" },
  { sensorId: "mqtt_monitor", ingestionId: "mqtt_to_database_asset", label: "MQTT → warehouse" },
  { sensorId: "sftp_monitor", ingestionId: "sftp_to_database_asset", label: "SFTP → warehouse" },
  { sensorId: "sql_monitor", ingestionId: "sql_to_database_asset", label: "SQL → warehouse" },
];

const bySensor = new Map(SENSOR_INGESTION_PAIRS.map((p) => [p.sensorId, p]));
const byIngestion = new Map(SENSOR_INGESTION_PAIRS.map((p) => [p.ingestionId, p]));

export function companionIngestionForSensor(sensorComponentId: string): SensorIngestionPair | undefined {
  return bySensor.get(sensorComponentId);
}

export function companionSensorForIngestion(ingestionComponentId: string): SensorIngestionPair | undefined {
  return byIngestion.get(ingestionComponentId);
}
