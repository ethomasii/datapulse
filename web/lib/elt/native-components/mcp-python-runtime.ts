/**
 * Shared Python snippets for MCP + LLM native components (worker post_transform).
 * Mirrors dagster-component-templates mcp_tool_call / litellm_agent patterns.
 */
import { escapePyString } from "@/lib/elt/escape-py";
import type { ResolvedMcpServer } from "@/lib/elt/mcp-server/types";

export const MCP_PYTHON_RUNTIME_PREAMBLE = `
# ── eltPulse MCP runtime (shared) ──
import asyncio
import json
import os
from contextlib import AsyncExitStack

def _eltpulse_substitute_args(args, substitutions):
    if isinstance(args, dict):
        return {k: _eltpulse_substitute_args(v, substitutions) for k, v in args.items()}
    if isinstance(args, list):
        return [_eltpulse_substitute_args(v, substitutions) for v in args]
    if isinstance(args, str) and "{" in args:
        out = args
        out = out.replace("{run_id}", str(substitutions.get("run_id", "")))
        out = out.replace("{partition_key}", str(substitutions.get("partition_key", "")))
        for dim, val in (substitutions.get("partition_keys") or {}).items():
            out = out.replace("{partition_keys." + dim + "}", str(val))
        return out
    return args

def _eltpulse_resolve_headers(cfg, server_name):
    headers = dict(cfg.get("headers") or {})
    for header_name, env_var in (cfg.get("headers_env") or {}).items():
        val = os.environ.get(str(env_var))
        if val is None:
            raise ValueError(f"MCP server {server_name!r}: env {env_var!r} not set for header {header_name!r}")
        headers[header_name] = val
    return headers

async def _eltpulse_mcp_call_tool(server_cfg, tool_name, tool_args, parse_as="auto"):
    from mcp import ClientSession
    name = server_cfg.get("name") or "mcp"
    transport = server_cfg.get("type") or server_cfg.get("transport") or "stdio"
    async with AsyncExitStack() as stack:
        if transport == "stdio":
            from mcp.client.stdio import stdio_client
            from mcp import StdioServerParameters
            cmd = server_cfg.get("command") or []
            if not cmd:
                raise ValueError(f"MCP stdio server {name!r} missing command")
            env = dict(os.environ)
            env.update({k: str(v) for k, v in (server_cfg.get("env") or {}).items()})
            params = StdioServerParameters(command=cmd[0], args=list(cmd[1:]), env=env)
            read, write = await stack.enter_async_context(stdio_client(params))
            session = await stack.enter_async_context(ClientSession(read, write))
            await session.initialize()
        elif transport in ("http", "streamable_http", "streamable-http"):
            from mcp.client.streamable_http import streamablehttp_client
            url = server_cfg.get("url")
            if not url:
                raise ValueError(f"MCP http server {name!r} missing url")
            headers = _eltpulse_resolve_headers(server_cfg, name)
            read, write, _sid = await stack.enter_async_context(streamablehttp_client(url, headers=headers or None))
            session = await stack.enter_async_context(ClientSession(read, write))
            await session.initialize()
        elif transport == "sse":
            from mcp.client.sse import sse_client
            url = server_cfg.get("url")
            if not url:
                raise ValueError(f"MCP sse server {name!r} missing url")
            headers = _eltpulse_resolve_headers(server_cfg, name)
            read, write = await stack.enter_async_context(sse_client(url, headers=headers or None))
            session = await stack.enter_async_context(ClientSession(read, write))
            await session.initialize()
        else:
            raise ValueError(f"Unknown MCP transport: {transport!r}")
        result = await session.call_tool(tool_name, tool_args or {})
        parts = []
        for c in result.content:
            text = getattr(c, "text", None)
            parts.append(text if text is not None else str(c))
        raw = "\\n".join(parts) if parts else ""
        if getattr(result, "isError", False):
            raise RuntimeError(f"MCP tool {tool_name!r} error: {raw[:500]}")
        if parse_as == "text":
            return raw
        if parse_as in ("json", "auto"):
            try:
                return json.loads(raw)
            except Exception:
                if parse_as == "json":
                    raise
                return raw
        return raw

async def _eltpulse_mcp_with_session(server_cfg, callback):
    from mcp import ClientSession
    name = server_cfg.get("name") or "mcp"
    transport = server_cfg.get("type") or server_cfg.get("transport") or "stdio"
    async with AsyncExitStack() as stack:
        if transport == "stdio":
            from mcp.client.stdio import stdio_client
            from mcp import StdioServerParameters
            cmd = server_cfg.get("command") or []
            if not cmd:
                raise ValueError(f"MCP stdio server {name!r} missing command")
            env = dict(os.environ)
            env.update({k: str(v) for k, v in (server_cfg.get("env") or {}).items()})
            params = StdioServerParameters(command=cmd[0], args=list(cmd[1:]), env=env)
            read, write = await stack.enter_async_context(stdio_client(params))
            session = await stack.enter_async_context(ClientSession(read, write))
            await session.initialize()
        elif transport in ("http", "streamable_http", "streamable-http"):
            from mcp.client.streamable_http import streamablehttp_client
            url = server_cfg.get("url")
            if not url:
                raise ValueError(f"MCP http server {name!r} missing url")
            headers = _eltpulse_resolve_headers(server_cfg, name)
            read, write, _sid = await stack.enter_async_context(streamablehttp_client(url, headers=headers or None))
            session = await stack.enter_async_context(ClientSession(read, write))
            await session.initialize()
        elif transport == "sse":
            from mcp.client.sse import sse_client
            url = server_cfg.get("url")
            if not url:
                raise ValueError(f"MCP sse server {name!r} missing url")
            headers = _eltpulse_resolve_headers(server_cfg, name)
            read, write = await stack.enter_async_context(sse_client(url, headers=headers or None))
            session = await stack.enter_async_context(ClientSession(read, write))
            await session.initialize()
        else:
            raise ValueError(f"Unknown MCP transport: {transport!r}")
        return await callback(session)

async def _eltpulse_list_mcp_tools(server_cfg):
    async def _list(session):
        result = await session.list_tools()
        out = []
        for t in result.tools:
            schema = getattr(t, "inputSchema", None) or getattr(t, "input_schema", None)
            out.append({"name": t.name, "description": getattr(t, "description", None) or "", "inputSchema": schema})
        return out
    return await _eltpulse_mcp_with_session(server_cfg, _list)

async def _eltpulse_mcp_call_tool_async(server_cfg, tool_name, tool_args, parse_as="auto"):
    async def _call(session):
        result = await session.call_tool(tool_name, tool_args or {})
        parts = []
        for c in result.content:
            text = getattr(c, "text", None)
            parts.append(text if text is not None else str(c))
        raw = "\\n".join(parts) if parts else ""
        if getattr(result, "isError", False):
            raise RuntimeError(f"MCP tool {tool_name!r} error: {raw[:500]}")
        if parse_as == "text":
            return raw
        if parse_as in ("json", "auto"):
            try:
                return json.loads(raw)
            except Exception:
                if parse_as == "json":
                    raise
                return raw
        return raw
    return await _eltpulse_mcp_with_session(server_cfg, _call)

def _eltpulse_mcp_tools_for_litellm(servers):
    tools = []
    for idx, srv in enumerate(servers or []):
        srv_name = str(srv.get("name") or f"mcp_{idx}")
        try:
            mcp_tools = asyncio.run(_eltpulse_list_mcp_tools(srv))
        except Exception as exc:
            print(f"[litellm_agent] list_tools warning for {srv_name}: {exc}")
            continue
        for t in mcp_tools:
            fn_name = f"{srv_name}__{t['name']}"
            schema = t.get("inputSchema") or {"type": "object", "properties": {}}
            tools.append({
                "type": "function",
                "function": {
                    "name": fn_name,
                    "description": (t.get("description") or fn_name)[:500],
                    "parameters": schema,
                },
            })
    return tools

def _eltpulse_dispatch_mcp_tool(servers, prefixed_name, args):
    if "__" not in prefixed_name:
        raise ValueError(f"Invalid MCP tool name: {prefixed_name!r}")
    srv_name, tool_name = prefixed_name.split("__", 1)
    srv_cfg = None
    for idx, srv in enumerate(servers or []):
        if str(srv.get("name") or f"mcp_{idx}") == srv_name:
            srv_cfg = srv
            break
    if not srv_cfg:
        raise ValueError(f"No MCP server named {srv_name!r}")
    return asyncio.run(_eltpulse_mcp_call_tool_async(srv_cfg, tool_name, args, "text"))
`.trim();

