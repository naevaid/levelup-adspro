CREATE TYPE "ExtensionSessionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');
CREATE TYPE "CaptureMode" AS ENUM ('OWNED', 'PUBLIC');
CREATE TYPE "IngestionBatchStatus" AS ENUM ('ACCEPTED', 'FAILED', 'PROCESSING', 'COMPLETED');
CREATE TYPE "RawPayloadObjectStatus" AS ENUM ('STORED', 'FAILED', 'EXPIRED');

CREATE TABLE "extension_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "shop_id" UUID,
  "device_label" TEXT NOT NULL,
  "extension_version" TEXT NOT NULL,
  "session_token_hash" TEXT NOT NULL,
  "status" "ExtensionSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "last_heartbeat_at" TIMESTAMP(3) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "extension_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ingestion_batches" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "shop_id" UUID,
  "extension_session_id" UUID NOT NULL,
  "capture_mode" "CaptureMode" NOT NULL,
  "page_type" TEXT NOT NULL,
  "marketplace" TEXT NOT NULL,
  "payload_schema_version" TEXT NOT NULL,
  "status" "IngestionBatchStatus" NOT NULL DEFAULT 'ACCEPTED',
  "captured_at" TIMESTAMP(3) NOT NULL,
  "processed_at" TIMESTAMP(3),
  "error_code" TEXT,
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ingestion_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "raw_payload_objects" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "shop_id" UUID,
  "ingestion_batch_id" UUID NOT NULL,
  "storage_key" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "retention_until" TIMESTAMP(3) NOT NULL,
  "status" "RawPayloadObjectStatus" NOT NULL DEFAULT 'STORED',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raw_payload_objects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "extension_sessions_session_token_hash_key"
  ON "extension_sessions"("session_token_hash");

CREATE UNIQUE INDEX "raw_payload_objects_ingestion_batch_id_payload_hash_key"
  ON "raw_payload_objects"("ingestion_batch_id", "payload_hash");

CREATE INDEX "extension_sessions_organization_id_idx"
  ON "extension_sessions"("organization_id");

CREATE INDEX "extension_sessions_user_id_idx"
  ON "extension_sessions"("user_id");

CREATE INDEX "extension_sessions_shop_id_idx"
  ON "extension_sessions"("shop_id");

CREATE INDEX "ingestion_batches_organization_id_idx"
  ON "ingestion_batches"("organization_id");

CREATE INDEX "ingestion_batches_shop_id_idx"
  ON "ingestion_batches"("shop_id");

CREATE INDEX "ingestion_batches_extension_session_id_idx"
  ON "ingestion_batches"("extension_session_id");

CREATE INDEX "ingestion_batches_organization_id_status_idx"
  ON "ingestion_batches"("organization_id", "status");

CREATE INDEX "ingestion_batches_shop_id_captured_at_idx"
  ON "ingestion_batches"("shop_id", "captured_at");

CREATE INDEX "raw_payload_objects_organization_id_idx"
  ON "raw_payload_objects"("organization_id");

CREATE INDEX "raw_payload_objects_shop_id_idx"
  ON "raw_payload_objects"("shop_id");

CREATE INDEX "raw_payload_objects_ingestion_batch_id_idx"
  ON "raw_payload_objects"("ingestion_batch_id");

CREATE INDEX "raw_payload_objects_retention_until_idx"
  ON "raw_payload_objects"("retention_until");

ALTER TABLE "extension_sessions"
  ADD CONSTRAINT "extension_sessions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "extension_sessions"
  ADD CONSTRAINT "extension_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "extension_sessions"
  ADD CONSTRAINT "extension_sessions_shop_id_fkey"
  FOREIGN KEY ("shop_id") REFERENCES "shops"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ingestion_batches"
  ADD CONSTRAINT "ingestion_batches_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ingestion_batches"
  ADD CONSTRAINT "ingestion_batches_shop_id_fkey"
  FOREIGN KEY ("shop_id") REFERENCES "shops"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ingestion_batches"
  ADD CONSTRAINT "ingestion_batches_extension_session_id_fkey"
  FOREIGN KEY ("extension_session_id") REFERENCES "extension_sessions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "raw_payload_objects"
  ADD CONSTRAINT "raw_payload_objects_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "raw_payload_objects"
  ADD CONSTRAINT "raw_payload_objects_shop_id_fkey"
  FOREIGN KEY ("shop_id") REFERENCES "shops"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "raw_payload_objects"
  ADD CONSTRAINT "raw_payload_objects_ingestion_batch_id_fkey"
  FOREIGN KEY ("ingestion_batch_id") REFERENCES "ingestion_batches"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
