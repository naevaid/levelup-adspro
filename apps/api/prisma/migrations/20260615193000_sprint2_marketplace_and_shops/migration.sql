CREATE TYPE "MarketplaceCode" AS ENUM ('SHOPEE', 'TIKTOK_SHOP');
CREATE TYPE "ShopStatus" AS ENUM ('ACTIVE', 'DISCONNECTED', 'SUSPENDED');

CREATE TABLE "marketplaces" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" "MarketplaceCode" NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "marketplaces_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shops" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "marketplace_id" UUID NOT NULL,
  "external_id" TEXT NOT NULL,
  "name" TEXT,
  "status" "ShopStatus" NOT NULL DEFAULT 'ACTIVE',
  "metadata_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shops_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketplaces_code_key" ON "marketplaces"("code");
CREATE UNIQUE INDEX "shops_organization_id_marketplace_id_external_id_key" ON "shops"("organization_id", "marketplace_id", "external_id");

CREATE INDEX "shops_organization_id_idx" ON "shops"("organization_id");
CREATE INDEX "shops_marketplace_id_idx" ON "shops"("marketplace_id");

ALTER TABLE "shops"
  ADD CONSTRAINT "shops_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shops"
  ADD CONSTRAINT "shops_marketplace_id_fkey"
  FOREIGN KEY ("marketplace_id") REFERENCES "marketplaces"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
