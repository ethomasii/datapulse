import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";

export type GithubConnectionSummary = {
  githubLogin: string;
  defaultRepoOwner: string | null;
  defaultRepoName: string | null;
  defaultBranch: string | null;
};

function isMissingGithubTableError(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    // Table does not exist (schema not pushed / migrated)
    if (e.code === "P2021") return true;
    if (e.message.includes("does not exist")) return true;
  }
  return false;
}

export type GithubConnectionQueryResult = {
  row: GithubConnectionSummary | null;
  /** True when the DB has no GithubConnection table — run `npm run db:push` from `web/`. */
  githubTableMissing: boolean;
};

/**
 * Optional GitHub BYO row. Tolerates a missing DB table (returns null + flag) and a stale Prisma bundle
 * (falls back to raw SQL when the delegate is absent).
 */
export async function getGithubConnectionForUser(userId: string): Promise<GithubConnectionQueryResult> {
  const delegate = (
    db as unknown as {
      githubConnection?: {
        findUnique: (args: {
          where: { userId: string };
          select: {
            githubLogin: true;
            defaultRepoOwner: true;
            defaultRepoName: true;
            defaultBranch: true;
          };
        }) => Promise<GithubConnectionSummary | null>;
      };
    }
  ).githubConnection;

  if (delegate?.findUnique) {
    try {
      const row = await delegate.findUnique({
        where: { userId },
        select: {
          githubLogin: true,
          defaultRepoOwner: true,
          defaultRepoName: true,
          defaultBranch: true,
        },
      });
      return { row, githubTableMissing: false };
    } catch (e) {
      if (!isMissingGithubTableError(e)) throw e;
      return { row: null, githubTableMissing: true };
    }
  }

  try {
    const rows = await db.$queryRaw<GithubConnectionSummary[]>`
      SELECT "githubLogin", "defaultRepoOwner", "defaultRepoName", "defaultBranch"
      FROM "GithubConnection"
      WHERE "userId" = ${userId}
      LIMIT 1
    `;
    return { row: rows[0] ?? null, githubTableMissing: false };
  } catch {
    return { row: null, githubTableMissing: true };
  }
}

export function formatDefaultRepoLabel(row: GithubConnectionSummary | null): string | null {
  if (!row) return null;
  const { defaultRepoOwner, defaultRepoName, defaultBranch } = row;
  if (!defaultRepoOwner || !defaultRepoName) return null;
  return `${defaultRepoOwner}/${defaultRepoName}${defaultBranch ? `@${defaultBranch}` : ""}`;
}
