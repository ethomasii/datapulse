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
function emitMcpToolCallPython(opts) {
  const serverPy = resolvedServerToPythonCfg(opts.server);
  const argsPy = JSON.stringify(opts.toolArgs ?? {});
  const lines = [
    `# \u2500\u2500 mcp_tool_call: ${opts.label} \u2500\u2500`,
    "_mcp_server_cfg = " + serverPy,
    "_mcp_args = " + argsPy,
    "_mcp_subs = {'run_id': getattr(pipeline, 'run_id', '')}",
    "_mcp_res = asyncio.run(_eltpulse_mcp_call_tool(_mcp_server_cfg, " + JSON.stringify(opts.toolName) + ", _eltpulse_substitute_args(_mcp_args, _mcp_subs), " + JSON.stringify(opts.parseAs) + "))",
    "print(f'[mcp_tool_call] {opts.label}: ok')"
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

// web/lib/elt/native-components/definitions/mcp-tool-call.ts
function resolvedServer(config) {
  const r = config._resolved_mcp_server;
  if (r && typeof r === "object") return r;
  return null;
}
var mcpToolCallComponent = {
  id: "mcp_tool_call",
  name: "MCP tool call",
  category: "ai",
  description: "Deterministic single-shot MCP tool call \u2014 ingest tool result as a table (no LLM).",
  compileTarget: "python",
  fields: [
    { key: "mcp_server_id", label: "MCP server", type: "string", description: "Workspace MCP server id" },
    { key: "tool_name", label: "Tool name", type: "string", required: true },
    { key: "tool_args", label: "Tool args (JSON)", type: "text" },
    { key: "parse_as", label: "Parse as", type: "select", options: ["auto", "json", "text"], default: "auto" },
    { key: "output_table", label: "Output table", type: "string", required: true },
    { key: "asset_name", label: "Asset name", type: "string" }
  ],
  compile(config) {
    const server = resolvedServer(config);
    if (!server) {
      return { warnings: ["mcp_tool_call: mcp_server_id or inline server required"], python: [] };
    }
    const toolName = String(config.tool_name ?? "").trim();
    if (!toolName) {
      return { warnings: ["mcp_tool_call: tool_name is required"], python: [] };
    }
    let toolArgs = {};
    const rawArgs = config.tool_args;
    if (typeof rawArgs === "string" && rawArgs.trim()) {
      try {
        toolArgs = JSON.parse(rawArgs);
      } catch {
        return { warnings: ["mcp_tool_call: tool_args must be valid JSON"], python: [] };
      }
    } else if (rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)) {
      toolArgs = rawArgs;
    }
    const outputTable = String(config.output_table ?? config.asset_name ?? "staging.mcp_result").trim();
    const parseAs = String(config.parse_as ?? "auto").trim() || "auto";
    return {
      python: [
        ...takeMcpPythonPreamble(),
        ...emitMcpToolCallPython({
          label: toolName,
          server,
          toolName,
          toolArgs,
          parseAs,
          outputTable
        })
      ],
      configPatch: {
        elt_mcp_ingestion: true,
        resource_name: outputTable.split(".").pop() ?? outputTable
      }
    };
  }
};

// ../../../../../tmp/eltpulse-compile-EyK14Q/mcp_tool_call.ts
function compile(config) {
  return mcpToolCallComponent.compile(config);
}
export {
  compile
};
