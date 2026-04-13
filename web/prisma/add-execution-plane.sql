-- Account preference: who runs ingestion (BYO agent vs eltPulse-managed when available).
DO $$ BEGIN
  CREATE TYPE "ExecutionPlane" AS ENUM ('customer_agent', 'datapulse_managed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "execution_plane" "ExecutionPlane" NOT NULL DEFAULT 'customer_agent';

-- Who reported telemetry / executed ingestion for this run (same EltPipelineRun rows either way).
DO $$ BEGIN
  CREATE TYPE "RunIngestionExecutor" AS ENUM (
    'unspecified',
    'customer_agent',
    'datapulse_managed',
    'customer_control_plane'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "EltPipelineRun" ADD COLUMN IF NOT EXISTS "ingestion_executor" "RunIngestionExecutor" NOT NULL DEFAULT 'unspecified';
