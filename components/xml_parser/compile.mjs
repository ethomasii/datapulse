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

// web/lib/elt/native-components/definitions/advanced-transforms.ts
function outputParts(output) {
  const outSchema = output.includes(".") ? output.split(".")[0] : "public";
  const outName = output.includes(".") ? output.split(".").pop() : output;
  return { outSchema, outName };
}
function parseJsonObject(raw, label) {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw;
  }
  return null;
}
var xmlParserComponent = {
  id: "xml_parser",
  name: "XML parser",
  category: "transformation",
  description: "Parse XML in a column into flat fields using path mappings.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "column", label: "XML column", type: "string", required: true },
    {
      key: "paths",
      label: "XPath mappings",
      description: 'JSON object xpath \u2192 column, e.g. {".//name":"patient_name"}',
      type: "text",
      required: true
    },
    { key: "output_table", label: "Output table", type: "string", required: true }
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config);
    const column = String(config.column ?? config.xml_column ?? "").trim();
    const paths = parseJsonObject(config.paths ?? config.xpath_mappings, "paths");
    if (!table || !output || !column || !paths || !Object.keys(paths).length) {
      return { warnings: ["xml_parser: table, column, paths, output_table required"], python: [] };
    }
    const { outSchema, outName: tableName } = outputParts(output);
    const python = [
      `# \u2500\u2500 xml_parser: ${table}.${column} \u2500\u2500`,
      "import xml.etree.ElementTree as ET",
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _col = ${JSON.stringify(column)}`,
      `    _paths = ${JSON.stringify(paths)}`,
      "    def _extract(_xml, _path):",
      "        try:",
      "            _root = ET.fromstring(_xml if isinstance(_xml, str) else str(_xml))",
      "            _tag = _path.lstrip('./').split('/')[-1]",
      "            _el = _root.find('.//' + _tag)",
      "            return _el.text if _el is not None else None",
      "        except Exception:",
      "            return None"
    ];
    for (const [path, colName] of Object.entries(paths)) {
      python.push(
        `    _df[${JSON.stringify(String(colName))}] = _df[_col].apply(lambda x: _extract(x, ${JSON.stringify(path)}))`
      );
    }
    python.push(
      `    _df.to_sql("${escapePyString(tableName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[xml_parser] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[xml_parser] failed: {_e}")',
      "    raise"
    );
    return { python };
  }
};

// ../../../../../tmp/eltpulse-compile-EyK14Q/xml_parser.ts
function compile(config) {
  return xmlParserComponent.compile(config);
}
export {
  compile
};
