import { mcpHealthResponse } from "@eltpulse/mcp-server/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return mcpHealthResponse();
}
