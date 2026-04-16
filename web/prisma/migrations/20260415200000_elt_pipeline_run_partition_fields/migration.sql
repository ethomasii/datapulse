-- Structured slice fields for agents and UI (alongside triggeredBy).
ALTER TABLE "EltPipelineRun" ADD COLUMN "partition_value" TEXT;
ALTER TABLE "EltPipelineRun" ADD COLUMN "partition_column" TEXT;
