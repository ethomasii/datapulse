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

// web/lib/elt/native-components/definitions/filter-rows.ts
var filterRowsComponent = {
  id: "filter_rows",
  aliases: ["dataframe_filter", "row_filter", "filter", "warehouse_filter", "select_records"],
  name: "Filter rows",
  category: "transformation",
  description: "Filter rows in a loaded table with a pandas query expression.",
  compileTarget: "python",
  fields: [
    {
      key: "table",
      label: "Table",
      type: "string",
      required: true,
      placeholder: "staging.events"
    },
    {
      key: "condition",
      label: "Filter condition",
      description: "pandas query expression, e.g. status == 'active' and amount > 0",
      type: "text",
      required: true
    },
    {
      key: "output_table",
      label: "Output table",
      description: "Leave empty to overwrite source table",
      type: "string"
    }
  ],
  compile(config) {
    const table = inputTable(config);
    const condition = String(config.condition ?? config.filter ?? config.expression ?? "").trim();
    const output = outputTable(config, table);
    if (!table || !condition) {
      return { warnings: ["filter_rows: table and condition are required"], python: [] };
    }
    const outSchema = output.includes(".") ? output.split(".")[0] : "public";
    const outName = output.includes(".") ? output.split(".").pop() : output;
    const python = [
      `# \u2500\u2500 filter_rows: ${table} \u2500\u2500`,
      "import pandas as pd",
      "try:",
      "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
      "    _sql = _dest_client.sql_client()",
      `    _df = pd.read_sql('SELECT * FROM ${escapePyString(table)}', _sql._engine)`,
      `    _filtered = _df.query(${JSON.stringify(condition)})`,
      `    _filtered.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[filter_rows] kept {len(_filtered)} / {len(_df)} rows \u2192 ${escapePyString(output)}")`,
      "except Exception as _filt_err:",
      '    print(f"[filter_rows] failed: {_filt_err}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-0FtTsZ/filter_rows.ts
function compile(config) {
  return filterRowsComponent.compile(config);
}
export {
  compile
};
