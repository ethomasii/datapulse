-- Rename previous column name to match eltPulse workspace manifest — no Dagster involvement.
-- Run once against existing databases before `prisma generate` / deploy, if the old column exists.
ALTER TABLE "EltPipeline" RENAME COLUMN "dagsterYaml" TO "workspace_yaml";
