-- Persist agent heartbeats (Neon). Prefer `prisma db push`.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "agent_last_seen_at" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "agent_last_seen_version" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "agent_last_seen_labels" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "agent_last_seen_source" TEXT;
