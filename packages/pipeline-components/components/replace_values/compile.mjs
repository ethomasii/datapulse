// web/lib/elt/escape-py.ts
function escapePyString(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// web/lib/elt/native-components/definitions/_pandas-helpers.ts
function parseTableParts(table) {
  const parts = table.split(".");
  if (parts.length > 1) {
    return { schema: parts[0], name: parts.slice(1).join(".") };
  }
  return { schema: "public", name: table };
}
function pandasReadTable(table) {
  return [
    "import pandas as pd",
    "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
    "    _sql = _dest_client.sql_client()",
    `    _df = pd.read_sql('SELECT * FROM ${escapePyString(table)}', _sql._engine)`
  ];
}
function pandasWriteTable(outputTable2, label) {
  const { schema, name } = parseTableParts(outputTable2);
  return [
    `    _df.to_sql("${escapePyString(name)}", _sql._engine, schema="${escapePyString(schema)}", if_exists="replace", index=False)`,
    `    print(f"[${label}] wrote {len(_df)} rows to ${escapePyString(outputTable2)}")`
  ];
}

// web/lib/elt/native-components/definitions/table-ops.ts
var replaceValuesComponent = {
  id: "replace_values",
  aliases: ["find_replace", "map_values"],
  name: "Replace values",
  category: "transformation",
  description: "Replace cell values in selected columns (pandas replace).",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    {
      key: "mapping",
      label: "Replace mapping JSON",
      description: 'Column \u2192 {old: new}, e.g. {"status":{"pending":"open"}}',
      type: "text",
      required: true
    },
    { key: "output_table", label: "Output table", type: "string" }
  ],
  compile(config) {
    const table = String(config.table ?? "").trim();
    const output = String(config.output_table ?? table).trim();
    let mapping = {};
    const raw = config.mapping ?? config.replace;
    if (typeof raw === "string") {
      try {
        mapping = JSON.parse(raw);
      } catch {
        return { warnings: ["replace_values: mapping must be valid JSON"], python: [] };
      }
    } else if (raw && typeof raw === "object") {
      mapping = raw;
    }
    if (!table || !Object.keys(mapping).length) {
      return { warnings: ["replace_values: table and mapping required"], python: [] };
    }
    const mapPy = JSON.stringify(mapping);
    const python = [
      `# \u2500\u2500 replace_values: ${table} \u2500\u2500`,
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _df = _df.replace(${mapPy})`,
      ...pandasWriteTable(output, "replace_values"),
      "except Exception as _rep_err:",
      '    print(f"[replace_values] failed: {_rep_err}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-owfwbk/replace_values.ts
function compile(config) {
  return replaceValuesComponent.compile(config);
}
export {
  compile
};
