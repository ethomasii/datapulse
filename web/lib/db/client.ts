import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

/**
 * Next keeps a global Prisma singleton across HMR / long-lived workers. After `prisma generate` adds
 * models (e.g. GithubConnection), the cached client can lack new delegates — `db.githubConnection`
 * becomes undefined. Recreate when we detect a missing delegate.
 */
function getPrismaClient(): PrismaClient {
  const cached = globalForPrisma.prisma;
  const hasGithubDelegate =
    cached &&
    typeof (cached as unknown as { githubConnection?: { findUnique: unknown } }).githubConnection
      ?.findUnique === "function";

  if (cached && hasGithubDelegate) {
    return cached;
  }

  if (cached) {
    void cached.$disconnect();
  }

  const fresh = createPrismaClient();
  globalForPrisma.prisma = fresh;
  return fresh;
}

export const db = getPrismaClient();
