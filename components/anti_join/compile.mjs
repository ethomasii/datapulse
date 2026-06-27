// web/lib/elt/escape-py.ts
function escapePyString(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// web/lib/elt/native-components/definitions/_pandas-helpers.ts
function strList(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

// web/lib/elt/native-components/definitions/_sql-helpers.ts
function sqlQualifiedTable(table) {
  const parts = table.split(".").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return table;
  return parts.map((p) => `"${p.replace(/"/g, '""')}"`).join(".");
}
function sqlCreateTableAs(output, selectSql) {
  return `CREATE OR REPLACE TABLE ${sqlQualifiedTable(output)} AS
${selectSql}`;
}
function isDataframeExecution(config) {
  const mode = String(config.execution ?? config.transform_mode ?? "warehouse").toLowerCase();
  return mode === "dataframe" || mode === "pandas" || mode === "worker";
}
function sqlJoinOnClause(on, leftOn, rightOn, leftAlias = "l", rightAlias = "r") {
  if (on.length) {
    return on.map(
      (c) => `${leftAlias}."${c.replace(/"/g, '""')}" = ${rightAlias}."${c.replace(/"/g, '""')}"`
    ).join(" AND ");
  }
  if (leftOn.length && rightOn.length) {
    const pairs = Math.min(leftOn.length, rightOn.length);
    const clauses = [];
    for (let i = 0; i < pairs; i++) {
      const lo = leftOn[i];
      const ro = rightOn[i];
      clauses.push(
        `${leftAlias}."${lo.replace(/"/g, '""')}" = ${rightAlias}."${ro.replace(/"/g, '""')}"`
      );
    }
    return clauses.join(" AND ");
  }
  return "1 = 1";
}

// web/lib/elt/native-components/definitions/analytics-transforms.ts
function outputParts(output) {
  const outSchema = output.includes(".") ? output.split(".")[0] : "public";
  const outName = output.includes(".") ? output.split(".").pop() : output;
  return { outSchema, outName };
}
var antiJoinComponent = {
  id: "anti_join",
  aliases: ["except_join", "left_anti_join", "orphan_rows"],
  name: "Anti join",
  category: "transformation",
  description: "Rows in left table not in right \u2014 warehouse SQL anti-join (default) or dataframe.",
  compileTarget: "warehouse",
  fields: [
    { key: "left_table", label: "Left table", type: "string", required: true },
    { key: "right_table", label: "Right table", type: "string", required: true },
    { key: "on", label: "Join key(s)", type: "string_list", required: true },
    { key: "output_table", label: "Output table", type: "string", required: true },
    {
      key: "execution",
      label: "Execution",
      type: "select",
      options: ["warehouse", "dataframe"],
      default: "warehouse"
    }
  ],
  compile(config) {
    const left = String(config.left_table ?? "").trim();
    const right = String(config.right_table ?? "").trim();
    const output = String(config.output_table ?? "").trim();
    const on = strList(config.on ?? config.join_keys);
    if (!left || !right || !output || !on.length) {
      return { warnings: ["anti_join: left_table, right_table, on, output_table required"], sql: [], python: [] };
    }
    if (isDataframeExecution(config)) {
      const { outSchema, outName } = outputParts(output);
      const onPy = `[${on.map((c) => JSON.stringify(c)).join(", ")}]`;
      const python = [
        `# \u2500\u2500 anti_join (dataframe): ${left} \u2212 ${right} \u2500\u2500`,
        "import pandas as pd",
        "try:",
        "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
        "    _sql = _dest_client.sql_client()",
        `    _left = pd.read_sql('SELECT * FROM ${escapePyString(left)}', _sql._engine)`,
        `    _right = pd.read_sql('SELECT * FROM ${escapePyString(right)}', _sql._engine)`,
        `    _df = _left.merge(_right[${onPy}], on=${onPy}, how='left', indicator=True)`,
        "    _df = _df[_df['_merge'] == 'left_only'].drop(columns=['_merge'])",
        `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
        `    print(f"[anti_join] wrote {len(_df)} rows to ${escapePyString(output)}")`,
        "except Exception as _e:",
        '    print(f"[anti_join] failed: {_e}")',
        "    raise"
      ];
      return { python };
    }
    const leftQ = sqlQualifiedTable(left);
    const rightQ = sqlQualifiedTable(right);
    const onClause = sqlJoinOnClause(on, [], []);
    const nullCheck = on.map((c) => `r."${c.replace(/"/g, '""')}" IS NULL`).join(" AND ");
    const sql = [
      sqlCreateTableAs(
        output,
        `SELECT l.*
FROM ${leftQ} AS l
LEFT JOIN ${rightQ} AS r
  ON ${onClause}
WHERE ${nullCheck}`
      )
    ];
    return { sql };
  }
};

// ../../../../../tmp/eltpulse-compile-EyK14Q/anti_join.ts
function compile(config) {
  return antiJoinComponent.compile(config);
}
export {
  compile
};
