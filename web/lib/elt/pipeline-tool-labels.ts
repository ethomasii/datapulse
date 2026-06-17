/** User-facing labels for internal pipeline runner types — never expose dlt/sling in UI. */

export function pipelineToolLabel(tool: string | null | undefined): string {
  const t = String(tool ?? "")
    .toLowerCase()
    .trim();
  if (t === "sling") return "Database replication";
  if (t === "dlt") return "Connector sync";
  if (t === "auto") return "Auto";
  return tool?.trim() || "—";
}

export function connectorSyncModeLabel(tool: string | null | undefined): string | null {
  const t = String(tool ?? "")
    .toLowerCase()
    .trim();
  if (t === "sling") return "Database replication";
  if (t === "dlt") return "Connector sync";
  return null;
}
