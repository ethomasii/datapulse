// web/lib/elt/escape-py.ts
function escapePyString(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// web/lib/elt/native-components/definitions/analytics-transforms.ts
function outputParts(output) {
  const outSchema = output.includes(".") ? output.split(".")[0] : "public";
  const outName = output.includes(".") ? output.split(".").pop() : output;
  return { outSchema, outName };
}
var crossJoinComponent = {
  id: "cross_join",
  aliases: ["cartesian_join"],
  name: "Cross join",
  category: "transformation",
  description: "Cartesian product of two tables.",
  compileTarget: "python",
  fields: [
    { key: "left_table", label: "Left table", type: "string", required: true },
    { key: "right_table", label: "Right table", type: "string", required: true },
    { key: "output_table", label: "Output table", type: "string", required: true }
  ],
  compile(config) {
    const left = String(config.left_table ?? "").trim();
    const right = String(config.right_table ?? "").trim();
    const output = String(config.output_table ?? "").trim();
    if (!left || !right || !output) {
      return { warnings: ["cross_join: left_table, right_table, output_table required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const python = [
      `# \u2500\u2500 cross_join: ${left} \xD7 ${right} \u2500\u2500`,
      "import pandas as pd",
      "try:",
      "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
      "    _sql = _dest_client.sql_client()",
      `    _left = pd.read_sql('SELECT * FROM ${escapePyString(left)}', _sql._engine)`,
      `    _right = pd.read_sql('SELECT * FROM ${escapePyString(right)}', _sql._engine)`,
      "    _left['_cross_key'] = 1",
      "    _right['_cross_key'] = 1",
      "    _df = _left.merge(_right, on='_cross_key').drop(columns=['_cross_key'])",
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[cross_join] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[cross_join] failed: {_e}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-SfOGBH/cross_join.ts
function compile(config) {
  return crossJoinComponent.compile(config);
}
export {
  compile
};
