-- Observability alert rules + workflow DAGs
CREATE TABLE IF NOT EXISTS "ObservabilityAlertRule" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "metric" TEXT NOT NULL,
  "operator" TEXT NOT NULL DEFAULT 'lt',
  "threshold" DOUBLE PRECISION NOT NULL,
  "window_days" INTEGER NOT NULL DEFAULT 7,
  "pipeline_id" TEXT,
  "notify_webhook" BOOLEAN NOT NULL DEFAULT true,
  "last_triggered_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ObservabilityAlertRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EltWorkflow" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "description" TEXT,
  "definition" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EltWorkflow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EltWorkflow_user_id_name_key" ON "EltWorkflow"("user_id", "name");
CREATE INDEX IF NOT EXISTS "ObservabilityAlertRule_user_id_idx" ON "ObservabilityAlertRule"("user_id");
CREATE INDEX IF NOT EXISTS "ObservabilityAlertRule_pipeline_id_idx" ON "ObservabilityAlertRule"("pipeline_id");
CREATE INDEX IF NOT EXISTS "EltWorkflow_user_id_idx" ON "EltWorkflow"("user_id");

DO $$ BEGIN
  ALTER TABLE "ObservabilityAlertRule"
    ADD CONSTRAINT "ObservabilityAlertRule_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "EltWorkflow"
    ADD CONSTRAINT "EltWorkflow_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