let preambleInjected = false;

export function resetMcpPreambleFlagForTests() {
  preambleInjected = false;
}

export function takeMcpPythonPreamble(): string[] {
  if (preambleInjected) return [];
  preambleInjected = true;
  return [MCP_PYTHON_RUNTIME_PREAMBLE];
}

export function resolvedServerToPythonCfg(server: ResolvedMcpServer | Record<string, unknown>): string {
  const s = server as ResolvedMcpServer;
  const cfg = {
    name: s.name ?? "mcp",
    type: s.transport ?? (s as Record<string, unknown>).type ?? "stdio",
    command: s.config?.command,
    url: s.config?.url,
    env: s.config?.env,
    headers: s.config?.headers,
    headers_env: s.config?.headers_env,
  };
  return JSON.stringify(cfg);
}

export function emitMcpToolCallPython(opts: {
  label: string;
  server: ResolvedMcpServer | Record<string, unknown>;
  toolName: string;
  toolArgs: Record<string, unknown>;
  parseAs: string;
  outputTable?: string;
}): string[] {
  const serverPy = resolvedServerToPythonCfg(opts.server);
  const argsPy = JSON.stringify(opts.toolArgs ?? {});
  const lines = [
    `# ── mcp_tool_call: ${opts.label} ──`,
    "_mcp_server_cfg = " + serverPy,
    "_mcp_args = " + argsPy,
    "_mcp_subs = {'run_id': getattr(pipeline, 'run_id', '')}",
    "_mcp_res = asyncio.run(_eltpulse_mcp_call_tool(_mcp_server_cfg, "
      + JSON.stringify(opts.toolName)
      + ", _eltpulse_substitute_args(_mcp_args, _mcp_subs), "
      + JSON.stringify(opts.parseAs)
      + "))",
    "print(f'[mcp_tool_call] {opts.label}: ok')",
  ];

  const out = String(opts.outputTable ?? "").trim();
  if (out) {
    lines.push(
      "import pandas as pd",
      "try:",
      "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
      "    _sql = _dest_client.sql_client()",
      "    if isinstance(_mcp_res, (dict, list)):",
      "        _mcp_df = pd.json_normalize(_mcp_res if isinstance(_mcp_res, list) else [_mcp_res])",
      "    else:",
      "        _mcp_df = pd.DataFrame([{'result': _mcp_res}])",
      `    _mcp_df.to_sql(${JSON.stringify(out.split(".").pop())}, _sql._engine, schema=${JSON.stringify(out.includes(".") ? out.split(".")[0] : "public")}, if_exists='replace', index=False)`,
      "except Exception as _mcp_write_err:",
      '    print(f"[mcp_tool_call] write warning: {_mcp_write_err}")'
    );
  }
  return lines;
}

