import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db/client";

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const raw = `elt_${randomBytes(32).toString("hex")}`;
  return { raw, prefix: raw.slice(0, 12), hash: hashApiKey(raw) };
}

/**
 * Resolve workspace API key from Authorization: Bearer elt_...
 */
export async function getUserFromWorkspaceApiKey(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token.startsWith("elt_")) return null;

  const keyHash = hashApiKey(token);
  const row = await db.workspaceApiKey.findUnique({
    where: { keyHash },
    include: { user: { include: { subscription: true } } },
  });
  if (!row || row.revokedAt) return null;

  void db.workspaceApiKey
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { user: row.user, scopes: row.scopes, keyId: row.id };
}
