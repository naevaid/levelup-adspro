"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyStatePanel } from "@/components/shared/empty-state-panel";
import { useAuth } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api";

type BillingPlan = {
  code: string;
  name: string;
  billing_interval: string;
  currency: string;
  price_amount: number;
  features: Record<string, unknown>;
  quotas: Record<string, unknown>;
};

type PlanListResponse = {
  data: BillingPlan[];
};

type SubscriptionSummary = {
  status: string;
  plan_code: string;
  billing_interval: string;
  current_period_start: string | null;
  current_period_end: string | null;
  grace_period_end: string | null;
};

type SubscriptionResponse = {
  data: {
    subscription: SubscriptionSummary;
    entitlements: {
      features: Record<string, unknown>;
      quotas: Record<string, unknown>;
    };
    usage: {
      active_shops: number;
      active_members: number;
    };
  };
};

type InvoiceSummary = {
  invoice_id: string;
  invoice_number: string;
  plan_code: string;
  billing_interval: string;
  amount: number;
  currency: string;
  status: string;
  issued_at: string;
  paid_at: string | null;
};

type InvoiceListResponse = {
  data: InvoiceSummary[];
};

type InvoiceDetailResponse = {
  data: {
    invoice: {
      id: string;
      invoice_number: string;
      order_id: string | null;
      gateway_order_id: string | null;
      plan_code: string;
      billing_interval: string;
      amount: number;
      currency: string;
      status: string;
      issued_at: string;
      paid_at: string | null;
      failed_at: string | null;
      expired_at: string | null;
    };
    payment: {
      provider: string | null;
      payment_service: string | null;
      payment_type: string | null;
      transaction_status: string | null;
      callback_status: string | null;
      redirect_url: string | null;
      snap_token: string | null;
    } | null;
    latest_callback: {
      delivery_id: string | null;
      attempt: number;
      event_type: string | null;
      signature_valid: boolean;
      processed_successfully: boolean;
      http_response_code: number | null;
      received_at: string;
      processed_at: string | null;
    } | null;
  };
};

type CheckoutResponse = {
  data: {
    subscription_id: string;
    invoice_id: string;
    invoice_status: string;
    payment: {
      order_id: string | null;
      gateway_order_id: string | null;
      redirect_url: string | null;
      snap_token: string | null;
    } | null;
  };
};

type RefreshPaymentStatusResponse = {
  data: {
    invoice_id: string;
    invoice_status: string;
    transaction_status: string | null;
    gateway_order_id: string | null;
  };
};

