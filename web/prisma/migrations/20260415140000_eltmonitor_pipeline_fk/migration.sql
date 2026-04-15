-- Monitors reference pipelines by stable id so renames do not break orchestration.

ALTER TABLE "EltMonitor" ADD COLUMN "pipeline_id" TEXT;

UPDATE "EltMonitor" AS m
SET "pipeline_id" = p.id
FROM "EltPipeline" AS p
WHERE p."userId" = m."userId" AND p.name = m."pipelineName";

DELETE FROM "EltMonitor" WHERE "pipeline_id" IS NULL;

ALTER TABLE "EltMonitor" DROP COLUMN "pipelineName";

ALTER TABLE "EltMonitor" ALTER COLUMN "pipeline_id" SET NOT NULL;

ALTER TABLE "EltMonitor" ADD CONSTRAINT "EltMonitor_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "EltPipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "EltMonitor_pipeline_id_idx" ON "EltMonitor"("pipeline_id");
