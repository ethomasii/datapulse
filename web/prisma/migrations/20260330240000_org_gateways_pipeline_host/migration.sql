-- Org-scoped gateway tokens + per-pipeline execution host (managed vs customer gateway).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t WHERE t.typname = 'PipelineExecutionHost'
  ) THEN
    CREATE TYPE "PipelineExecutionHost" AS ENUM ('inherit', 'eltpulse_managed', 'customer_gateway');
  END IF;
END $$;

ALTER TABLE "EltPipeline" ADD COLUMN IF NOT EXISTS "execution_host" "PipelineExecutionHost" NOT NULL DEFAULT 'inherit';

ALTER TABLE "AgentToken" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;

ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "default_agent_token_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AgentToken_organization_id_fkey'
  ) THEN
    ALTER TABLE "AgentToken"
      ADD CONSTRAINT "AgentToken_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "Organization"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Organization_default_agent_token_id_fkey'
  ) THEN
    ALTER TABLE "Organization"
      ADD CONSTRAINT "Organization_default_agent_token_id_fkey"
      FOREIGN KEY ("default_agent_token_id") REFERENCES "AgentToken"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Organization_default_agent_token_id_key" ON "Organization"("default_agent_token_id");

CREATE INDEX IF NOT EXISTS "AgentToken_organization_id_idx" ON "AgentToken"("organization_id");
