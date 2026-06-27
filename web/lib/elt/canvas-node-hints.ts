/** Normalize connector slugs for comparing stored hints vs live bindings. */
export function normalizeConnectorSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/** True when a node note only repeats the connector picked in the dropdown. */
export function isRedundantConnectorHint(
  kind: "source" | "destination",
  hint: string,
  connectorType: string | undefined
): boolean {
  const trimmed = hint.trim();
  if (!trimmed || !connectorType?.trim()) return false;

  const prefix = kind === "source" ? /^source\s*:\s*/i : /^destination\s*:\s*/i;
  if (prefix.test(trimmed)) {
    return normalizeConnectorSlug(trimmed.replace(prefix, "")) === normalizeConnectorSlug(connectorType);
  }

  // Legacy AI/backbone notes like "github extract" / "motherduck load"
  const legacySuffix = kind === "source" ? /\s+extract$/i : /\s+load$/i;
  if (legacySuffix.test(trimmed)) {
    return normalizeConnectorSlug(trimmed.replace(legacySuffix, "")) === normalizeConnectorSlug(connectorType);
  }

  return false;
}

/** Display value for optional node notes — hides auto-generated connector labels. */
export function displayConnectorNodeHint(
  kind: "source" | "destination",
  hint: string | undefined,
  connectorType: string | undefined
): string {
  const raw = String(hint ?? "").trim();
  if (!raw) return "";
  return isRedundantConnectorHint(kind, raw, connectorType) ? "" : raw;
}