export function emitLitellmAgentPython(opts: {
  label: string;
  prompt: string;
  systemPrompt?: string;
  model: string;
  apiKeyEnv?: string;
  maxIterations: number;
  mcpServers: Array<Record<string, unknown>>;
}): string[] {
  const serversPy = JSON.stringify(
    opts.mcpServers.map((s, idx) => {
      const resolved = (s as { _resolved?: ResolvedMcpServer })._resolved ?? (s as ResolvedMcpServer);
      const cfg = JSON.parse(resolvedServerToPythonCfg(resolved)) as Record<string, unknown>;
      const wrapperName = (s as { name?: string }).name;
      if (wrapperName) cfg.name = wrapperName;
      else if (!cfg.name || cfg.name === "mcp") cfg.name = resolved.name ?? `mcp_${idx}`;
      return cfg;
    })
  );

  return [
    `# ── litellm_agent: ${opts.label} ──`,
    "try:",
    "    import litellm",
    "except ImportError as _e:",
    '    raise RuntimeError("litellm package required for agent components") from _e',
    "_agent_servers = " + serversPy,
    "_agent_tools = _eltpulse_mcp_tools_for_litellm(_agent_servers)",
    "_agent_messages = []",
    opts.systemPrompt
      ? "_agent_messages.append({'role': 'system', 'content': " + JSON.stringify(opts.systemPrompt) + "})"
      : "",
    "_agent_messages.append({'role': 'user', 'content': " + JSON.stringify(opts.prompt) + "})",
    opts.apiKeyEnv
      ? `_agent_api_key = os.environ.get(${JSON.stringify(opts.apiKeyEnv)})`
      : "_agent_api_key = None",
    "_agent_final = None",
    "for _agent_i in range(" + String(opts.maxIterations) + "):",
    "    _agent_kwargs = {",
    "        'model': " + JSON.stringify(opts.model) + ",",
    "        'messages': _agent_messages,",
    "        'api_key': _agent_api_key,",
    "    }",
    "    if _agent_tools:",
    "        _agent_kwargs['tools'] = _agent_tools",
    "    _resp = litellm.completion(**_agent_kwargs)",
    "    _msg = _resp.choices[0].message",
    "    _tool_calls = getattr(_msg, 'tool_calls', None) or []",
    "    if _tool_calls:",
    "        _agent_messages.append({",
    "            'role': 'assistant',",
    "            'content': _msg.content or '',",
    "            'tool_calls': [",
    "                {'id': _tc.id, 'type': 'function', 'function': {'name': _tc.function.name, 'arguments': _tc.function.arguments or '{}'}}",
    "                for _tc in _tool_calls",
    "            ],",
    "        })",
    "        for _tc in _tool_calls:",
    "            _fn = _tc.function.name",
    "            try:",
    "                _args = json.loads(_tc.function.arguments or '{}')",
    "            except Exception:",
    "                _args = {}",
    "            try:",
    "                _tool_out = _eltpulse_dispatch_mcp_tool(_agent_servers, _fn, _args)",
    "            except Exception as _tool_err:",
    "                _tool_out = f'tool error: {_tool_err}'",
    "            _agent_messages.append({'role': 'tool', 'tool_call_id': _tc.id, 'content': str(_tool_out)})",
    "        continue",
    "    _agent_final = _msg.content",
    "    break",
    "print(f'[litellm_agent] {opts.label}: ' + str(_agent_final)[:200])",
  ].filter(Boolean);
}

