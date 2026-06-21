WITH ranked_fees AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        marketplace_id,
        store_type,
        primary_category,
        COALESCE(secondary_category, ''),
        category_name
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS row_num
  FROM marketplace_category_fees
)
DELETE FROM marketplace_category_fees
WHERE id IN (
  SELECT id
  FROM ranked_fees
  WHERE row_num > 1
);

ALTER TABLE "marketplace_category_fees"
  DROP CONSTRAINT IF EXISTS "marketplace_category_fees_organization_id_fkey";

DROP INDEX IF EXISTS "mcf_org_market_store_cat_unique";
DROP INDEX IF EXISTS "mcf_org_market_store_active_idx";
DROP INDEX IF EXISTS "mcf_org_idx";

ALTER TABLE "marketplace_category_fees"
  DROP COLUMN IF EXISTS "organization_id";

CREATE UNIQUE INDEX "mcf_market_store_cat_unique"
  ON "marketplace_category_fees" (
    "marketplace_id",
    "store_type",
    "primary_category",
    "secondary_category",
    "category_name"
  );

CREATE INDEX "mcf_market_store_active_idx"
  ON "marketplace_category_fees" ("marketplace_id", "store_type", "is_active");
