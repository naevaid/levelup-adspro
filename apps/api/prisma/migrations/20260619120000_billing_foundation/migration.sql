ALTER TYPE "SubscriptionStatus" ADD VALUE 'PENDING_ACTIVATION';
ALTER TYPE "SubscriptionStatus" ADD VALUE 'GRACE_PERIOD';
ALTER TYPE "SubscriptionStatus" ADD VALUE 'EXPIRED';

CREATE TYPE "InvoiceStatus" AS ENUM (
  'DRAFT',
  'ISSUED',
  'PENDING_PAYMENT',
  'PAID',
  'FAILED',
  'EXPIRED',
  'VOID',
  'REFUNDED'
);

ALTER TABLE "plans"
  ADD COLUMN "price_amount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'IDR',
  ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "subscriptions"
  ADD COLUMN "current_period_start" TIMESTAMP(3),
  ADD COLUMN "current_period_end" TIMESTAMP(3),
  ADD COLUMN "grace_period_end" TIMESTAMP(3),
  ADD COLUMN "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "activated_at" TIMESTAMP(3),
  ADD COLUMN "canceled_at" TIMESTAMP(3),
  ADD COLUMN "expired_at" TIMESTAMP(3);

CREATE TABLE "billing_invoices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "invoice_number" TEXT NOT NULL,
  "organization_id" UUID NOT NULL,
  "subscription_id" UUID,
  "plan_id" UUID NOT NULL,
  "billing_interval" "BillingInterval" NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'IDR',
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "order_id" TEXT NOT NULL,
  "gateway_order_id" TEXT,
  "description" TEXT,
  "issued_at" TIMESTAMP(3),
  "due_at" TIMESTAMP(3),
  "paid_at" TIMESTAMP(3),
  "failed_at" TIMESTAMP(3),
  "expired_at" TIMESTAMP(3),
  "voided_at" TIMESTAMP(3),
  "metadata_json" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "billing_payment_transactions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "invoice_id" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "payment_service" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "gateway_order_id" TEXT,
  "payment_type" TEXT,
  "transaction_status" TEXT,
  "callback_status" TEXT,
  "redirect_url" TEXT,
  "snap_token" TEXT,
  "raw_charge_response_json" JSONB,
  "last_lookup_response_json" JSONB,
  "last_callback_payload_json" JSONB,
  "last_callback_received_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_payment_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "billing_callback_deliveries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "invoice_id" UUID,
  "gateway_order_id" TEXT,
  "delivery_id" TEXT NOT NULL,
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "event_type" TEXT,
  "signature_valid" BOOLEAN NOT NULL DEFAULT false,
  "processed_successfully" BOOLEAN NOT NULL DEFAULT false,
  "http_response_code" INTEGER,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),
  "headers_json" JSONB NOT NULL DEFAULT '{}',
  "payload_json" JSONB NOT NULL DEFAULT '{}',
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_callback_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "organization_entitlement_snapshots" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "subscription_id" UUID,
  "plan_code" TEXT NOT NULL,
  "subscription_status" "SubscriptionStatus" NOT NULL,
  "features_json" JSONB NOT NULL DEFAULT '{}',
  "quotas_json" JSONB NOT NULL DEFAULT '{}',
  "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organization_entitlement_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "billing_invoices_invoice_number_key"
  ON "billing_invoices"("invoice_number");

CREATE UNIQUE INDEX "billing_invoices_order_id_key"
  ON "billing_invoices"("order_id");

CREATE UNIQUE INDEX "billing_invoices_gateway_order_id_key"
  ON "billing_invoices"("gateway_order_id");

CREATE INDEX "billing_invoices_organization_id_status_idx"
  ON "billing_invoices"("organization_id", "status");

CREATE INDEX "billing_invoices_subscription_id_idx"
  ON "billing_invoices"("subscription_id");

CREATE UNIQUE INDEX "billing_payment_transactions_invoice_id_key"
  ON "billing_payment_transactions"("invoice_id");

CREATE UNIQUE INDEX "billing_payment_transactions_gateway_order_id_key"
  ON "billing_payment_transactions"("gateway_order_id");

CREATE INDEX "billing_payment_transactions_order_id_idx"
  ON "billing_payment_transactions"("order_id");

CREATE INDEX "billing_payment_transactions_transaction_status_idx"
  ON "billing_payment_transactions"("transaction_status");

CREATE UNIQUE INDEX "billing_callback_deliveries_delivery_id_attempt_key"
  ON "billing_callback_deliveries"("delivery_id", "attempt");

CREATE INDEX "billing_callback_deliveries_invoice_id_idx"
  ON "billing_callback_deliveries"("invoice_id");

CREATE INDEX "billing_callback_deliveries_gateway_order_id_idx"
  ON "billing_callback_deliveries"("gateway_order_id");

CREATE INDEX "billing_callback_deliveries_processed_successfully_idx"
  ON "billing_callback_deliveries"("processed_successfully");

CREATE INDEX "billing_callback_deliveries_received_at_idx"
  ON "billing_callback_deliveries"("received_at");

CREATE UNIQUE INDEX "organization_entitlement_snapshots_organization_id_key"
  ON "organization_entitlement_snapshots"("organization_id");

CREATE INDEX "organization_entitlement_snapshots_subscription_id_idx"
  ON "organization_entitlement_snapshots"("subscription_id");

CREATE INDEX "organization_entitlement_snapshots_plan_code_idx"
  ON "organization_entitlement_snapshots"("plan_code");

ALTER TABLE "billing_invoices"
  ADD CONSTRAINT "billing_invoices_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "billing_invoices"
  ADD CONSTRAINT "billing_invoices_subscription_id_fkey"
  FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "billing_invoices"
  ADD CONSTRAINT "billing_invoices_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "plans"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "billing_payment_transactions"
  ADD CONSTRAINT "billing_payment_transactions_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "billing_invoices"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "billing_callback_deliveries"
  ADD CONSTRAINT "billing_callback_deliveries_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "billing_invoices"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "organization_entitlement_snapshots"
  ADD CONSTRAINT "organization_entitlement_snapshots_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "organization_entitlement_snapshots"
  ADD CONSTRAINT "organization_entitlement_snapshots_subscription_id_fkey"
  FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
