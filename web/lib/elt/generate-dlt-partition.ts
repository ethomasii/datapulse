import { escapePyString } from "./escape-py";
import type { VerifiedSourceSpec } from "./verified-source-spec";
import { getIncrementalEnvConfig } from "./verified-incremental-env";

/** Python block: apply partition_key to source_kwargs start/end date kwargs. */
export function buildKwargPartitionBlock(spec: VerifiedSourceSpec): string {
  if (!spec.partitionKwarg) return "";
  const startKw = escapePyString(spec.partitionKwarg);
  let block = `
    if partition_key:
        pk = partition_key.strip()
        source_kwargs["${startKw}"] = pk`;
  if (spec.partitionEndKwarg) {
    const endKw = escapePyString(spec.partitionEndKwarg);
    block += `
        try:
            from datetime import date, timedelta
            if len(pk) >= 10 and pk[4:5] == "-" and pk[7:8] == "-":
                _day = date.fromisoformat(pk[:10])
                source_kwargs["${endKw}"] = (_day + timedelta(days=1)).isoformat()
        except ValueError:
            pass`;
  }
  return block;
}

/** Salesforce merge resources that honor last_timestamp incremental bounds. */
const SALESFORCE_INCREMENTAL_RESOURCES = [
  "account",
  "opportunity",
  "opportunity_line_item",
  "opportunity_contact_role",
  "campaign_member",
  "task",
  "event",
] as const;

export function buildAsanaPartitionBlock(): string {
  return `
    if partition_key:
        from datetime import date, timedelta
        pk = partition_key.strip()
        initial = pk if "T" in pk else f"{pk[:10]}T00:00:00.000Z"
        os.environ.setdefault("SOURCES__ASANA_DLT__TASKS__MODIFIED_AT__INITIAL_VALUE", initial)
        if len(pk) >= 10 and pk[4:5] == "-" and pk[7:8] == "-":
            try:
                _day = date.fromisoformat(pk[:10])
                end = (_day + timedelta(days=1)).isoformat()
                os.environ.setdefault("SOURCES__ASANA_DLT__TASKS__MODIFIED_AT__END_VALUE", f"{end}T00:00:00.000Z")
            except ValueError:
                pass`;
}

export function buildSalesforcePartitionBlock(): string {
  const resources = SALESFORCE_INCREMENTAL_RESOURCES.map((r) => `"${r}"`).join(", ");
  return `
    if partition_key:
        from datetime import date, timedelta
        pk = partition_key.strip()
        initial = pk if "T" in pk else f"{pk[:10]}T00:00:00Z"
        end_val = None
        if len(pk) >= 10 and pk[4:5] == "-" and pk[7:8] == "-":
            try:
                _day = date.fromisoformat(pk[:10])
                end_val = f"{(_day + timedelta(days=1)).isoformat()}T00:00:00Z"
            except ValueError:
                pass
        for _res in (${resources},):
            _prefix = "SOURCES__SALESFORCE__" + _res.upper() + "__LAST_TIMESTAMP__"
            os.environ.setdefault(_prefix + "INITIAL_VALUE", initial)
            if end_val:
                os.environ.setdefault(_prefix + "END_VALUE", end_val)`;
}

export function buildVerifiedImportLine(spec: VerifiedSourceSpec): string {
  if (spec.partitionSliceMode === "jira_jql") {
    return `from ${spec.module} import ${spec.factory}, jira_search`;
  }
  return `from ${spec.module} import ${spec.factory}`;
}

export function buildVerifiedSourceInstantiation(
  spec: VerifiedSourceSpec,
  resourceBlock: string
): string {
  const factory = spec.factory;
  if (spec.partitionSliceMode === "jira_jql") {
    return `
    if partition_key:
        from datetime import date, timedelta
        pk = partition_key.strip()
        try:
            _day = date.fromisoformat(pk[:10])
            jql = f'updated >= "{_day.isoformat()}" AND updated < "{(_day + timedelta(days=1)).isoformat()}"'
        except ValueError:
            jql = 'updated >= "' + pk + '"'
        source = jira_search(**source_kwargs).issues([jql])
    else:
        source = ${factory}(**source_kwargs)${resourceBlock}`;
  }
  return `
    source = ${factory}(**source_kwargs)${resourceBlock}`;
}

