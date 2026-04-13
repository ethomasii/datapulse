-- Backfill legacy `datapulse_managed` rows to `eltpulse_managed` (transaction-safe).
-- Requires `eltpulse_managed` on the PostgreSQL enums (see migration 20260330180000).

UPDATE "User" SET "execution_plane" = 'eltpulse_managed'::"ExecutionPlane"
WHERE "execution_plane"::text = 'datapulse_managed';

UPDATE "EltPipelineRun" SET "ingestion_executor" = 'eltpulse_managed'::"RunIngestionExecutor"
WHERE "ingestion_executor"::text = 'datapulse_managed';

UPDATE "User" SET "agent_last_seen_source" = 'eltpulse_managed'
WHERE "agent_last_seen_source" = 'datapulse_managed';
