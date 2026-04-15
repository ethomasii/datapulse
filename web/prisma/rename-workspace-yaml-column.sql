-- Rename legacy column to eltPulse workspace manifest naming.
-- Run once against existing databases before `prisma generate` / deploy, if the old column exists.
ALTER TABLE "EltPipeline" RENAME COLUMN "dagsterYaml" TO "workspace_yaml";
