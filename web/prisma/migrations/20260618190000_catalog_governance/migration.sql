-- Data products, data contracts, asset conversations

ALTER TABLE "CatalogCollection" ADD COLUMN IF NOT EXISTS "owner_name" TEXT;
ALTER TABLE "CatalogCollection" ADD COLUMN IF NOT EXISTS "domain" TEXT;
ALTER TABLE "CatalogCollection" ADD COLUMN IF NOT EXISTS "consumer_tags" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "CatalogCollection" ADD COLUMN IF NOT EXISTS "contract_id" TEXT;

CREATE TABLE IF NOT EXISTS "DataContract" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "owner_name" TEXT,
    "owner_email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "freshness_sla_hours" INTEGER,
    "schema_spec" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DataContract_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DataContract_user_id_slug_key" ON "DataContract"("user_id", "slug");
CREATE INDEX IF NOT EXISTS "DataContract_user_id_idx" ON "DataContract"("user_id");

ALTER TABLE "DataContract" ADD CONSTRAINT "DataContract_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "DataContractAsset" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "asset_key" TEXT NOT NULL,
    CONSTRAINT "DataContractAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DataContractAsset_contract_id_asset_key_key" ON "DataContractAsset"("contract_id", "asset_key");
CREATE INDEX IF NOT EXISTS "DataContractAsset_contract_id_idx" ON "DataContractAsset"("contract_id");
CREATE INDEX IF NOT EXISTS "DataContractAsset_asset_key_idx" ON "DataContractAsset"("asset_key");

ALTER TABLE "DataContractAsset" ADD CONSTRAINT "DataContractAsset_contract_id_fkey"
    FOREIGN KEY ("contract_id") REFERENCES "DataContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "CatalogAssetComment" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "asset_key" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "author_name" TEXT,
    "author_email" TEXT,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CatalogAssetComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CatalogAssetComment_asset_key_created_at_idx" ON "CatalogAssetComment"("asset_key", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "CatalogAssetComment_user_id_idx" ON "CatalogAssetComment"("user_id");

ALTER TABLE "CatalogAssetComment" ADD CONSTRAINT "CatalogAssetComment_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CatalogAssetComment" ADD CONSTRAINT "CatalogAssetComment_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "CatalogAssetComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CatalogCollection" ADD CONSTRAINT "CatalogCollection_contract_id_fkey"
    FOREIGN KEY ("contract_id") REFERENCES "DataContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "CatalogCollection_contract_id_idx" ON "CatalogCollection"("contract_id");
