import { handleMcpRoute } from "@eltpulse/mcp-server/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  return handleMcpRoute(request);
}

export async function POST(request: Request) {
  return handleMcpRoute(request);
}

export async function DELETE(request: Request) {
  return handleMcpRoute(request);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Authorization, Content-Type, MCP-Protocol-Version, mcp-session-id",
    },
  });
}
