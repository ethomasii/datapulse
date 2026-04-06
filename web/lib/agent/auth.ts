/**
 * Resolves the User record from an agent Bearer token.
 * Used by all /api/agent/* routes — no Clerk session required.
 */
import { db } from "@/lib/db/client";

export async function getUserFromAgentToken(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  return db.user.findUnique({ where: { agentToken: token } });
}
