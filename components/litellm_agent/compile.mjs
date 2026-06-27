// web/lib/elt/escape-py.ts
function escapePyString(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// web/lib/elt/native-components/mcp-python-runtime.ts
var MCP_PYTHON_RUNTIME_PREAMBLE = `
# \u2500\u2500 eltPulse MCP runtime (shared) \u2500\u2500
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

def _eltpulse_run_litellm_agent(user_prompt, system_prompt, model, api_key, max_iterations, servers, tools):
    import litellm
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": user_prompt})
    final = None
    for _agent_i in range(max_iterations):
        kwargs = {"model": model, "messages": messages, "api_key": api_key}
        if tools:
            kwargs["tools"] = tools
        resp = litellm.completion(**kwargs)
        msg = resp.choices[0].message
        tool_calls = getattr(msg, "tool_calls", None) or []
        if tool_calls:
            messages.append({
                "role": "assistant",
                "content": msg.content or "",
                "tool_calls": [
                    {"id": tc.id, "type": "function", "function": {"name": tc.function.name, "arguments": tc.function.arguments or "{}"}}
                    for tc in tool_calls
                ],
            })
            for tc in tool_calls:
                fn = tc.function.name
                try:
                    args = json.loads(tc.function.arguments or "{}")
                except Exception:
                    args = {}
                try:
                    tool_out = _eltpulse_dispatch_mcp_tool(servers, fn, args)
                except Exception as tool_err:
                    tool_out = f"tool error: {tool_err}"
                messages.append({"role": "tool", "tool_call_id": tc.id, "content": str(tool_out)})
            continue
        final = msg.content
        break
    return final if final is not None else ""
`.trim();
var preambleInjected = false;
function takeMcpPythonPreamble() {
  if (preambleInjected) return [];
  preambleInjected = true;
  return [MCP_PYTHON_RUNTIME_PREAMBLE];
}
function resolvedServerToPythonCfg(server) {
  const s = server;
  const cfg = {
    name: s.name ?? "mcp",
    type: s.transport ?? s.type ?? "stdio",
    command: s.config?.command,
    url: s.config?.url,
    env: s.config?.env,
    headers: s.config?.headers,
    headers_env: s.config?.headers_env
  };
  return JSON.stringify(cfg);
}
function emitLitellmAgentPython(opts) {
  const serversPy = JSON.stringify(
    opts.mcpServers.map((s, idx) => {
      const resolved = s._resolved ?? s;
      const cfg = JSON.parse(resolvedServerToPythonCfg(resolved));
      const wrapperName = s.name;
      if (wrapperName) cfg.name = wrapperName;
      else if (!cfg.name || cfg.name === "mcp") cfg.name = resolved.name ?? `mcp_${idx}`;
      return cfg;
    })
  );
  return [
    `# \u2500\u2500 litellm_agent: ${opts.label} \u2500\u2500`,
    "try:",
    "    import litellm",
    "except ImportError as _e:",
    '    raise RuntimeError("litellm package required for agent components") from _e',
    "_agent_servers = " + serversPy,
    "_agent_tools = _eltpulse_mcp_tools_for_litellm(_agent_servers)",
    opts.apiKeyEnv ? `_agent_api_key = os.environ.get(${JSON.stringify(opts.apiKeyEnv)})` : "_agent_api_key = None",
    "_agent_system = " + JSON.stringify(opts.systemPrompt ?? ""),
    "_agent_final = _eltpulse_run_litellm_agent(" + JSON.stringify(opts.prompt) + ", _agent_system, " + JSON.stringify(opts.model) + ", _agent_api_key, " + String(opts.maxIterations) + ", _agent_servers, _agent_tools)",
    "print(f'[litellm_agent] {opts.label}: ' + str(_agent_final)[:200])"
  ];
}
function emitLitellmAgentPerRowPython(opts) {
  const serversPy = JSON.stringify(
    opts.mcpServers.map((s, idx) => {
      const resolved = s._resolved ?? s;
      const cfg = JSON.parse(resolvedServerToPythonCfg(resolved));
      const wrapperName = s.name;
      if (wrapperName) cfg.name = wrapperName;
      else if (!cfg.name || cfg.name === "mcp") cfg.name = resolved.name ?? `mcp_${idx}`;
      return cfg;
    })
  );
  return [
    `# \u2500\u2500 litellm_agent (per-row): ${opts.label} \u2500\u2500`,
    "import pandas as pd",
    "try:",
    "    import litellm",
    "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
    "    _sql = _dest_client.sql_client()",
    `    _df = pd.read_sql('SELECT * FROM ${escapePyString(opts.table)}', _sql._engine)`,
    `    _prompt_col = ${JSON.stringify(opts.promptColumn)}`,
    `    _out_col = ${JSON.stringify(opts.outputColumn)}`,
    "    _agent_servers = " + serversPy,
    "    _agent_tools = _eltpulse_mcp_tools_for_litellm(_agent_servers)",
    opts.apiKeyEnv ? `    _agent_api_key = os.environ.get(${JSON.stringify(opts.apiKeyEnv)})` : "    _agent_api_key = None",
    "    _agent_system = " + JSON.stringify(opts.systemPrompt ?? ""),
    opts.promptPrefix ? `    _agent_prefix = ${JSON.stringify(opts.promptPrefix)}` : "    _agent_prefix = None",
    "    _out_vals = []",
    "    for _, _row in _df.iterrows():",
    "        _text = str(_row[_prompt_col])",
    "        _user = f'{_agent_prefix}\\n\\n{_text}' if _agent_prefix else _text",
    "        _out_vals.append(_eltpulse_run_litellm_agent(_user, _agent_system, " + JSON.stringify(opts.model) + ", _agent_api_key, " + String(opts.maxIterations) + ", _agent_servers, _agent_tools))",
    "    _df[_out_col] = _out_vals",
    ...warehouseWriteLines(opts.outputTable).map((l) => "    " + l.trim()),
    "except Exception as _agent_row_err:",
    '    print(f"[litellm_agent] per-row warning: {_agent_row_err}")'
  ].filter(Boolean);
}
function warehouseWriteLines(outputTable) {
  const outSchema = outputTable.includes(".") ? outputTable.split(".")[0] : "public";
  const outName = outputTable.includes(".") ? outputTable.split(".").pop() : outputTable;
  return [
    `    _out_schema = ${JSON.stringify(outSchema)}`,
    `    _out_name = ${JSON.stringify(outName)}`,
    "    _df.to_sql(_out_name, _sql._engine, schema=_out_schema, if_exists='replace', index=False)"
  ];
}

// web/lib/elt/native-components/definitions/litellm-agent.ts
function agentMcpServers(config) {
  if (Array.isArray(config._resolved_mcp_servers)) {
    return config._resolved_mcp_servers;
  }
  const one = config._resolved_mcp_server;
  if (one && typeof one === "object") return [{ name: "mcp", _resolved: one }];
  return [];
}
function compileAgent(config, defaultModel) {
  const table = String(config.table ?? config.upstream_asset_key ?? "").trim();
  const outputTable = String(config.output_table ?? config.asset_name ?? "").trim();
  const promptColumn = String(config.prompt_column ?? config.text_column ?? "").trim();
  const outputColumn = String(config.output_column ?? "agent_output").trim();
  const prompt = String(config.prompt ?? config.user_prompt ?? "").trim();
  const promptPrefix = String(config.prompt_prefix ?? "").trim() || void 0;
  const model = String(config.model ?? defaultModel).trim();
  const maxIterations = Number(config.max_iterations ?? 10);
  const systemPrompt = String(config.system_prompt ?? "").trim() || void 0;
  const apiKeyEnv = String(config.api_key_env_var ?? config.api_key_env ?? "").trim() || void 0;
  const label = String(config.asset_name ?? config.label ?? (table || "agent")).trim();
  const mcpServers = agentMcpServers(config);
  const preamble = takeMcpPythonPreamble();
  if (table && outputTable) {
    if (!promptColumn) {
      return {
        warnings: ["litellm_agent: prompt_column is required when table + output_table are set (per-row mode)"],
        python: []
      };
    }
    return {
      python: [
        ...preamble,
        ...emitLitellmAgentPerRowPython({
          label,
          table,
          promptColumn,
          outputColumn,
          promptPrefix,
          systemPrompt,
          model,
          apiKeyEnv,
          maxIterations: Number.isFinite(maxIterations) ? maxIterations : 10,
          mcpServers,
          outputTable
        })
      ]
    };
  }
  if (!prompt) {
    return {
      warnings: [
        "litellm_agent: prompt is required for single-shot mode, or set table + prompt_column + output_table for per-row mode"
      ],
      python: []
    };
  }
  return {
    python: [
      ...preamble,
      ...emitLitellmAgentPython({
        label,
        prompt,
        systemPrompt,
        model,
        apiKeyEnv,
        maxIterations: Number.isFinite(maxIterations) ? maxIterations : 10,
        mcpServers
      })
    ]
  };
}
var litellmAgentComponent = {
  id: "litellm_agent",
  aliases: ["openai_agent", "anthropic_agent", "gemini_agent", "snowflake_cortex_agent"],
  name: "LLM agent (MCP)",
  category: "ai",
  description: "LiteLLM agent with optional MCP tools \u2014 single prompt or per-row over a table (prompt_column \u2192 output_column).",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Input table", type: "string", description: "Set with output_table for per-row agent mode" },
    { key: "prompt_column", label: "Prompt column", type: "string", description: "Per-row user message source column" },
    { key: "prompt_prefix", label: "Prompt prefix", type: "text", description: "Prepended to each row prompt in per-row mode" },
    { key: "prompt", label: "User prompt", type: "text", description: "Single-shot mode \u2014 omit when using table + prompt_column" },
    { key: "system_prompt", label: "System prompt", type: "text" },
    { key: "model", label: "Model", type: "string", default: "gpt-4o-mini" },
    { key: "api_key_env_var", label: "API key env var", type: "string", placeholder: "OPENAI_API_KEY" },
    { key: "max_iterations", label: "Max tool iterations", type: "number", default: 10 },
    { key: "mcp_server_ids", label: "MCP server ids", type: "string_list" },
    { key: "output_column", label: "Output column", type: "string", default: "agent_output" },
    { key: "output_table", label: "Output table", type: "string", description: "Required for per-row mode" }
  ],
  compile: (config) => compileAgent(config, "gpt-4o-mini")
};

// ../../../../../tmp/eltpulse-compile-EyK14Q/litellm_agent.ts
function compile(config) {
  return litellmAgentComponent.compile(config);
}
export {
  compile
};
