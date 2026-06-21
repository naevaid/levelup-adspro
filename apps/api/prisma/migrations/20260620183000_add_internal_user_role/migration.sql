CREATE TYPE "InternalUserRole" AS ENUM ('PLATFORM_ADMIN');

ALTER TABLE "users"
  ADD COLUMN "internal_role" "InternalUserRole";
