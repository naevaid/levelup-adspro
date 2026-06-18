ALTER TABLE "marketplace_category_fees"
  ADD COLUMN "gratis_ongkir_pct_regular" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "gratis_ongkir_cap_regular" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "gratis_ongkir_pct_special" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "gratis_ongkir_cap_special" DOUBLE PRECISION NOT NULL DEFAULT 0;