export function emitLitellmInferencePython(opts: {
  label: string;
  table: string;
  promptColumn: string;
  outputColumn: string;
  model: string;
  outputTable: string;
}): string[] {
  return [
    `# ── litellm_inference_asset: ${opts.label} ──`,
    "import pandas as pd",
    "try:",
    "    import litellm",
    "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
    "    _sql = _dest_client.sql_client()",
    `    _df = pd.read_sql('SELECT * FROM ${escapePyString(opts.table)}', _sql._engine)`,
    `    _prompt_col = ${JSON.stringify(opts.promptColumn)}`,
    `    _out_col = ${JSON.stringify(opts.outputColumn)}`,
    "    _out_vals = []",
    "    for _row in _df[_prompt_col].astype(str):",
    "        _r = litellm.completion(model=" + JSON.stringify(opts.model) + ", messages=[{'role':'user','content': _row}])",
    "        _out_vals.append(_r.choices[0].message.content)",
    "    _df[_out_col] = _out_vals",
    `    _out_schema = ${JSON.stringify(opts.outputTable.includes(".") ? opts.outputTable.split(".")[0] : "public")}`,
    `    _out_name = ${JSON.stringify(opts.outputTable.includes(".") ? opts.outputTable.split(".").pop() : opts.outputTable)}`,
    "    _df.to_sql(_out_name, _sql._engine, schema=_out_schema, if_exists='replace', index=False)",
    "except Exception as _inf_err:",
    '    print(f"[litellm_inference] warning: {_inf_err}")',
  ];
}

export function emitLlmEvaluatorPython(opts: {
  label: string;
  inputColumn: string;
  referenceColumn?: string;
  feedback: string;
  model: string;
  outputTable: string;
  table: string;
}): string[] {
  return [
    `# ── llm_evaluator: ${opts.label} ──`,
    "import pandas as pd",
    "try:",
    "    import litellm",
    "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
    "    _sql = _dest_client.sql_client()",
    `    _df = pd.read_sql('SELECT * FROM ${escapePyString(opts.table)}', _sql._engine)`,
    `    _judge_prompt = "Score ${opts.feedback} from 0-1. Reply JSON: {{\\"score\\": float, \\"reason\\": str}}. Answer: " + str(_df.iloc[0][${JSON.stringify(opts.inputColumn)}])`,
    "    _j = litellm.completion(model=" + JSON.stringify(opts.model) + ", messages=[{'role':'user','content': _judge_prompt}])",
    "    _df['llm_eval_score'] = _j.choices[0].message.content",
    `    _out_schema = ${JSON.stringify(opts.outputTable.includes(".") ? opts.outputTable.split(".")[0] : "public")}`,
    `    _out_name = ${JSON.stringify(opts.outputTable.includes(".") ? opts.outputTable.split(".").pop() : opts.outputTable)}`,
    "    _df.to_sql(_out_name, _sql._engine, schema=_out_schema, if_exists='replace', index=False)",
    "except Exception as _eval_err:",
    '    print(f"[llm_evaluator] warning: {_eval_err}")',
  ];
}

