-- Workspace audit log (Account → Audit log)
CREATE TABLE IF NOT EXISTS "workspace_audit_event" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "actor_email" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_audit_event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "workspace_audit_event_user_id_created_at_idx"
    ON "workspace_audit_event"("user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "workspace_audit_event_organization_id_created_at_idx"
    ON "workspace_audit_event"("organization_id", "created_at" DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspace_audit_event_user_id_fkey'
  ) THEN
    ALTER TABLE "workspace_audit_event"
      ADD CONSTRAINT "workspace_audit_event_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
