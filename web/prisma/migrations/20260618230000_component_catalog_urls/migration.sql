-- Workspace-level BYO component catalog URLs (org or solo user)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "component_catalog_urls" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "component_catalog_urls" JSONB NOT NULL DEFAULT '[]';
