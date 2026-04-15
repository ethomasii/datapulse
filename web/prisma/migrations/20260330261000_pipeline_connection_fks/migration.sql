-- Optional FKs from EltPipeline to Connection (same pattern as EltMonitor.connectionId).
ALTER TABLE "EltPipeline" ADD COLUMN IF NOT EXISTS "source_connection_id" TEXT;
ALTER TABLE "EltPipeline" ADD COLUMN IF NOT EXISTS "destination_connection_id" TEXT;

CREATE INDEX IF NOT EXISTS "EltPipeline_source_connection_id_idx" ON "EltPipeline"("source_connection_id");
CREATE INDEX IF NOT EXISTS "EltPipeline_destination_connection_id_idx" ON "EltPipeline"("destination_connection_id");

ALTER TABLE "EltPipeline" DROP CONSTRAINT IF EXISTS "EltPipeline_source_connection_id_fkey";
ALTER TABLE "EltPipeline" DROP CONSTRAINT IF EXISTS "EltPipeline_destination_connection_id_fkey";

ALTER TABLE "EltPipeline"
  ADD CONSTRAINT "EltPipeline_source_connection_id_fkey"
  FOREIGN KEY ("source_connection_id") REFERENCES "Connection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EltPipeline"
  ADD CONSTRAINT "EltPipeline_destination_connection_id_fkey"
  FOREIGN KEY ("destination_connection_id") REFERENCES "Connection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
