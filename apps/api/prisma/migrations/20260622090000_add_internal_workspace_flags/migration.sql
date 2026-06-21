ALTER TABLE "organizations"
ADD COLUMN "is_internal" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "plans"
ADD COLUMN "is_internal" BOOLEAN NOT NULL DEFAULT false;
