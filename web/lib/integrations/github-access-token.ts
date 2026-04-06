import { db } from "@/lib/db/client";
import { decryptSecret } from "@/lib/crypto/token-encryption";

/** For server-side GitHub API calls (e.g. committing pipeline files). Returns null if not connected. */
export async function getGithubAccessTokenForUser(userId: string): Promise<string | null> {
  const row = await db.githubConnection.findUnique({ where: { userId } });
  if (!row) return null;
  try {
    return decryptSecret(row.accessTokenEnc);
  } catch {
    return null;
  }
}
