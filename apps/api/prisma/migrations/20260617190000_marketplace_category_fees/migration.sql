CREATE TYPE "CategoryFeeStoreType" AS ENUM ('NON_STAR', 'STAR', 'MALL');

CREATE TABLE "marketplace_category_fees" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "marketplace_id" UUID NOT NULL,
  "store_type" "CategoryFeeStoreType" NOT NULL,
  "primary_category" TEXT NOT NULL,
  "secondary_category" TEXT,
  "category_name" TEXT NOT NULL,
  "fee_percent" DOUBLE PRECISION NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "marketplace_category_fees_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mcf_org_market_store_cat_unique"
  ON "marketplace_category_fees"(
    "organization_id",
    "marketplace_id",
    "store_type",
    "primary_category",
    "secondary_category",
    "category_name"
  );

CREATE INDEX "mcf_org_market_store_active_idx"
  ON "marketplace_category_fees"("organization_id", "marketplace_id", "store_type", "is_active");

CREATE INDEX "mcf_org_idx"
  ON "marketplace_category_fees"("organization_id");

CREATE INDEX "mcf_market_idx"
  ON "marketplace_category_fees"("marketplace_id");

ALTER TABLE "marketplace_category_fees"
  ADD CONSTRAINT "marketplace_category_fees_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "marketplace_category_fees"
  ADD CONSTRAINT "marketplace_category_fees_marketplace_id_fkey"
  FOREIGN KEY ("marketplace_id") REFERENCES "marketplaces"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
