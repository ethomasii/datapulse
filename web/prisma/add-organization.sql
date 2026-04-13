-- Organization workspace + org-level agent token. Use `prisma db push` or apply manually.

CREATE TABLE IF NOT EXISTS "Organization" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "clerk_org_id" TEXT,
  "owner_user_id" TEXT NOT NULL,
  "agent_token" TEXT,
  "sensor_poll_interval_seconds_override" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Organization_clerk_org_id_key" ON "Organization"("clerk_org_id");
CREATE UNIQUE INDEX IF NOT EXISTS "Organization_owner_user_id_key" ON "Organization"("owner_user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "Organization_agent_token_key" ON "Organization"("agent_token");
CREATE INDEX IF NOT EXISTS "Organization_owner_user_id_idx" ON "Organization"("owner_user_id");

DO $$ BEGIN
  ALTER TABLE "Organization" ADD CONSTRAINT "Organization_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;
CREATE INDEX IF NOT EXISTS "User_organization_id_idx" ON "User"("organization_id");

DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
