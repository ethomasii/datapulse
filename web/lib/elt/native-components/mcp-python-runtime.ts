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
