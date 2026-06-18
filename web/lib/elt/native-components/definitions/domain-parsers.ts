import { escapePyString } from "@/lib/elt/escape-py";
import type { NativeComponentDefinition } from "../types";
import { inputTable, outputTable } from "./_config-helpers";
import { pandasReadTable, strList } from "./_pandas-helpers";
import { FIX_MESSAGE_PARSER_SNIPPET } from "../python-snippets/fix-message-parser-snippet";
import { HL7_V2_PARSER_SNIPPET } from "../python-snippets/hl7-v2-parser-snippet";

function outputParts(output: string) {
  const outSchema = output.includes(".") ? output.split(".")[0]! : "public";
  const outName = output.includes(".") ? output.split(".").pop()! : output;
  return { outSchema, outName };
}

const DAGSTER_ONLY = [
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
  "partition_dimensions",
];

export const hl7V2ParserComponent: NativeComponentDefinition = {
  id: "hl7_v2_parser",
  name: "HL7 v2 parser",
  category: "transformation",
  description: "Parse pipe-delimited HL7 v2 messages (MSH, PID, OBX, ORC, OBR, PV1, EVN, DG1, AL1).",
  compileTarget: "python",
  dagsterOnlyFields: DAGSTER_ONLY,
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "message_column", label: "Message column", type: "string", default: "message" },
    {
      key: "keep_segments",
      label: "Keep segments",
      type: "string_list",
      description: "MSH, PID, OBX, ORC, OBR, PV1, EVN, DG1, AL1",
      default: ["MSH", "PID", "OBX"],
    },
    { key: "output_table", label: "Output table", type: "string", required: true },
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config);
    const messageCol = String(config.message_column ?? "message").trim();
    const keepSegments = strList(config.keep_segments).length
      ? strList(config.keep_segments)
      : ["MSH", "PID", "OBX"];
    if (!table || !output) {
      return { warnings: ["hl7_v2_parser: table and output_table required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const keepPy = `[${keepSegments.map((s) => JSON.stringify(s)).join(", ")}]`;
    const python = [
      `# ── hl7_v2_parser: ${table} → ${output} ──`,
      HL7_V2_PARSER_SNIPPET.trim(),
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    _msg_col = ${JSON.stringify(messageCol)}`,
      "    if _msg_col not in _df.columns:",
      `        raise ValueError(f"message_column {_msg_col!r} not in table columns")`,
      `    _keep = ${keepPy}`,
      "    _all_rows = []",
      "    for _, _src in _df.iterrows():",
      "        _raw = _src[_msg_col]",
      "        if not isinstance(_raw, str) or not _raw.strip():",
      "            continue",
      "        for _row in _hl7_parse_message(_raw, _keep):",
      "            for _c in _df.columns:",
      "                if _c != _msg_col and _c not in _row:",
      "                    _row[_c] = _src[_c]",
      "            _all_rows.append(_row)",
      "    _df = pd.DataFrame(_all_rows)",
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[hl7_v2_parser] wrote {len(_df)} segment rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[hl7_v2_parser] failed: {_e}")',
      "    raise",
    ];
    return { python };
  },
};

export const fixMessageParserComponent: NativeComponentDefinition = {
  id: "fix_message_parser",
  name: "FIX message parser",
  category: "transformation",
  description: "Parse FIX trading messages (tag=value) into flat rows with symbol, side, qty, price.",
  compileTarget: "python",
  dagsterOnlyFields: DAGSTER_ONLY,
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "message_column", label: "Message column", type: "string", default: "message" },
    { key: "msg_type_filter", label: "MsgType filter", type: "string_list", description: "e.g. D, 8" },
    { key: "output_table", label: "Output table", type: "string", required: true },
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config);
    const messageCol = String(config.message_column ?? "message").trim();
    const typeFilter = strList(config.msg_type_filter);
    if (!table || !output) {
      return { warnings: ["fix_message_parser: table and output_table required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const filterPy = typeFilter.length
      ? `{${typeFilter.map((t) => JSON.stringify(String(t))).join(", ")}}`
      : "None";
    const python = [
      `# ── fix_message_parser: ${table} → ${output} ──`,
      FIX_MESSAGE_PARSER_SNIPPET.trim(),
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    _msg_col = ${JSON.stringify(messageCol)}`,
      `    _type_filter = ${filterPy}`,
      "    if _msg_col not in _df.columns:",
      `        raise ValueError(f"message_column {_msg_col!r} not in table columns")`,
      "    _all_rows = []",
      "    for _, _src in _df.iterrows():",
      "        _raw = _src[_msg_col]",
      "        if not isinstance(_raw, str) or not _raw.strip():",
      "            continue",
      "        _row = _fix_parse_message(_raw)",
      "        if _type_filter and _row.get('msg_type') not in _type_filter:",
      "            continue",
      "        for _c in _df.columns:",
      "            if _c != _msg_col and _c not in _row:",
      "                _row[_c] = _src[_c]",
      "        _all_rows.append(_row)",
      "    _df = pd.DataFrame(_all_rows)",
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[fix_message_parser] wrote {len(_df)} messages to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[fix_message_parser] failed: {_e}")',
      "    raise",
    ];
    return { python };
  },
};

export const emailParserComponent: NativeComponentDefinition = {
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
      default: ["from", "to", "subject", "date", "body"],
    },
    { key: "output_prefix", label: "Output prefix", type: "string", default: "" },
    { key: "drop_source", label: "Drop source column", type: "boolean", default: false },
    { key: "output_table", label: "Output table", type: "string" },
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config, table);
    const column = String(config.column ?? config.message_column ?? "").trim();
    const fields = strList(config.extract_fields).length
      ? strList(config.extract_fields)
      : ["from", "to", "subject", "date", "body"];
    const prefix = String(config.output_prefix ?? "");
    const dropSource = config.drop_source === true;
    if (!table || !column) {
      return { warnings: ["email_parser: table and column required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const fieldsPy = JSON.stringify(fields);
    const python = [
      `# ── email_parser: ${table} ──`,
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
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
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
      "    raise",
    ];
    return { python };
  },
};

export const regexParserComponent: NativeComponentDefinition = {
  id: "regex_parser",
  name: "Regex parser",
  category: "transformation",
  description: "Extract, match, replace, or split text with regular expressions.",
  compileTarget: "python",
  dagsterOnlyFields: DAGSTER_ONLY,
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "column", label: "Column", type: "string", required: true },
    { key: "pattern", label: "Regex pattern", type: "text", required: true },
    {
      key: "mode",
      label: "Mode",
      type: "select",
      options: ["extract", "match", "replace", "split"],
      default: "extract",
    },
    { key: "replacement", label: "Replacement (replace mode)", type: "string" },
    { key: "output_columns", label: "Output column names", type: "string_list" },
    { key: "output_column", label: "Output column (match/replace)", type: "string" },
    { key: "output_table", label: "Output table", type: "string" },
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config, table);
    const column = String(config.column ?? "").trim();
    const pattern = String(config.pattern ?? "").trim();
    const mode = String(config.mode ?? "extract").trim();
    const replacement = String(config.replacement ?? "");
    const outCols = strList(config.output_columns);
    const outCol = String(config.output_column ?? column).trim();
    if (!table || !column || !pattern) {
      return { warnings: ["regex_parser: table, column, pattern required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const outColsPy = outCols.length ? JSON.stringify(outCols) : "None";
    const python = [
      `# ── regex_parser: ${table}.${column} (${mode}) ──`,
      "import re",
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    _col = ${JSON.stringify(column)}`,
      `    _pat = ${JSON.stringify(pattern)}`,
      `    _mode = ${JSON.stringify(mode)}`,
      `    _repl = ${JSON.stringify(replacement)}`,
      `    _out_col = ${JSON.stringify(outCol)}`,
      `    _out_cols = ${outColsPy}`,
      "    if _col not in _df.columns:",
      `        raise ValueError(f"column {_col!r} not in table")`,
      "    _src = _df[_col].astype(str) if _df[_col].dtype != 'object' else _df[_col]",
      "    if _mode == 'extract':",
      "        _xpat = _pat",
      "        try:",
      "            if re.compile(_pat).groups == 0:",
      "                _xpat = f'({_pat})'",
      "        except re.error:",
      "            pass",
      "        _extracted = _src.str.extract(_xpat)",
      "        if _out_cols:",
      "            _extracted.columns = _out_cols[:len(_extracted.columns)]",
      "        else:",
      "            _extracted.columns = [f'{_col}_extracted_{i}' for i in range(len(_extracted.columns))]",
      "        _df = pd.concat([_df, _extracted], axis=1)",
      "    elif _mode == 'match':",
      "        _df[_out_col] = _src.str.match(_pat)",
      "    elif _mode == 'replace':",
      "        _df[_out_col] = _src.str.replace(_pat, _repl, regex=True)",
      "    elif _mode == 'split':",
      "        _df = _df.assign(**{_col: _src.str.split(_pat)}).explode(_col).reset_index(drop=True)",
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[regex_parser] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[regex_parser] failed: {_e}")',
      "    raise",
    ];
    return { python };
  },
};

export const htmlParserComponent: NativeComponentDefinition = {
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
      default: "strip_tags",
    },
    { key: "parser", label: "BS parser", type: "select", options: ["html.parser", "lxml", "html5lib"], default: "html.parser" },
    { key: "new_column_suffix", label: "New column suffix", type: "string" },
    { key: "output_table", label: "Output table", type: "string" },
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
      `# ── html_parser: ${table} ──`,
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
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
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
      "    raise",
    ];
    return { python };
  },
};
