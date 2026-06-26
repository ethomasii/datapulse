# eltPulse MCP server

Hosted Model Context Protocol adapter for eltPulse — same pattern as ServicePulse `mcp.servicepulse.dev`.

## Production

- **URL:** `https://mcp.eltpulse.dev` (subdomain on the main Vercel project)
- **Auth:** `Authorization: Bearer elt_…` (workspace API key from Account → Developers)
- **Transport:** Streamable HTTP + SSE (`@modelcontextprotocol/sdk`)

Middleware rewrites `mcp.eltpulse.dev/` → `/api/mcp`. Set `MCP_HOSTS` if using a custom hostname.

## Local stdio (Cursor)

```bash
cd integrations/mcp-server
npm install && npm run build
ELTPULSE_API_TOKEN=elt_... ELTPULSE_API_BASE_URL=http://localhost:3000 node dist/index.js
```

## Tools

- `eltpulse_api_discovery`
- `eltpulse_list_pipelines` / `eltpulse_get_pipeline`
- `eltpulse_list_runs` / `eltpulse_trigger_run`
- `eltpulse_list_connections` / `eltpulse_workspace_defaults`
- `eltpulse_list_mcp_servers`
