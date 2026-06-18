// web/lib/elt/escape-py.ts
function escapePyString(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// web/lib/elt/native-components/definitions/_config-helpers.ts
function inputTable(config) {
  return String(
    config.table ?? config.upstream_asset_key ?? config.input_table ?? config.source_table ?? ""
  ).trim();
}
function outputTable(config, fallback = "") {
  return String(config.output_table ?? config.asset_name ?? fallback).trim();
}

// web/lib/elt/native-components/definitions/_pandas-helpers.ts
function pandasReadTable(table) {
  return [
    "import pandas as pd",
    "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
    "    _sql = _dest_client.sql_client()",
    `    _df = pd.read_sql('SELECT * FROM ${escapePyString(table)}', _sql._engine)`
  ];
}
function strList(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

// web/lib/elt/native-components/definitions/domain-parsers.ts
function outputParts(output) {
  const outSchema = output.includes(".") ? output.split(".")[0] : "public";
  const outName = output.includes(".") ? output.split(".").pop() : output;
  return { outSchema, outName };
}
var DAGSTER_ONLY = [
  "group_name",
  "partition_type",
  "partition_start",
  "partition_date_column",
  "partition_values",
  "owners",
  "asset_tags",
  "kinds",
  "freshness_max_lag_minutes",
  "freshness_cron",
  "include_preview_metadata",
  "preview_rows",
  "deps",
  "retry_policy_max_retries",
  "retry_policy_delay_seconds",
  "retry_policy_backoff",
  "dynamic_partition_name",
  "partition_dimensions"
];
var emailParserComponent = {
  id: "email_parser",
  name: "Email parser",
  category: "transformation",
  description: "Parse RFC 2822 email strings into from, to, subject, date, body columns.",
  compileTarget: "python",
  dagsterOnlyFields: DAGSTER_ONLY,
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "column", label: "Email column", type: "string", required: true },
    {
      key: "extract_fields",
      label: "Extract fields",
      type: "string_list",
      default: ["from", "to", "subject", "date", "body"]
    },
    { key: "output_prefix", label: "Output prefix", type: "string", default: "" },
    { key: "drop_source", label: "Drop source column", type: "boolean", default: false },
    { key: "output_table", label: "Output table", type: "string" }
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config, table);
    const column = String(config.column ?? config.message_column ?? "").trim();
    const fields = strList(config.extract_fields).length ? strList(config.extract_fields) : ["from", "to", "subject", "date", "body"];
    const prefix = String(config.output_prefix ?? "");
    const dropSource = config.drop_source === true;
    if (!table || !column) {
      return { warnings: ["email_parser: table and column required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const fieldsPy = JSON.stringify(fields);
    const python = [
      `# \u2500\u2500 email_parser: ${table} \u2500\u2500`,
      "import email as _email",
      "from email import policy as _email_policy",
      "def _email_body(msg):",
      "    if msg.is_multipart():",
      "        parts = []",
      "        for part in msg.walk():",
      "            if part.get_content_type() == 'text/plain':",
      "                try:",
      "                    parts.append(part.get_payload(decode=True).decode(part.get_content_charset() or 'utf-8', errors='replace'))",
      "                except Exception:",
      "                    parts.append(str(part.get_payload()))",
      "        return '\\n'.join(parts)",
      "    try:",
      "        payload = msg.get_payload(decode=True)",
      "        if payload:",
      "            return payload.decode(msg.get_content_charset() or 'utf-8', errors='replace')",
      "    except Exception:",
      "        pass",
      "    return str(msg.get_payload())",
      "def _parse_email_raw(raw, extract_fields):",
      "    if raw is None or (isinstance(raw, float) and pd.isna(raw)):",
      "        return {f: None for f in extract_fields}",
      "    try:",
      "        msg = _email.message_from_string(str(raw), policy=_email_policy.compat32)",
      "        out = {}",
      "        for field in extract_fields:",
      "            out[field] = _email_body(msg) if field == 'body' else msg.get(field)",
      "        return out",
      "    except Exception:",
      "        return {f: None for f in extract_fields}",
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _col = ${JSON.stringify(column)}`,
      `    _fields = ${fieldsPy}`,
      `    _prefix = ${JSON.stringify(prefix)}`,
      "    if _col not in _df.columns:",
      `        raise ValueError(f"column {_col!r} not in table")`,
      "    _parsed = _df[_col].apply(lambda r: _parse_email_raw(r, _fields))",
      "    for _field in _fields:",
      "        _df[f'{_prefix}{_field}'] = _parsed.apply(lambda p: p.get(_field))",
      `    if ${dropSource ? "True" : "False"}:`,
      "        _df = _df.drop(columns=[_col])",
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[email_parser] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[email_parser] failed: {_e}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-owfwbk/email_parser.ts
function compile(config) {
  return emailParserComponent.compile(config);
}
export {
  compile
};
