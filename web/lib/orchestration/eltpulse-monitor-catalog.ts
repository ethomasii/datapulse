/**
 * Planned eltPulse monitor kinds — triggers that start or gate pipeline runs.
 * Each kind expects explicit credentials or a connection profile where it touches customer systems.
 */

export type EltpulseMonitorCategory =
  | "object_storage"
  | "messaging"
  | "files"
  | "integrations"
  | "notifications";

export type EltpulseMonitorKind = {
  /** Stable id for API / docs (snake_case). */
  id: string;
  label: string;
  category: EltpulseMonitorCategory;
  description: string;
};

export const ELTPULSE_MONITOR_CATALOG: readonly EltpulseMonitorKind[] = [
  {
    id: "s3_object_count",
    label: "S3 object count",
    category: "object_storage",
    description:
      "When a prefix reaches a threshold of objects, trigger the pipeline. Requires AWS auth scoped to the bucket.",
  },
  {
    id: "gcs_object_count",
    label: "GCS object count",
    category: "object_storage",
    description:
      "When a bucket/prefix reaches a threshold, trigger the pipeline. Requires GCP credentials for that project.",
  },
  {
    id: "adls_object_count",
    label: "ADLS Gen2 path count",
    category: "object_storage",
    description:
      "When a filesystem path reaches a threshold, trigger the pipeline. Requires Azure Storage / Entra access.",
  },
  {
    id: "filesystem_directory",
    label: "Local / mounted directory",
    category: "files",
    description:
      "When files or row counts in a watched path cross a threshold, trigger the pipeline. Only where the runner has filesystem access.",
  },
  {
    id: "csv_row_threshold",
    label: "CSV row count",
    category: "files",
    description:
      "When a CSV reaches at least N rows, trigger the pipeline. Needs read access to the file location.",
  },
  {
    id: "kafka_message_count",
    label: "Kafka topic depth",
    category: "messaging",
    description:
      "When lag or depth crosses a threshold, trigger the pipeline. Requires broker auth (SASL/TLS, etc.).",
  },
  {
    id: "sqs_queue_depth",
    label: "SQS approximate count",
    category: "messaging",
    description:
      "When queue depth crosses a threshold, trigger the pipeline. Requires IAM for GetQueueAttributes.",
  },
  {
    id: "pubsub_subscription_backlog",
    label: "Pub/Sub backlog",
    category: "messaging",
    description:
      "When subscription backlog crosses a threshold, trigger the pipeline. Requires GCP Pub/Sub credentials.",
  },
  {
    id: "airbyte_sync_completed",
    label: "Airbyte sync completed",
    category: "integrations",
    description:
      "After a successful sync for a connection, trigger the pipeline. Requires Airbyte API or webhook secrets.",
  },
  {
    id: "fivetran_sync_completed",
    label: "Fivetran sync completed",
    category: "integrations",
    description:
      "After a connector run succeeds, trigger the pipeline. Requires Fivetran API credentials or signed webhooks.",
  },
  {
    id: "slack_notification",
    label: "Slack signal (webhook)",
    category: "notifications",
    description:
      "When a signed Slack or custom webhook payload matches rules, trigger the pipeline. Uses your signing secret.",
  },
] as const;