export function buildDltIncrementalEnvPartitionBlock(slug: string): string {
  const cfg = getIncrementalEnvConfig(slug);
  if (!cfg) return "";
  const source = escapePyString(cfg.dltSourceName.toUpperCase());
  const rows = cfg.resources
    .map((r) => {
      const dayRange = r.dateRangeParams ? "True" : "False";
      return `        ("${escapePyString(r.name)}", "${escapePyString(r.cursorField)}", ${dayRange})`;
    })
    .join(",\n");
  return `
    if partition_key:
        from datetime import date, timedelta
        pk = partition_key.strip()
        initial = pk if "T" in pk else f"{pk[:10]}T00:00:00Z"
        end_val = None
        if len(pk) >= 10 and pk[4:5] == "-" and pk[7:8] == "-":
            try:
                _day = date.fromisoformat(pk[:10])
                end_val = f"{(_day + timedelta(days=1)).isoformat()}T00:00:00Z"
            except ValueError:
                pass
        for _res, _cursor, _day_range in (
${rows},
        ):
            _prefix = "SOURCES__${source}__" + _res.upper() + "__" + _cursor.upper() + "__"
            os.environ.setdefault(_prefix + "INITIAL_VALUE", initial)
            if end_val:
                os.environ.setdefault(_prefix + "END_VALUE", end_val)
            if _day_range and end_val:
                _base = "SOURCES__${source}__" + _res.upper() + "__"
                os.environ.setdefault(_base + "START_DATE", pk[:10])
                os.environ.setdefault(_base + "END_DATE", end_val[:10])`;
}

export function buildVerifiedPartitionBlock(spec: VerifiedSourceSpec, slug?: string): string {
  if (spec.partitionSliceMode === "asana_tasks") {
    return buildAsanaPartitionBlock();
  }
  if (spec.partitionSliceMode === "salesforce_incremental") {
    return buildSalesforcePartitionBlock();
  }
  if (spec.partitionSliceMode === "dlt_incremental_env" && slug) {
    return buildDltIncrementalEnvPartitionBlock(slug);
  }
  return buildKwargPartitionBlock(spec);
}

/** Python injected after REST advanced config decode. */
export function buildRestAdvancedPartitionBlock(): string {
  return `
    if partition_key:
        from datetime import date, timedelta
        pk = partition_key.strip()
        resources = config.get("resources") or []
        end_val = None
        if len(pk) >= 10 and pk[4:5] == "-" and pk[7:8] == "-":
            try:
                _day = date.fromisoformat(pk[:10])
                end_val = (_day + timedelta(days=1)).isoformat()
            except ValueError:
                pass
        for res in resources:
            if not isinstance(res, dict):
                continue
            endpoint = res.setdefault("endpoint", {})
            params = endpoint.setdefault("params", {})
            if "since" not in params and "start_date" not in params:
                params["since"] = pk
            inc = endpoint.get("incremental")
            if isinstance(inc, dict):
                inc["initial_value"] = pk
                if end_val:
                    inc["end_value"] = end_val`;
}

/** Postgres dlt: scope sql_database incremental via partition column from pipeline config. */
export function buildPostgresDltPartitionBlock(partitionColumn: string | null): string {
  if (!partitionColumn) {
    return `
    if partition_key:
        print("[eltpulse] partition_key set but no _partitionConfig.column saved — slice ignored", flush=True)`;
  }
  return `
    partition_column = "${escapePyString(partitionColumn)}"
    if partition_key and partition_column:
        from datetime import date, timedelta
        pk = partition_key.strip()
        initial = pk if "T" in pk else f"{pk[:10]}T00:00:00Z"
        end_val = None
        if len(pk) >= 10 and pk[4:5] == "-" and pk[7:8] == "-":
            try:
                _day = date.fromisoformat(pk[:10])
                end_val = f"{(_day + timedelta(days=1)).isoformat()}T00:00:00Z"
            except ValueError:
                pass
        for _table in table_names:
            _prefix = "SOURCES__SQL_DATABASE__" + _table.upper() + "__" + partition_column.upper() + "__"
            os.environ.setdefault(_prefix + "INITIAL_VALUE", initial)
            if end_val:
                os.environ.setdefault(_prefix + "END_VALUE", end_val)`;
}
