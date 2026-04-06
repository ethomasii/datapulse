-- One-time fix if Prisma reports missing runsWebhookUrl (P2022).
-- Preferred: from `web/`, run `npm run db:push` with DATABASE_URL set.
-- Safe to re-run on Postgres 11+ (IF NOT EXISTS).

ALTER TABLE "EltPipeline" ADD COLUMN IF NOT EXISTS "runsWebhookUrl" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "runsWebhookUrl" TEXT;