function formatCurrency(amount: number, currency: string) {
  if (currency === "IDR") {
    return `Rp${Math.round(amount).toLocaleString("id-ID")}`;
  }

  return `${currency} ${amount.toLocaleString("id-ID")}`;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatInterval(interval: string) {
  switch (interval) {
    case "MONTHLY":
      return "Bulanan";
    case "YEARLY":
      return "Tahunan";
    default:
      return interval;
  }
}

function formatStatusLabel(status: string | null | undefined) {
  if (!status) {
    return "-";
  }

  return status
    .toLowerCase()
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function getStatusClass(status: string | null | undefined) {
  switch (status) {
    case "ACTIVE":
    case "PAID":
    case "SETTLEMENT":
    case "SUCCESS":
      return "border-emerald-400/25 bg-emerald-400/15 text-emerald-100";
    case "PENDING":
    case "PENDING_PAYMENT":
    case "PENDING_ACTIVATION":
      return "border-amber-300/25 bg-amber-300/15 text-amber-50";
    case "FAILED":
    case "DENY":
    case "CANCEL":
    case "EXPIRE":
    case "EXPIRED":
    case "CANCELED":
      return "border-rose-300/25 bg-rose-300/15 text-rose-50";
    default:
      return "border-[#fb6a35]/10 bg-[#fff8f5] text-[#9a3412]";
  }
}

function formatEntryLabel(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatEntryValue(value: unknown) {
  if (typeof value === "boolean") {
    return value ? "Ya" : "Tidak";
  }

  if (typeof value === "number") {
    return value.toLocaleString("id-ID");
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (value == null) {
    return "-";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function isOwnerRole(role: string | undefined) {
  return role === "OWNER";
}

export default function SubscriptionPage() {
  const { isReady, session, currentOrganization } = useAuth();
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionResponse["data"] | null>(null);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedInvoiceDetail, setSelectedInvoiceDetail] =
    useState<InvoiceDetailResponse["data"] | null>(null);
  const [lastCheckoutPayment, setLastCheckoutPayment] =
    useState<CheckoutResponse["data"]["payment"] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingInvoiceDetail, setIsLoadingInvoiceDetail] = useState(false);
  const [isRefreshingInvoiceId, setIsRefreshingInvoiceId] = useState<string | null>(null);
  const [checkoutPlanCode, setCheckoutPlanCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const authorization = useMemo(() => {
    if (!session) {
      return null;
    }

    return `${session.tokenType} ${session.accessToken}`;
  }, [session]);

  const canCheckout = isOwnerRole(session?.membership.role);
  const isInternalWorkspace =
    currentOrganization?.isInternal ?? session?.activeOrganization.isInternal ?? false;

  const refreshBillingData = useCallback(async () => {
    if (!authorization) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [plansResponse, subscriptionResponse, invoicesResponse] = await Promise.all([
        apiFetch<PlanListResponse>("/api/v1/plans", {
          headers: { Authorization: authorization },
        }),
        apiFetch<SubscriptionResponse>("/api/v1/subscription", {
          headers: { Authorization: authorization },
        }),
        apiFetch<InvoiceListResponse>("/api/v1/subscription/invoices?limit=10", {
          headers: { Authorization: authorization },
        }),
      ]);

      setPlans(plansResponse.data);
      setSubscription(subscriptionResponse.data);
      setInvoices(invoicesResponse.data);
      if (invoicesResponse.data.length === 0) {
        setSelectedInvoiceDetail(null);
      }
      setSelectedInvoiceId((previous) => {
        if (
          previous &&
          invoicesResponse.data.some((invoice) => invoice.invoice_id === previous)
        ) {
          return previous;
        }

        return invoicesResponse.data[0]?.invoice_id ?? null;
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Gagal memuat data subscription dan billing.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [authorization]);

  const loadInvoiceDetail = useCallback(
    async (invoiceId: string) => {
      if (!authorization) {
        return;
      }

      setIsLoadingInvoiceDetail(true);

      try {
        const response = await apiFetch<InvoiceDetailResponse>(
          `/api/v1/subscription/invoices/${invoiceId}`,
          {
            headers: { Authorization: authorization },
          },
        );

        setSelectedInvoiceDetail(response.data);
      } catch (detailError) {
        setActionError(
          detailError instanceof Error
            ? detailError.message
            : "Gagal memuat detail invoice.",
        );
      } finally {
        setIsLoadingInvoiceDetail(false);
      }
    },
    [authorization],
  );

  useEffect(() => {
    if (!isReady || !authorization) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void refreshBillingData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [authorization, isReady, refreshBillingData]);

  useEffect(() => {
    if (!selectedInvoiceId || !authorization) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadInvoiceDetail(selectedInvoiceId);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [authorization, loadInvoiceDetail, selectedInvoiceId]);

  const handleCheckout = async (plan: BillingPlan) => {
    if (!authorization || !canCheckout) {
      return;
    }

    setCheckoutPlanCode(plan.code);
    setActionError(null);
    setActionMessage(null);

    try {
      const response = await apiFetch<CheckoutResponse>("/api/v1/subscription/checkout", {
        method: "POST",
        headers: { Authorization: authorization },
        body: JSON.stringify({
          planCode: plan.code,
          billingInterval: plan.billing_interval,
        }),
      });

      setLastCheckoutPayment(response.data.payment);
      setSelectedInvoiceId(response.data.invoice_id);
      setActionMessage(
        response.data.payment?.redirect_url
          ? "Checkout berhasil dibuat. Halaman pembayaran dibuka di tab baru."
          : "Checkout berhasil dibuat. Redirect URL belum tersedia di response.",
      );

      await refreshBillingData();
      await loadInvoiceDetail(response.data.invoice_id);

      if (response.data.payment?.redirect_url) {
        window.open(response.data.payment.redirect_url, "_blank", "noopener,noreferrer");
      }
    } catch (checkoutError) {
      setActionError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Gagal membuat checkout subscription.",
      );
    } finally {
      setCheckoutPlanCode(null);
    }
  };

  const handleRefreshPaymentStatus = async (invoiceId: string) => {
    if (!authorization || !canCheckout) {
      return;
    }

    setIsRefreshingInvoiceId(invoiceId);
    setActionError(null);
    setActionMessage(null);

    try {
      const response = await apiFetch<RefreshPaymentStatusResponse>(
        "/api/v1/subscription/refresh-payment-status",
        {
          method: "POST",
          headers: { Authorization: authorization },
          body: JSON.stringify({ invoiceId }),
        },
      );

      setActionMessage(
        `Status pembayaran diperbarui: ${formatStatusLabel(response.data.transaction_status)}.`,
      );
      await refreshBillingData();
      await loadInvoiceDetail(invoiceId);
    } catch (refreshError) {
      setActionError(
        refreshError instanceof Error
          ? refreshError.message
          : "Gagal memperbarui status pembayaran.",
      );
    } finally {
      setIsRefreshingInvoiceId(null);
    }
  };

  const currentSubscription = subscription?.subscription ?? null;
  const featureEntries = Object.entries(subscription?.entitlements.features ?? {});
  const quotaEntries = Object.entries(subscription?.entitlements.quotas ?? {});
  const activeRedirectUrl =
    selectedInvoiceDetail?.payment?.redirect_url ?? lastCheckoutPayment?.redirect_url ?? null;

  if (isReady && session && isInternalWorkspace) {
    return (
      <EmptyStatePanel
        title="Workspace internal tidak memakai billing tenant"
        description="Subscription checkout, invoice, dan renewal tenant disembunyikan dari workspace internal. Pindah ke workspace tenant bila ingin menguji atau mengelola subscription pelanggan."
        secondaryAction={{ label: "Kembali ke dashboard", href: "/app/dashboard" }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Subscription"
        title="Kelola plan dan alur pembayaran organization"
        description="Halaman ini memakai endpoint billing yang aktif saat ini: membaca plan, ringkasan subscription, riwayat invoice, membuat checkout, lalu me-refresh status pembayaran dari payment service."
        actions={
          <button
            type="button"
            onClick={() => void refreshBillingData()}
            disabled={!authorization || isLoading}
            className="rounded-full border border-[#fb6a35]/12 bg-white px-4 py-2.5 text-sm font-medium text-[#9a3412] transition hover:border-[#fb6a35]/24 hover:bg-[#fff5ef] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? "Memuat..." : "Muat ulang"}
          </button>
        }
      />

      {!canCheckout ? (
        <section className="glass-card rounded-[1.75rem] border border-amber-300/20 bg-amber-300/10 p-5 text-sm text-amber-50">
          Checkout dan refresh status pembayaran hanya bisa dijalankan oleh role
          owner. Role aktif Anda saat ini:{" "}
          <span className="font-semibold">
            {session?.membership.role ? formatStatusLabel(session.membership.role) : "-"}
          </span>
          .
        </section>
      ) : null}

      {error ? (
        <section className="glass-card rounded-[1.75rem] border border-rose-300/20 bg-rose-300/10 p-5 text-sm text-rose-50">
          {error}
        </section>
      ) : null}

      {actionError ? (
        <section className="glass-card rounded-[1.75rem] border border-rose-300/20 bg-rose-300/10 p-5 text-sm text-rose-50">
          {actionError}
        </section>
      ) : null}

      {actionMessage ? (
        <section className="glass-card rounded-[1.75rem] border border-emerald-400/20 bg-emerald-400/10 p-5 text-sm text-emerald-50">
          {actionMessage}
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="glass-card rounded-[1.75rem] border border-[#fb6a35]/8 p-6 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[#9a3412]/70">
                Subscription Saat Ini
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#111827]">
                {currentSubscription?.plan_code ?? "Belum ada plan aktif"}
              </h2>
              <p className="mt-2 text-sm leading-7 muted-text">
                Ringkasan ini diambil dari `GET /api/v1/subscription`.
              </p>
            </div>

            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getStatusClass(currentSubscription?.status)}`}
            >
              {formatStatusLabel(currentSubscription?.status)}
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-[#fb6a35]/8 bg-[#fff8f5] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                Interval
              </p>
              <p className="mt-2 text-lg font-semibold text-[#111827]">
                {formatInterval(currentSubscription?.billing_interval ?? "-")}
              </p>
            </div>
            <div className="rounded-3xl border border-[#fb6a35]/8 bg-[#fff8f5] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                Periode Mulai
              </p>
              <p className="mt-2 text-sm font-medium text-[#111827]">
                {formatDateTime(currentSubscription?.current_period_start ?? null)}
              </p>
            </div>
            <div className="rounded-3xl border border-[#fb6a35]/8 bg-[#fff8f5] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                Periode Berakhir
              </p>
              <p className="mt-2 text-sm font-medium text-[#111827]">
                {formatDateTime(currentSubscription?.current_period_end ?? null)}
              </p>
            </div>
            <div className="rounded-3xl border border-[#fb6a35]/8 bg-[#fff8f5] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                Grace Period
              </p>
              <p className="mt-2 text-sm font-medium text-[#111827]">
                {formatDateTime(currentSubscription?.grace_period_end ?? null)}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-[#fb6a35]/8 bg-[#fff8f5] p-5">
              <h3 className="text-sm font-semibold text-[#111827]">Feature Entitlements</h3>
              <div className="mt-4 space-y-3">
                {featureEntries.length === 0 ? (
                  <p className="text-sm muted-text">Belum ada data feature entitlement.</p>
                ) : (
                  featureEntries.map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-start justify-between gap-4 border-b border-[#fb6a35]/8 pb-3 text-sm last:border-b-0 last:pb-0"
                    >
                      <span className="muted-text">{formatEntryLabel(key)}</span>
                      <span className="max-w-[55%] text-right font-medium text-[#111827]">
                        {formatEntryValue(value)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-[#fb6a35]/8 bg-[#fff8f5] p-5">
              <h3 className="text-sm font-semibold text-[#111827]">Quota & Usage</h3>
              <div className="mt-4 space-y-3">
                {quotaEntries.map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-start justify-between gap-4 border-b border-[#fb6a35]/8 pb-3 text-sm last:border-b-0 last:pb-0"
                  >
                    <span className="muted-text">{formatEntryLabel(key)}</span>
                    <span className="max-w-[55%] text-right font-medium text-[#111827]">
                      {formatEntryValue(value)}
                    </span>
                  </div>
                ))}
                <div className="flex items-start justify-between gap-4 border-b border-[#fb6a35]/8 pb-3 text-sm">
                  <span className="muted-text">Active Shops</span>
                  <span className="font-medium text-[#111827]">
                    {subscription?.usage.active_shops.toLocaleString("id-ID") ?? "0"}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4 text-sm">
                  <span className="muted-text">Active Members</span>
                  <span className="font-medium text-[#111827]">
                    {subscription?.usage.active_members.toLocaleString("id-ID") ?? "0"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-[1.75rem] border border-[#fb6a35]/8 p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[#9a3412]/70">
                Invoice Terpilih
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#111827]">
                {selectedInvoiceDetail?.invoice.invoice_number ?? "Belum ada invoice"}
              </h2>
            </div>

            {selectedInvoiceDetail ? (
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getStatusClass(selectedInvoiceDetail.invoice.status)}`}
              >
                {formatStatusLabel(selectedInvoiceDetail.invoice.status)}
              </span>
            ) : null}
          </div>

          {isLoadingInvoiceDetail ? (
            <div className="mt-6 rounded-3xl border border-[#fb6a35]/8 bg-[#fff8f5] p-5 text-sm muted-text">
              Memuat detail invoice...
            </div>
          ) : selectedInvoiceDetail ? (
            <div className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-[#fb6a35]/8 bg-[#fff8f5] p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                    Amount
                  </p>
                  <p className="mt-2 text-lg font-semibold text-[#111827]">
                    {formatCurrency(
                      selectedInvoiceDetail.invoice.amount,
                      selectedInvoiceDetail.invoice.currency,
                    )}
                  </p>
                </div>
                <div className="rounded-3xl border border-[#fb6a35]/8 bg-[#fff8f5] p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                    Payment Status
                  </p>
                  <p className="mt-2 text-sm font-medium text-[#111827]">
                    {formatStatusLabel(
                      selectedInvoiceDetail.payment?.transaction_status ??
                        selectedInvoiceDetail.invoice.status,
                    )}
                  </p>
                </div>
              </div>

              <div className="space-y-3 rounded-3xl border border-[#fb6a35]/8 bg-[#fff8f5] p-5 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <span className="muted-text">Order ID</span>
                  <span className="max-w-[55%] text-right text-[#111827]">
                    {selectedInvoiceDetail.invoice.order_id ?? "-"}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="muted-text">Gateway Order ID</span>
                  <span className="max-w-[55%] text-right text-[#111827]">
                    {selectedInvoiceDetail.invoice.gateway_order_id ?? "-"}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="muted-text">Redirect URL</span>
                  <span className="max-w-[55%] break-all text-right text-[#111827]">
                    {selectedInvoiceDetail.payment?.redirect_url ?? "-"}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="muted-text">Callback Status</span>
                  <span className="text-right text-[#111827]">
                    {formatStatusLabel(selectedInvoiceDetail.payment?.callback_status)}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="muted-text">Issued At</span>
                  <span className="text-right text-[#111827]">
                    {formatDateTime(selectedInvoiceDetail.invoice.issued_at)}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="muted-text">Paid At</span>
                  <span className="text-right text-[#111827]">
                    {formatDateTime(selectedInvoiceDetail.invoice.paid_at)}
                  </span>
                </div>
              </div>

              {selectedInvoiceDetail.latest_callback ? (
                <div className="rounded-3xl border border-[#fb6a35]/8 bg-[#fff8f5] p-5 text-sm">
                  <h3 className="font-semibold text-[#111827]">Callback Terakhir</h3>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <span className="muted-text">Event</span>
                      <span className="text-right text-[#111827]">
                        {selectedInvoiceDetail.latest_callback.event_type ?? "-"}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span className="muted-text">Signature Valid</span>
                      <span className="text-right text-[#111827]">
                        {selectedInvoiceDetail.latest_callback.signature_valid ? "Ya" : "Tidak"}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span className="muted-text">HTTP Response</span>
                      <span className="text-right text-[#111827]">
                        {selectedInvoiceDetail.latest_callback.http_response_code ?? "-"}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleRefreshPaymentStatus(selectedInvoiceDetail.invoice.id)}
                  disabled={!canCheckout || isRefreshingInvoiceId === selectedInvoiceDetail.invoice.id}
                  className="rounded-full border border-[#fb6a35]/35 bg-[#fb6a35] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#f85a21] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isRefreshingInvoiceId === selectedInvoiceDetail.invoice.id
                    ? "Memeriksa..."
                    : "Refresh status pembayaran"}
                </button>
                {activeRedirectUrl ? (
                  <a
                    href={activeRedirectUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-[#fb6a35]/12 bg-white px-5 py-3 text-sm font-medium text-[#9a3412] transition hover:border-[#fb6a35]/24 hover:bg-[#fff5ef]"
                  >
                    Buka halaman pembayaran
                  </a>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-3xl border border-[#fb6a35]/8 bg-[#fff8f5] p-5 text-sm muted-text">
              Pilih invoice dari daftar di bawah atau buat checkout baru untuk melihat detail
              payment.
            </div>
          )}
        </div>
      </section>

      <section className="glass-card rounded-[1.75rem] border border-[#fb6a35]/8 p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#9a3412]/70">
              Pilih Plan
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#111827]">
              Checkout subscription dari UI
            </h2>
            <p className="mt-2 text-sm leading-7 muted-text">
              Tombol di bawah memanggil `POST /api/v1/subscription/checkout` dengan
              plan dan interval yang dikembalikan oleh `GET /api/v1/plans`.
            </p>
          </div>
        </div>

        {plans.length === 0 && !isLoading ? (
          <div className="mt-6">
            <EmptyStatePanel
              title="Belum ada plan aktif"
              description="Endpoint plan belum mengembalikan item aktif untuk organization ini."
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-4 xl:grid-cols-3">
            {plans.map((plan) => {
              const isCurrentPlan =
                plan.code === currentSubscription?.plan_code &&
                plan.billing_interval === currentSubscription?.billing_interval;

              return (
                <article
                  key={`${plan.code}-${plan.billing_interval}`}
                  className={`rounded-[1.5rem] border p-5 ${
                    isCurrentPlan
                      ? "border-[#fb6a35]/16 bg-[#fb6a35]/8"
                      : "border-[#fb6a35]/8 bg-[#fff8f5]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold text-[#111827]">{plan.name}</h3>
                      <p className="mt-2 text-sm muted-text">
                        {plan.code} · {formatInterval(plan.billing_interval)}
                      </p>
                    </div>
                    {isCurrentPlan ? (
                      <span className="rounded-full border border-[#fb6a35]/14 bg-[#fb6a35]/10 px-3 py-1 text-xs font-medium text-[#9a3412]">
                        Plan saat ini
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-5 text-3xl font-semibold text-[#111827]">
                    {formatCurrency(plan.price_amount, plan.currency)}
                  </p>

                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                    <div className="rounded-3xl border border-[#fb6a35]/8 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                        Features
                      </p>
                      <div className="mt-3 space-y-2 text-sm">
                        {Object.entries(plan.features ?? {}).map(([key, value]) => (
                          <div
                            key={key}
                            className="flex items-start justify-between gap-4 text-[#374151]"
                          >
                            <span className="muted-text">{formatEntryLabel(key)}</span>
                            <span className="max-w-[55%] text-right">
                              {formatEntryValue(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-[#fb6a35]/8 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                        Quotas
                      </p>
                      <div className="mt-3 space-y-2 text-sm">
                        {Object.entries(plan.quotas ?? {}).map(([key, value]) => (
                          <div
                            key={key}
                            className="flex items-start justify-between gap-4 text-[#374151]"
                          >
                            <span className="muted-text">{formatEntryLabel(key)}</span>
                            <span className="max-w-[55%] text-right">
                              {formatEntryValue(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleCheckout(plan)}
                    disabled={!canCheckout || checkoutPlanCode === plan.code}
                  className="mt-5 w-full rounded-full border border-[#fb6a35]/35 bg-[#fb6a35] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#f85a21] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {checkoutPlanCode === plan.code ? "Memproses..." : "Checkout plan ini"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="glass-card rounded-[1.75rem] border border-[#fb6a35]/8 p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#9a3412]/70">
              Riwayat Invoice
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#111827]">
              Invoice billing terbaru
            </h2>
            <p className="mt-2 text-sm leading-7 muted-text">
              Daftar ini diambil dari `GET /api/v1/subscription/invoices?limit=10`.
            </p>
          </div>
        </div>

        {invoices.length === 0 && !isLoading ? (
          <div className="mt-6">
            <EmptyStatePanel
              title="Belum ada invoice"
              description="Checkout pertama akan membuat invoice baru dan langsung muncul di sini."
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {invoices.map((invoice) => {
              const isSelected = invoice.invoice_id === selectedInvoiceId;

              return (
                <button
                  key={invoice.invoice_id}
                  type="button"
                  onClick={() => setSelectedInvoiceId(invoice.invoice_id)}
                  className={`w-full rounded-[1.5rem] border p-5 text-left transition ${
                    isSelected
                      ? "border-[#fb6a35]/16 bg-[#fb6a35]/8"
                      : "border-[#fb6a35]/8 bg-[#fff8f5] hover:border-[#fb6a35]/14"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-[#111827]">
                        {invoice.invoice_number}
                      </h3>
                      <p className="mt-2 text-sm muted-text">
                        {invoice.plan_code} · {formatInterval(invoice.billing_interval)}
                      </p>
                    </div>

                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getStatusClass(invoice.status)}`}
                    >
                      {formatStatusLabel(invoice.status)}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Amount
                      </p>
                      <p className="mt-2 text-[#111827]">
                        {formatCurrency(invoice.amount, invoice.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Issued At
                      </p>
                      <p className="mt-2 text-[#111827]">{formatDateTime(invoice.issued_at)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Paid At
                      </p>
                      <p className="mt-2 text-[#111827]">{formatDateTime(invoice.paid_at)}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
