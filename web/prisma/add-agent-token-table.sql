-- Named agent connectors (multiple Bearer tokens per user). Prefer `prisma db push`.

CREATE TABLE IF NOT EXISTS "AgentToken" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "last_seen_at" TIMESTAMP(3),
  "last_seen_version" TEXT,
  "last_seen_labels" JSONB NOT NULL DEFAULT '{}',
  "last_seen_source" TEXT,
  "revoked_at" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AgentToken_token_key" ON "AgentToken"("token");
CREATE INDEX IF NOT EXISTS "AgentToken_user_id_idx" ON "AgentToken"("user_id");

DO $$ BEGIN
  ALTER TABLE "AgentToken" ADD CONSTRAINT "AgentToken_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
