-- Add eltpulse_managed to enums and migrate rows from datapulse_managed (if present).
-- Safe to run once; IF branches avoid duplicate enum value errors.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ExecutionPlane' AND e.enumlabel = 'eltpulse_managed'
  ) THEN
    ALTER TYPE "ExecutionPlane" ADD VALUE 'eltpulse_managed';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'RunIngestionExecutor' AND e.enumlabel = 'eltpulse_managed'
  ) THEN
    ALTER TYPE "RunIngestionExecutor" ADD VALUE 'eltpulse_managed';
  END IF;
END $$;

UPDATE "User" SET "execution_plane" = 'eltpulse_managed'::"ExecutionPlane"
WHERE "execution_plane"::text = 'datapulse_managed';

UPDATE "EltPipelineRun" SET "ingestion_executor" = 'eltpulse_managed'::"RunIngestionExecutor"
WHERE "ingestion_executor"::text = 'datapulse_managed';

UPDATE "User" SET "agent_last_seen_source" = 'eltpulse_managed'
WHERE "agent_last_seen_source" = 'datapulse_managed';
