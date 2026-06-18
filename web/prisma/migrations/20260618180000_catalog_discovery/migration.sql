-- Catalog discovery: recently viewed, collections, glossary, certified assets

ALTER TABLE "CatalogEntry" ADD COLUMN IF NOT EXISTS "certified_at" TIMESTAMP(3);
ALTER TABLE "CatalogEntry" ADD COLUMN IF NOT EXISTS "certified_by_id" TEXT;

CREATE TABLE IF NOT EXISTS "CatalogAssetView" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "asset_key" TEXT NOT NULL,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CatalogAssetView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CatalogAssetView_user_id_asset_key_key" ON "CatalogAssetView"("user_id", "asset_key");
CREATE INDEX IF NOT EXISTS "CatalogAssetView_user_id_viewed_at_idx" ON "CatalogAssetView"("user_id", "viewed_at" DESC);

ALTER TABLE "CatalogAssetView" ADD CONSTRAINT "CatalogAssetView_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "CatalogCollection" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CatalogCollection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CatalogCollection_user_id_slug_key" ON "CatalogCollection"("user_id", "slug");
CREATE INDEX IF NOT EXISTS "CatalogCollection_user_id_idx" ON "CatalogCollection"("user_id");

ALTER TABLE "CatalogCollection" ADD CONSTRAINT "CatalogCollection_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "CatalogCollectionItem" (
    "id" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,
    "asset_key" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CatalogCollectionItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CatalogCollectionItem_collection_id_asset_key_key" ON "CatalogCollectionItem"("collection_id", "asset_key");
CREATE INDEX IF NOT EXISTS "CatalogCollectionItem_collection_id_idx" ON "CatalogCollectionItem"("collection_id");

ALTER TABLE "CatalogCollectionItem" ADD CONSTRAINT "CatalogCollectionItem_collection_id_fkey"
    FOREIGN KEY ("collection_id") REFERENCES "CatalogCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "GlossaryTerm" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "aliases" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GlossaryTerm_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GlossaryTerm_user_id_term_key" ON "GlossaryTerm"("user_id", "term");
CREATE INDEX IF NOT EXISTS "GlossaryTerm_user_id_idx" ON "GlossaryTerm"("user_id");

ALTER TABLE "GlossaryTerm" ADD CONSTRAINT "GlossaryTerm_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "GlossaryTermLink" (
    "id" TEXT NOT NULL,
    "term_id" TEXT NOT NULL,
    "asset_key" TEXT NOT NULL,
    "column_name" TEXT,
    CONSTRAINT "GlossaryTermLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GlossaryTermLink_term_id_asset_key_column_name_key" ON "GlossaryTermLink"("term_id", "asset_key", "column_name");
CREATE INDEX IF NOT EXISTS "GlossaryTermLink_term_id_idx" ON "GlossaryTermLink"("term_id");
CREATE INDEX IF NOT EXISTS "GlossaryTermLink_asset_key_idx" ON "GlossaryTermLink"("asset_key");

ALTER TABLE "GlossaryTermLink" ADD CONSTRAINT "GlossaryTermLink_term_id_fkey"
    FOREIGN KEY ("term_id") REFERENCES "GlossaryTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
