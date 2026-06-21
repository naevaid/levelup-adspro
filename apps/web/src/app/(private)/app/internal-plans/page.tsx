"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyStatePanel } from "@/components/shared/empty-state-panel";
import { useAuth } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api";

type PlanStatus = "ACTIVE" | "INACTIVE";
type BillingInterval = "MONTHLY" | "YEARLY";

type PlanRecord = {
  id: string;
  code: string;
  name: string;
  is_internal?: boolean;
  billing_interval: BillingInterval;
  price_amount: number;
  currency: string;
  sort_order: number;
  status: PlanStatus;
  quotas: {
    max_shops: number;
    max_members: number;
    history_days: number;
  };
  features: Record<string, unknown>;
  active_subscription_count?: number;
  created_at: string;
  updated_at: string;
};

type PlansResponse = {
  data: PlanRecord[];
};

type PlanFormState = {
  code: string;
  name: string;
  billingInterval: BillingInterval;
  priceAmount: string;
  currency: string;
  sortOrder: string;
  shopLimit: string;
  memberLimit: string;
  historyDays: string;
  status: PlanStatus;
  featuresText: string;
};

const emptyForm: PlanFormState = {
  code: "",
  name: "",
  billingInterval: "MONTHLY",
  priceAmount: "0",
  currency: "IDR",
  sortOrder: "0",
  shopLimit: "0",
  memberLimit: "0",
  historyDays: "30",
  status: "ACTIVE",
  featuresText: "{\n  \"dashboard\": true\n}",
};

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("id-ID");
}

function stringifyFeatures(features: Record<string, unknown>) {
  return JSON.stringify(features, null, 2);
}

