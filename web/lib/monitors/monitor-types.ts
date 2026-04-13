/** Monitor kinds (CLI `--type`) that must be tied to a saved connection profile. */
export const MONITOR_TYPES_REQUIRING_CONNECTION = new Set([
  "s3_file_count",
  "gcs_file_count",
  "adls_file_count",
  "sqs_message_count",
]);

const CONNECTOR_ALIASES: Record<string, readonly string[]> = {
  s3_file_count: ["s3", "aws"],
  sqs_message_count: ["s3", "aws"],
  gcs_file_count: ["gcs"],
  adls_file_count: ["azure_blob", "adls", "azure"],
  kafka_message_count: ["kafka"],
};

export function monitorTypeRequiresConnection(monitorType: string): boolean {
  return MONITOR_TYPES_REQUIRING_CONNECTION.has(monitorType);
}

export function connectorMatchesMonitorType(connector: string, monitorType: string): boolean {
  const c = connector.toLowerCase().trim();
  const allowed = CONNECTOR_ALIASES[monitorType];
  if (!allowed) return true;
  return allowed.some((a) => c === a || c.includes(a));
}
