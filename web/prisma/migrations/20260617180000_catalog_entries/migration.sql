-- Workspace catalog metadata (descriptions, tags) keyed by stable asset id.
CREATE TABLE "CatalogEntry" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "asset_key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "display_name" TEXT,
    "description" TEXT,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "pipeline_id" TEXT,
    "imported_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CatalogEntry_user_id_asset_key_key" ON "CatalogEntry"("user_id", "asset_key");
CREATE INDEX "CatalogEntry_user_id_idx" ON "CatalogEntry"("user_id");
CREATE INDEX "CatalogEntry_pipeline_id_idx" ON "CatalogEntry"("pipeline_id");

ALTER TABLE "CatalogEntry" ADD CONSTRAINT "CatalogEntry_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
