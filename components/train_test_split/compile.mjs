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

// web/lib/elt/native-components/definitions/_pandas-helpers.ts
function pandasReadTable(table) {
  return [
    "import pandas as pd",
    "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
    "    _sql = _dest_client.sql_client()",
    `    _df = pd.read_sql('SELECT * FROM ${escapePyString(table)}', _sql._engine)`
  ];
}

// web/lib/elt/native-components/definitions/more-transforms.ts
function outputParts(output) {
  const outSchema = output.includes(".") ? output.split(".")[0] : "public";
  const outName = output.includes(".") ? output.split(".").pop() : output;
  return { outSchema, outName };
}
var trainTestSplitComponent = {
  id: "train_test_split",
  aliases: ["train_test_splitter"],
  name: "Train/test split",
  category: "transformation",
  description: "Split table into train and test sets.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "test_size", label: "Test fraction (0\u20131)", type: "number", default: 0.2 },
    { key: "random_state", label: "Random seed", type: "number" },
    { key: "output_train", label: "Train output table", type: "string", required: true },
    { key: "output_test", label: "Test output table", type: "string", required: true }
  ],
  compile(config) {
    const table = inputTable(config);
    const testSize = Number(config.test_size ?? 0.2);
    const seed = config.random_state != null ? Math.floor(Number(config.random_state)) : null;
    const trainOut = String(config.output_train ?? config.train_table ?? "").trim();
    const testOut = String(config.output_test ?? "").trim();
    if (!table || !trainOut || !testOut) {
      return { warnings: ["train_test_split: table, output_train, output_test required"], python: [] };
    }
    const trainParts = outputParts(trainOut);
    const testParts = outputParts(testOut);
    const seedKw = seed != null ? `, random_state=${seed}` : "";
    const python = [
      `# \u2500\u2500 train_test_split: ${table} \u2500\u2500`,
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _test = _df.sample(frac=${testSize}${seedKw})`,
      "    _train = _df.drop(_test.index)",
      `    _train.to_sql("${escapePyString(trainParts.outName)}", _sql._engine, schema="${escapePyString(trainParts.outSchema)}", if_exists="replace", index=False)`,
      `    _test.to_sql("${escapePyString(testParts.outName)}", _sql._engine, schema="${escapePyString(testParts.outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[train_test_split] train={len(_train)} test={len(_test)}")`,
      "except Exception as _e:",
      '    print(f"[train_test_split] failed: {_e}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../../tmp/eltpulse-compile-EyK14Q/train_test_split.ts
function compile(config) {
  return trainTestSplitComponent.compile(config);
}
export {
  compile
};
