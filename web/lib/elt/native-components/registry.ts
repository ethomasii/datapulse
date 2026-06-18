import { joinTablesComponent } from "./definitions/join-tables";
import { filterRowsComponent } from "./definitions/filter-rows";
import { dqCheckComponent } from "./definitions/dq-check";
import { freshnessCheckComponent } from "./definitions/freshness-check";
import { sqlTransformComponent } from "./definitions/sql-transform";
import { selectColumnsComponent } from "./definitions/select-columns";
import { dropDuplicatesComponent } from "./definitions/drop-duplicates";
import { unionTablesComponent } from "./definitions/union-tables";
import { uniqueCheckComponent } from "./definitions/unique-check";
import {
  s3MonitorComponent,
  sqsMonitorComponent,
  gcsMonitorComponent,
  kafkaMonitorComponent,
  sqlMonitorComponent,
} from "./definitions/sensor-monitors";
import { s3IngestComponent, sqsIngestComponent, kafkaIngestComponent, restApiIngestComponent, sqlToDatabaseComponent } from "./definitions/ingestion-hints";
import { renameColumnsComponent, castColumnsComponent } from "./definitions/column-ops";
import type { NativeComponentDefinition } from "./types";

const ALL_NATIVE: NativeComponentDefinition[] = [
  joinTablesComponent,
  filterRowsComponent,
  dqCheckComponent,
  freshnessCheckComponent,
  sqlTransformComponent,
  selectColumnsComponent,
  dropDuplicatesComponent,
  unionTablesComponent,
  uniqueCheckComponent,
  renameColumnsComponent,
  castColumnsComponent,
  s3MonitorComponent,
  sqsMonitorComponent,
  gcsMonitorComponent,
  kafkaMonitorComponent,
  sqlMonitorComponent,
  s3IngestComponent,
  sqsIngestComponent,
  kafkaIngestComponent,
  restApiIngestComponent,
  sqlToDatabaseComponent,
];

const byId = new Map<string, NativeComponentDefinition>();
for (const def of ALL_NATIVE) {
  byId.set(def.id, def);
  for (const alias of def.aliases ?? []) {
    byId.set(alias, def);
  }
}

export function listNativeComponents(): NativeComponentDefinition[] {
  const seen = new Set<string>();
  return ALL_NATIVE.filter((d) => {
    if (seen.has(d.id)) return false;
    seen.add(d.id);
    return true;
  });
}

export function getNativeComponent(id: string): NativeComponentDefinition | null {
  const key = id.trim();
  if (!key) return null;
  return byId.get(key) ?? null;
}

export function isNativeComponent(id: string): boolean {
  return getNativeComponent(id) !== null;
}

export function resolveNativeComponentId(config: Record<string, unknown>): string | null {
  const templateId = String(config.template_id ?? "").trim();
  if (templateId && byId.has(templateId)) return byId.get(templateId)!.id;
  const componentId = String(config.component_id ?? "").trim();
  if (componentId && byId.has(componentId)) return byId.get(componentId)!.id;
  return null;
}
