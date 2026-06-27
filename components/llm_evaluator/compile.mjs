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
function emitLlmEvaluatorPython(opts) {
  return [
    `# \u2500\u2500 llm_evaluator: ${opts.label} \u2500\u2500`,
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
    '    print(f"[llm_evaluator] warning: {_eval_err}")'
  ];
}

// web/lib/elt/native-components/definitions/llm-evaluator.ts
var llmEvaluatorComponent = {
  id: "llm_evaluator",
  name: "LLM evaluator (judge)",
  category: "ai",
  description: "LLM-as-judge scores upstream agent/LLM output (answer relevance, groundedness, etc.).",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Input table", type: "string", required: true },
    { key: "input_column", label: "Answer column", type: "string", required: true },
    { key: "reference_column", label: "Reference column", type: "string" },
    {
      key: "feedback",
      label: "Feedback metric",
      type: "select",
      options: ["answer_relevance", "groundedness", "helpfulness", "coherence", "harmfulness"],
      default: "answer_relevance"
    },
    { key: "model", label: "Judge model", type: "string", default: "gpt-4o-mini" },
    { key: "output_table", label: "Output table", type: "string", required: true }
  ],
  compile(config) {
    const table = String(config.table ?? config.upstream_asset_key ?? "").trim();
    const outputTable = String(config.output_table ?? config.asset_name ?? "").trim();
    const inputColumn = String(config.input_column ?? "answer").trim();
    const feedback = String(config.feedback ?? "answer_relevance").trim();
    const model = String(config.model ?? "gpt-4o-mini").trim();
    if (!table || !outputTable) {
      return { warnings: ["llm_evaluator: table and output_table required"], python: [] };
    }
    return {
      python: emitLlmEvaluatorPython({
        label: feedback,
        table,
        inputColumn,
        referenceColumn: String(config.reference_column ?? "").trim() || void 0,
        feedback,
        model,
        outputTable
      })
    };
  }
};

// ../../../../../tmp/eltpulse-compile-EyK14Q/llm_evaluator.ts
function compile(config) {
  return llmEvaluatorComponent.compile(config);
}
export {
  compile
};
