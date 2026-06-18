-- Workspace default destination + declarative pipeline spec storage
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "default_destination_connection_id" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "default_destination_connection_id" TEXT;
ALTER TABLE "EltPipeline" ADD COLUMN IF NOT EXISTS "declarative_spec_yaml" TEXT;

CREATE INDEX IF NOT EXISTS "User_default_destination_connection_id_idx"
  ON "User"("default_destination_connection_id");
CREATE INDEX IF NOT EXISTS "Organization_default_destination_connection_id_idx"
  ON "Organization"("default_destination_connection_id");

DO $$ BEGIN
  ALTER TABLE "User"
    ADD CONSTRAINT "User_default_destination_connection_id_fkey"
    FOREIGN KEY ("default_destination_connection_id") REFERENCES "Connection"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Organization"
    ADD CONSTRAINT "Organization_default_destination_connection_id_fkey"
    FOREIGN KEY ("default_destination_connection_id") REFERENCES "Connection"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
