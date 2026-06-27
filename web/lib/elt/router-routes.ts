/**
 * Router branch config — shared by inspector route builder, canvas output ports, and wiring.
 */

export type RouterRouteRow = {
  condition: string;
  output_table: string;
};

export type RouterOutputPort = {
  id: string;
  label: string;
  output_table: string;
};

const ROUTER_IDS = new Set(["router", "conditional_split", "branch"]);

export function isRouterComponentId(componentId: string): boolean {
  return ROUTER_IDS.has(componentId.trim());
}

export function isRouterConfig(config: Record<string, unknown>): boolean {
  const templateId = String(config.template_id ?? "").trim();
  return (
    isRouterComponentId(templateId) ||
    config.routes !== undefined ||
    config.outputs !== undefined
  );
}

/** Parse routes from config (JSON string or array). */
export function parseRouterRouteRows(config: Record<string, unknown>): RouterRouteRow[] {
  const raw = config.routes ?? config.outputs;
  if (typeof raw === "string") {
    const text = raw.trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text) as unknown;
      if (!Array.isArray(parsed)) return [];
      return normalizeRouteRows(parsed);
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) return normalizeRouteRows(raw);
  return [];
}

function normalizeRouteRows(raw: unknown[]): RouterRouteRow[] {
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const condition = String(row.condition ?? "").trim();
      const output_table = String(row.output_table ?? row.table ?? "").trim();
      if (!condition && !output_table) return null;
      return { condition, output_table };
    })
    .filter((r): r is RouterRouteRow => r !== null);
}

/** Serialize route rows for native compiler (JSON text field). */
export function serializeRouterRoutes(rows: RouterRouteRow[]): string {
  const complete = rows.filter((r) => r.condition.trim() && r.output_table.trim());
  return JSON.stringify(
    complete.map((r) => ({
      condition: r.condition.trim(),
      output_table: r.output_table.trim(),
    })),
    null,
    2
  );
}

export function routerPortIdForRouteIndex(index: number): string {
  return `route-${index}`;
}

export function routerOutputPortsFromConfig(config: Record<string, unknown>): RouterOutputPort[] {
  const ports: RouterOutputPort[] = [];
  const rows = parseRouterRouteRows(config);
  rows.forEach((row, i) => {
    const table = row.output_table.trim();
    if (!table) return;
    const cond = row.condition.trim();
    const shortTable = table.includes(".") ? table.split(".").pop()! : table;
    const shortCond = cond.length > 22 ? `${cond.slice(0, 22)}…` : cond;
    ports.push({
      id: routerPortIdForRouteIndex(i),
      label: cond ? `${shortTable} · ${shortCond}` : shortTable,
      output_table: table,
    });
  });
  const fallback = String(config.default_output_table ?? config.default_table ?? "").trim();
  if (fallback) {
    ports.push({
      id: "default",
      label: `${fallback.includes(".") ? fallback.split(".").pop()! : fallback} · default`,
      output_table: fallback,
    });
  }
  return ports;
}

/** Resolve warehouse table for a router canvas source handle. */
export function outputTableForRouterPort(
  config: Record<string, unknown>,
  portId: string | null | undefined
): string | null {
  if (!portId) return null;
  if (portId === "default") {
    const fallback = String(config.default_output_table ?? config.default_table ?? "").trim();
    return fallback || null;
  }
  const match = /^route-(\d+)$/.exec(portId);
  if (!match) return null;
  const index = Number(match[1]);
  const rows = parseRouterRouteRows(config);
  const row = rows[index];
  if (!row) return null;
  const table = row.output_table.trim();
  return table || null;
}

/** Blank row for the visual route builder. */
export function emptyRouterRouteRow(): RouterRouteRow {
  return { condition: "", output_table: "" };
}
