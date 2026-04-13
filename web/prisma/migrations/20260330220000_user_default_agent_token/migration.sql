-- Optional: which named gateway receives unrouted runs (no pipeline default / explicit override).

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "default_agent_token_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'User_default_agent_token_id_fkey'
  ) THEN
    ALTER TABLE "User"
      ADD CONSTRAINT "User_default_agent_token_id_fkey"
      FOREIGN KEY ("default_agent_token_id") REFERENCES "AgentToken"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "User_default_agent_token_id_idx" ON "User"("default_agent_token_id");

-- Backfill: single active token per user becomes the account default.
UPDATE "User" u
SET "default_agent_token_id" = t.id
FROM "AgentToken" t
WHERE t.user_id = u.id
  AND t.revoked_at IS NULL
  AND u.default_agent_token_id IS NULL
  AND (
    SELECT COUNT(*)::int FROM "AgentToken" x WHERE x.user_id = u.id AND x.revoked_at IS NULL
  ) = 1;