function warehouseWriteLines(outputTable: string): string[] {
  const outSchema = outputTable.includes(".") ? outputTable.split(".")[0] : "public";
  const outName = outputTable.includes(".") ? outputTable.split(".").pop()! : outputTable;
  return [
    `    _out_schema = ${JSON.stringify(outSchema)}`,
    `    _out_name = ${JSON.stringify(outName)}`,
    "    _df.to_sql(_out_name, _sql._engine, schema=_out_schema, if_exists='replace', index=False)",
  ];
}

export function emitLitellmStructuredOutputPython(opts: {
  label: string;
  table: string;
  textColumn: string;
  schemaDefinition: Record<string, unknown>;
  model: string;
  promptPrefix?: string;
  outputPrefix: string;
  onError: string;
  apiKeyEnv?: string;
  outputTable: string;
}): string[] {
  const fieldNames = Object.keys(opts.schemaDefinition);
  const columnNames = fieldNames.map((f) => `${opts.outputPrefix}${f}`);
  return [
    `# ── litellm_structured_output: ${opts.label} ──`,
    "import json",
    "import os",
    "import pandas as pd",
    "try:",
    "    import litellm",
    "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
    "    _sql = _dest_client.sql_client()",
    `    _df = pd.read_sql('SELECT * FROM ${escapePyString(opts.table)}', _sql._engine)`,
    `    _text_col = ${JSON.stringify(opts.textColumn)}`,
    `    _schema_def = ${JSON.stringify(opts.schemaDefinition)}`,
    `    _field_names = ${JSON.stringify(fieldNames)}`,
    `    _col_names = ${JSON.stringify(columnNames)}`,
    `    _out_prefix = ${JSON.stringify(opts.outputPrefix)}`,
    `    _on_error = ${JSON.stringify(opts.onError)}`,
    "    _schema_str = json.dumps(_schema_def, indent=2)",
    "    _kwargs = {'model': " + JSON.stringify(opts.model) + ", 'response_format': {'type': 'json_object'}}",
    opts.apiKeyEnv
      ? `    _kwargs['api_key'] = os.environ.get(${JSON.stringify(opts.apiKeyEnv)})`
      : "",
    opts.promptPrefix
      ? `    _prompt_prefix = ${JSON.stringify(opts.promptPrefix)}`
      : "    _prompt_prefix = None",
    "    _rows_to_drop = []",
    "    _extracted_rows = []",
    "    for _i, _row in _df.iterrows():",
    "        _text = str(_row[_text_col])",
    "        if _prompt_prefix:",
    "            _user_content = f'{_prompt_prefix}\\n\\n{_text}'",
    "        else:",
    "            _user_content = (",
    "                'Extract the following fields from the text below as a JSON object.\\n'",
    "                f'Schema: {_schema_str}\\n\\nText: {_text}'",
    "            )",
    "        try:",
    "            _resp = litellm.completion(messages=[{'role': 'user', 'content': _user_content}], **_kwargs)",
    "            _content = _resp.choices[0].message.content or '{}'",
    "            _parsed = json.loads(_content)",
    "            _extracted_rows.append({_out_prefix + k: _parsed.get(k) for k in _field_names})",
    "        except Exception as _ext_err:",
    "            if _on_error == 'raise':",
    "                raise",
    "            elif _on_error == 'skip':",
    "                _rows_to_drop.append(_i)",
    "                _extracted_rows.append(None)",
    "                print(f'[litellm_structured_output] row {_i} skipped: {_ext_err}')",
    "            else:",
    "                _extracted_rows.append({c: None for c in _col_names})",
    "                print(f'[litellm_structured_output] row {_i} null-filled: {_ext_err}')",
    "    _extracted_df = pd.DataFrame(",
    "        [_r if _r is not None else {c: None for c in _col_names} for _r in _extracted_rows],",
    "        index=_df.index,",
    "    )",
    "    _df = pd.concat([_df, _extracted_df], axis=1)",
    "    if _rows_to_drop:",
    "        _df = _df.drop(index=_rows_to_drop).reset_index(drop=True)",
    ...warehouseWriteLines(opts.outputTable).map((l) => l),
    "except Exception as _struct_err:",
    '    print(f"[litellm_structured_output] warning: {_struct_err}")',
  ].filter(Boolean);
}

