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
var htmlParserComponent = {
  id: "html_parser",
  name: "HTML parser",
  category: "transformation",
  description: "Strip HTML tags or extract text/links/tables (requires beautifulsoup4).",
  compileTarget: "python",
  dagsterOnlyFields: DAGSTER_ONLY,
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "columns", label: "HTML columns", type: "string_list", required: true },
    {
      key: "mode",
      label: "Mode",
      type: "select",
      options: ["strip_tags", "extract_text", "extract_links", "extract_tables"],
      default: "strip_tags"
    },
    { key: "parser", label: "BS parser", type: "select", options: ["html.parser", "lxml", "html5lib"], default: "html.parser" },
    { key: "new_column_suffix", label: "New column suffix", type: "string" },
    { key: "output_table", label: "Output table", type: "string" }
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config, table);
    const columns = strList(config.columns);
    const mode = String(config.mode ?? "strip_tags").trim();
    const parser = String(config.parser ?? "html.parser").trim();
    const suffix = String(config.new_column_suffix ?? "");
    if (!table || !columns.length) {
      return { warnings: ["html_parser: table and columns required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const colsPy = JSON.stringify(columns);
    const python = [
      `# \u2500\u2500 html_parser: ${table} \u2500\u2500`,
      "try:",
      "    from bs4 import BeautifulSoup",
      "except ImportError as _bs_err:",
      '    raise ImportError("html_parser requires beautifulsoup4: pip install beautifulsoup4") from _bs_err',
      "def _html_process(html_val, mode, parser):",
      "    if html_val is None or (isinstance(html_val, float) and pd.isna(html_val)):",
      "        return None",
      "    soup = BeautifulSoup(str(html_val), parser)",
      "    if mode in ('strip_tags', 'extract_text'):",
      "        return soup.get_text(separator=' ', strip=True)",
      "    if mode == 'extract_links':",
      "        return [a.get('href') for a in soup.find_all('a', href=True)]",
      "    if mode == 'extract_tables':",
      "        tables = []",
      "        for table in soup.find_all('table'):",
      "            rows = []",
      "            for tr in table.find_all('tr'):",
      "                rows.append([td.get_text(strip=True) for td in tr.find_all(['td', 'th'])])",
      "            tables.append(rows)",
      "        return tables",
      "    return str(html_val)",
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _cols = ${colsPy}`,
      `    _mode = ${JSON.stringify(mode)}`,
      `    _parser = ${JSON.stringify(parser)}`,
      `    _suffix = ${JSON.stringify(suffix)}`,
      "    for _col in _cols:",
      "        if _col not in _df.columns:",
      "            continue",
      "        _result = _df[_col].apply(lambda v: _html_process(v, _mode, _parser))",
      "        if _suffix:",
      "            _df[f'{_col}{_suffix}'] = _result",
      "        else:",
      "            _df[_col] = _result",
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[html_parser] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[html_parser] failed: {_e}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-owfwbk/html_parser.ts
function compile(config) {
  return htmlParserComponent.compile(config);
}
export {
  compile
};
