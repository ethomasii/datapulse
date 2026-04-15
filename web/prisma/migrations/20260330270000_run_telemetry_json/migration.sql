-- Time-series + rollup telemetry for runs (rows/bytes/progress); PATCH from gateway or managed workers.
ALTER TABLE "EltPipelineRun" ADD COLUMN IF NOT EXISTS "telemetry" JSONB NOT NULL DEFAULT '{}'::jsonb;