export function emitLitellmFunctionCallingPython(opts: {
  label: string;
  table: string;
  textColumn: string;
  tools: unknown[];
  model: string;
  outputColumn: string;
  systemPrompt?: string;
  apiKeyEnv?: string;
  outputTable: string;
}): string[] {
  return [
    `# ── litellm_function_calling: ${opts.label} ──`,
    "import json",
    "import os",
    "import pandas as pd",
    "try:",
    "    import litellm",
    "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
    "    _sql = _dest_client.sql_client()",
    `    _df = pd.read_sql('SELECT * FROM ${escapePyString(opts.table)}', _sql._engine)`,
    `    _text_col = ${JSON.stringify(opts.textColumn)}`,
    `    _out_col = ${JSON.stringify(opts.outputColumn)}`,
    `    _tools = ${JSON.stringify(opts.tools)}`,
    "    _kwargs = {'model': " + JSON.stringify(opts.model) + ", 'tools': _tools}",
    opts.apiKeyEnv
      ? `    _kwargs['api_key'] = os.environ.get(${JSON.stringify(opts.apiKeyEnv)})`
      : "",
    opts.systemPrompt
      ? `    _system_prompt = ${JSON.stringify(opts.systemPrompt)}`
      : "    _system_prompt = None",
    "    _results = []",
    "    for _, _row in _df.iterrows():",
    "        _text = str(_row[_text_col])",
    "        _messages = []",
    "        if _system_prompt:",
    "            _messages.append({'role': 'system', 'content': _system_prompt})",
    "        _messages.append({'role': 'user', 'content': _text})",
    "        _resp = litellm.completion(messages=_messages, **_kwargs)",
    "        _msg = _resp.choices[0].message",
    "        _tool_calls = getattr(_msg, 'tool_calls', None) or []",
    "        if _tool_calls:",
    "            _tc_data = [",
    "                {'id': _tc.id, 'type': _tc.type, 'function': {'name': _tc.function.name, 'arguments': _tc.function.arguments}}",
    "                for _tc in _tool_calls",
    "            ]",
    "            _results.append(json.dumps(_tc_data))",
    "        else:",
    "            _results.append(json.dumps([]))",
    "    _df[_out_col] = _results",
    ...warehouseWriteLines(opts.outputTable).map((l) => l),
    "except Exception as _fn_err:",
    '    print(f"[litellm_function_calling] warning: {_fn_err}")',
  ].filter(Boolean);
}