export default function InternalPlansPage() {
  const { isReady, session } = useAuth();
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [form, setForm] = useState<PlanFormState>(emptyForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const authorization = useMemo(() => {
    if (!session) {
      return null;
    }

    return `${session.tokenType} ${session.accessToken}`;
  }, [session]);

  const internalRole = session?.user.internalRole ?? null;
  const hasAccess = internalRole === "PLATFORM_ADMIN";
  const selectedPlan =
    plans.find((plan) => plan.id === selectedPlanId) ?? null;

  const resetForm = useCallback(() => {
    setSelectedPlanId(null);
    setForm(emptyForm);
    setFormError(null);
  }, []);

  const fillForm = useCallback((plan: PlanRecord) => {
    setSelectedPlanId(plan.id);
    setForm({
      code: plan.code,
      name: plan.name,
      billingInterval: plan.billing_interval,
      priceAmount: String(plan.price_amount),
      currency: plan.currency,
      sortOrder: String(plan.sort_order),
      shopLimit: String(plan.quotas.max_shops),
      memberLimit: String(plan.quotas.max_members),
      historyDays: String(plan.quotas.history_days),
      status: plan.status,
      featuresText: stringifyFeatures(plan.features),
    });
    setFormError(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!authorization || !hasAccess) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiFetch<PlansResponse>("/api/v1/internal/plans", {
        headers: { Authorization: authorization },
      });
      setPlans(response.data);
      setSelectedPlanId((currentId) =>
        currentId && response.data.some((plan) => plan.id === currentId)
          ? currentId
          : null,
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Gagal memuat katalog plan internal.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [authorization, hasAccess]);

  useEffect(() => {
    if (!isReady || !authorization || !hasAccess) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [authorization, hasAccess, isReady, refresh]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!authorization) {
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const features = JSON.parse(form.featuresText) as Record<string, unknown>;
      const payload = {
        code: form.code,
        name: form.name,
        billingInterval: form.billingInterval,
        priceAmount: Number(form.priceAmount),
        currency: form.currency,
        sortOrder: Number(form.sortOrder),
        shopLimit: Number(form.shopLimit),
        memberLimit: Number(form.memberLimit),
        historyDays: Number(form.historyDays),
        status: form.status,
        features,
      };

      if (selectedPlanId) {
        await apiFetch(`/api/v1/internal/plans/${selectedPlanId}`, {
          method: "PATCH",
          headers: { Authorization: authorization },
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/v1/internal/plans", {
          method: "POST",
          headers: { Authorization: authorization },
          body: JSON.stringify(payload),
        });
      }

      await refresh();
      resetForm();
    } catch (submitError) {
      setFormError(
        submitError instanceof Error
          ? submitError.message
          : "Gagal menyimpan plan.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeactivate(planId: string) {
    if (!authorization) {
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      await apiFetch(`/api/v1/internal/plans/${planId}`, {
        method: "DELETE",
        headers: { Authorization: authorization },
      });
      await refresh();
      if (selectedPlanId === planId) {
        resetForm();
      }
    } catch (submitError) {
      setFormError(
        submitError instanceof Error
          ? submitError.message
          : "Gagal menonaktifkan plan.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isReady && session && !hasAccess) {
    return (
      <EmptyStatePanel
        title="Akses plan management dibatasi"
        description="Halaman ini hanya dibuka untuk user dengan role internal platform admin karena perubahan plan berdampak ke seluruh tenant dan billing global."
        secondaryAction={{ label: "Kembali ke dashboard", href: "/app/dashboard" }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Internal Plans"
        title="Kelola katalog plan global"
        description="Workspace ini dipakai untuk membuat, memperbarui, dan menonaktifkan plan tanpa edit database manual. Perubahan di sini memengaruhi katalog billing seluruh tenant."
        actions={
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full border border-white/12 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/5"
            >
              Plan Baru
            </button>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={!authorization || !hasAccess || isLoading}
              className="rounded-full border border-sky-300/25 px-4 py-2.5 text-sm font-medium text-sky-100 transition hover:border-sky-200/45 hover:bg-sky-400/10 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? "Memuat..." : "Refresh Plan"}
            </button>
          </div>
        }
      />

      {error ? (
        <div className="rounded-[1.5rem] border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.9fr)]">
        <div className="space-y-4">
          {plans.map((plan) => {
            const isSelected = selectedPlanId === plan.id;

            return (
              <article
                key={plan.id}
                className={`glass-card rounded-[1.75rem] border p-5 transition sm:p-6 ${
                  isSelected
                    ? "border-sky-300/30 bg-sky-400/10"
                    : "border-white/10"
                }`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-white">{plan.name}</h2>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-sky-100/80">
                        {plan.code}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          plan.status === "ACTIVE"
                            ? "border border-emerald-300/20 bg-emerald-400/10 text-emerald-100"
                            : "border border-slate-300/15 bg-white/5 text-slate-200"
                        }`}
                      >
                        {plan.status}
                      </span>
                      {plan.is_internal ? (
                        <span className="rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-3 py-1 text-xs font-medium text-fuchsia-100">
                          Internal
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm muted-text">
                      {plan.billing_interval} • {formatCurrency(plan.price_amount, plan.currency)} •
                      {` `}Sort order {plan.sort_order}
                    </p>
                    <p className="mt-2 text-sm muted-text">
                      Quota: {plan.quotas.max_shops} shop, {plan.quotas.max_members} member,
                      history {plan.quotas.history_days} hari.
                    </p>
                    <p className="mt-2 text-sm muted-text">
                      Subscription aktif: {plan.active_subscription_count ?? 0} •
                      update terakhir {formatDateTime(plan.updated_at)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => fillForm(plan)}
                      className="rounded-full border border-white/12 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-sky-300/35 hover:text-sky-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeactivate(plan.id)}
                      disabled={isSaving || plan.status === "INACTIVE"}
                      className="rounded-full border border-rose-300/20 px-4 py-2 text-sm font-medium text-rose-100 transition hover:border-rose-200/40 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Nonaktifkan
                    </button>
                  </div>
                </div>

                <div className="mt-4 rounded-[1.25rem] border border-white/10 bg-slate-950/35 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-sky-200/70">
                    Features JSON
                  </p>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-sm text-slate-200">
                    {stringifyFeatures(plan.features)}
                  </pre>
                </div>
              </article>
            );
          })}
        </div>

        <section className="glass-card rounded-[1.75rem] border border-white/10 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-sky-200/75">Editor Plan</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                {selectedPlan ? `Edit ${selectedPlan.name}` : "Buat plan baru"}
              </h2>
            </div>
          </div>

          {formError ? (
            <div className="mt-4 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {formError}
            </div>
          ) : null}

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-200">
                <span>Code</span>
                <input
                  value={form.code}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, code: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/35"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-200">
                <span>Nama</span>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/35"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-200">
                <span>Billing interval</span>
                <select
                  value={form.billingInterval}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      billingInterval: event.target.value as BillingInterval,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/35"
                >
                  <option value="MONTHLY">MONTHLY</option>
                  <option value="YEARLY">YEARLY</option>
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-200">
                <span>Status</span>
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value as PlanStatus,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/35"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="space-y-2 text-sm text-slate-200">
                <span>Harga</span>
                <input
                  value={form.priceAmount}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, priceAmount: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/35"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-200">
                <span>Currency</span>
                <input
                  value={form.currency}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, currency: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm uppercase text-white outline-none transition focus:border-sky-300/35"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-200">
                <span>Sort order</span>
                <input
                  value={form.sortOrder}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, sortOrder: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/35"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="space-y-2 text-sm text-slate-200">
                <span>Max shops</span>
                <input
                  value={form.shopLimit}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, shopLimit: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/35"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-200">
                <span>Max members</span>
                <input
                  value={form.memberLimit}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, memberLimit: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/35"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-200">
                <span>History days</span>
                <input
                  value={form.historyDays}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, historyDays: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/35"
                />
              </label>
            </div>

            <label className="block space-y-2 text-sm text-slate-200">
              <span>Features JSON</span>
              <textarea
                value={form.featuresText}
                onChange={(event) =>
                  setForm((current) => ({ ...current, featuresText: event.target.value }))
                }
                rows={12}
                className="w-full rounded-[1.5rem] border border-white/10 bg-slate-950/40 px-4 py-3 font-mono text-sm text-white outline-none transition focus:border-sky-300/35"
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-full border border-sky-300/25 px-5 py-2.5 text-sm font-medium text-sky-100 transition hover:border-sky-200/45 hover:bg-sky-400/10 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving
                  ? "Menyimpan..."
                  : selectedPlan
                    ? "Simpan Perubahan"
                    : "Buat Plan"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-white/12 px-5 py-2.5 text-sm font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/5"
              >
                Reset Form
              </button>
            </div>
          </form>
        </section>
      </section>
    </div>
  );
}