export function emitRagPipelinePython(opts: {
  label: string;
  table: string;
  queryColumn: string;
  answerColumn: string;
  sourcesColumn: string;
  vectorStoreProvider: string;
  collectionName: string;
  vectorStoreConnection?: string;
  llmProvider: string;
  llmModel: string;
  llmApiKeyEnv?: string;
  embeddingProvider: string;
  embeddingModel: string;
  embeddingApiKeyEnv?: string;
  topK: number;
  temperature: number;
  includeSources: boolean;
  outputTable: string;
}): string[] {
  return [
    `# ── rag_pipeline: ${opts.label} ──`,
    "import json",
    "import os",
    "import pandas as pd",
    "try:",
    "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
    "    _sql = _dest_client.sql_client()",
    `    _df = pd.read_sql('SELECT * FROM ${escapePyString(opts.table)}', _sql._engine)`,
    `    _query_col = ${JSON.stringify(opts.queryColumn)}`,
    `    _answer_col = ${JSON.stringify(opts.answerColumn)}`,
    `    _sources_col = ${JSON.stringify(opts.sourcesColumn)}`,
    `    _vs_provider = ${JSON.stringify(opts.vectorStoreProvider)}`,
    `    _collection = ${JSON.stringify(opts.collectionName)}`,
    `    _vs_conn = ${JSON.stringify(opts.vectorStoreConnection ?? "./chroma_db")}`,
    `    _llm_provider = ${JSON.stringify(opts.llmProvider)}`,
    `    _llm_model = ${JSON.stringify(opts.llmModel)}`,
    `    _embed_provider = ${JSON.stringify(opts.embeddingProvider)}`,
    `    _embed_model = ${JSON.stringify(opts.embeddingModel)}`,
    `    _top_k = ${opts.topK}`,
    `    _temperature = ${opts.temperature}`,
    `    _include_sources = ${opts.includeSources ? "True" : "False"}`,
    opts.llmApiKeyEnv
      ? `    _llm_api_key = os.environ.get(${JSON.stringify(opts.llmApiKeyEnv)})`
      : "    _llm_api_key = None",
    opts.embeddingApiKeyEnv
      ? `    _embed_api_key = os.environ.get(${JSON.stringify(opts.embeddingApiKeyEnv)})`
      : "    _embed_api_key = _llm_api_key",
    "    if _query_col not in _df.columns:",
    "        raise ValueError(f'Query column {_query_col!r} not in dataframe')",
    "    def _query_embedding(_query):",
    "        if _embed_provider == 'openai':",
    "            import openai",
    "            _client = openai.OpenAI(api_key=_embed_api_key)",
    "            _resp = _client.embeddings.create(model=_embed_model, input=[_query])",
    "            return _resp.data[0].embedding",
    "        raise ValueError(f'Unsupported embedding provider: {_embed_provider}')",
    "    def _retrieve(_embedding):",
    "        _docs = []",
    "        if _vs_provider == 'chromadb':",
    "            import chromadb",
    "            _client = chromadb.PersistentClient(path=_vs_conn)",
    "            _coll = _client.get_collection(name=_collection)",
    "            _res = _coll.query(query_embeddings=[_embedding], n_results=_top_k)",
    "            for _j in range(len(_res['ids'][0])):",
    "                _docs.append({'text': (_res.get('documents') or [['']])[0][_j], 'metadata': (_res.get('metadatas') or [[{}]])[0][_j]})",
    "        elif _vs_provider == 'pinecone':",
    "            from pinecone import Pinecone",
    "            _pc = Pinecone(api_key=_embed_api_key)",
    "            _index = _pc.Index(_collection)",
    "            _res = _index.query(vector=_embedding, top_k=_top_k, include_metadata=True)",
    "            for _match in _res.get('matches', []):",
    "                _docs.append({'text': (_match.get('metadata') or {}).get('text', ''), 'metadata': _match.get('metadata') or {}})",
    "        else:",
    "            raise ValueError(f'Unsupported vector store: {_vs_provider}')",
    "        return _docs",
    "    def _generate(_query, _docs):",
    "        _ctx = '\\n\\n'.join([d['text'] for d in _docs])",
    "        _prompt = f'Answer based on context.\\n\\nContext:\\n{_ctx}\\n\\nQuestion: {_query}\\n\\nAnswer:'",
    "        if _llm_provider == 'openai':",
    "            import openai",
    "            _client = openai.OpenAI(api_key=_llm_api_key)",
    "            _resp = _client.chat.completions.create(model=_llm_model, messages=[{'role': 'user', 'content': _prompt}], temperature=_temperature)",
    "            return _resp.choices[0].message.content",
    "        if _llm_provider == 'anthropic':",
    "            import anthropic",
    "            _client = anthropic.Anthropic(api_key=_llm_api_key)",
    "            _msg = _client.messages.create(model=_llm_model, max_tokens=4096, temperature=_temperature, messages=[{'role': 'user', 'content': _prompt}])",
    "            return _msg.content[0].text",
    "        raise ValueError(f'Unsupported LLM provider: {_llm_provider}')",
    "    _answers, _sources = [], []",
    "    for _, _row in _df.iterrows():",
    "        _q = str(_row[_query_col])",
    "        _emb = _query_embedding(_q)",
    "        _docs = _retrieve(_emb)",
    "        _answers.append(_generate(_q, _docs))",
    "        _sources.append(_docs if _include_sources else [])",
    "    _df[_answer_col] = _answers",
    "    if _include_sources:",
    "        _df[_sources_col] = _sources",
    ...warehouseWriteLines(opts.outputTable).map((l) => l),
    "except Exception as _rag_err:",
    '    print(f"[rag_pipeline] warning: {_rag_err}")',
  ].filter(Boolean);
}
