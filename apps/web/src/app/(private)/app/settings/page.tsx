"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyStatePanel } from "@/components/shared/empty-state-panel";
import { useAuth } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api";

type MarketplaceSummary = {
  id: string;
  code: string;
  name: string;
};

type StoreType = "NON_STAR" | "STAR" | "MALL";

type MarketplaceCategoryFee = {
  id: string;
  storeType: StoreType;
  primaryCategory: string;
  secondaryCategory: string | null;
  categoryName: string;
  feePercent: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  marketplace: MarketplaceSummary;
};

type FeeFormState = {
  marketplaceId: string;
  storeType: StoreType;
  primaryCategory: string;
  secondaryCategory: string;
  categoryName: string;
  feePercent: string;
  notes: string;
  isActive: boolean;
};

const EMPTY_FORM: FeeFormState = {
  marketplaceId: "",
  storeType: "NON_STAR",
  primaryCategory: "",
  secondaryCategory: "",
  categoryName: "",
  feePercent: "",
  notes: "",
  isActive: true,
};

function getStoreTypeLabel(storeType: StoreType) {
  switch (storeType) {
    case "NON_STAR":
      return "Non-Star";
    case "STAR":
      return "Star/Star+";
    case "MALL":
      return "Mall";
    default:
      return storeType;
  }
}

function getPreferredMarketplaceId(marketplaces: MarketplaceSummary[]) {
  return (
    marketplaces.find((marketplace) => marketplace.code === "SHOPEE")?.id ??
    marketplaces[0]?.id ??
    ""
  );
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

export default function SettingsPage() {
  const { isReady, session } = useAuth();
  const [marketplaces, setMarketplaces] = useState<MarketplaceSummary[]>([]);
  const [fees, setFees] = useState<MarketplaceCategoryFee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FeeFormState>(EMPTY_FORM);
  const [marketplaceFilter, setMarketplaceFilter] = useState<string>("ALL");
  const [storeTypeFilter, setStoreTypeFilter] = useState<StoreType | "ALL">("ALL");

  const authorization = useMemo(() => {
    if (!session) {
      return null;
    }

    return `${session.tokenType} ${session.accessToken}`;
  }, [session]);

  const resetForm = useCallback(
    (nextMarketplaces?: MarketplaceSummary[]) => {
      const source = nextMarketplaces ?? marketplaces;
      setEditingId(null);
      setForm({
        ...EMPTY_FORM,
        marketplaceId: getPreferredMarketplaceId(source),
      });
      setSubmitError(null);
    },
    [marketplaces],
  );

  const refresh = useCallback(async () => {
    if (!authorization) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [nextMarketplaces, nextFees] = await Promise.all([
        apiFetch<MarketplaceSummary[]>("/api/v1/marketplaces", {
          headers: { Authorization: authorization },
        }),
        apiFetch<MarketplaceCategoryFee[]>("/api/v1/marketplace-category-fees", {
          headers: { Authorization: authorization },
        }),
      ]);

      setMarketplaces(nextMarketplaces);
      setFees(nextFees);
      setMarketplaceFilter((previous) =>
        previous === "ALL" ? previous : previous || getPreferredMarketplaceId(nextMarketplaces),
      );
      setForm((previous) => ({
        ...previous,
        marketplaceId:
          previous.marketplaceId || getPreferredMarketplaceId(nextMarketplaces),
      }));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Gagal memuat konfigurasi fee kategori marketplace.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [authorization]);

  useEffect(() => {
    if (!isReady || !authorization) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [authorization, isReady, refresh]);

  const filteredFees = useMemo(() => {
    return fees.filter((fee) => {
      if (marketplaceFilter !== "ALL" && fee.marketplace.id !== marketplaceFilter) {
        return false;
      }

      if (storeTypeFilter !== "ALL" && fee.storeType !== storeTypeFilter) {
        return false;
      }

      return true;
    });
  }, [fees, marketplaceFilter, storeTypeFilter]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authorization) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        marketplaceId: form.marketplaceId,
        storeType: form.storeType,
        primaryCategory: form.primaryCategory,
        secondaryCategory: form.secondaryCategory || undefined,
        categoryName: form.categoryName,
        feePercent: Number.parseFloat(form.feePercent),
        notes: form.notes || undefined,
        isActive: form.isActive,
      };

      if (editingId) {
        await apiFetch<MarketplaceCategoryFee>(
          `/api/v1/marketplace-category-fees/${editingId}`,
          {
            method: "PATCH",
            headers: { Authorization: authorization },
            body: JSON.stringify(payload),
          },
        );
      } else {
        await apiFetch<MarketplaceCategoryFee>("/api/v1/marketplace-category-fees", {
          method: "POST",
          headers: { Authorization: authorization },
          body: JSON.stringify(payload),
        });
      }

      await refresh();
      resetForm();
    } catch (submitError) {
      setSubmitError(
        submitError instanceof Error
          ? submitError.message
          : "Gagal menyimpan fee kategori marketplace.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (fee: MarketplaceCategoryFee) => {
    setEditingId(fee.id);
    setSubmitError(null);
    setForm({
      marketplaceId: fee.marketplace.id,
      storeType: fee.storeType,
      primaryCategory: fee.primaryCategory,
      secondaryCategory: fee.secondaryCategory ?? "",
      categoryName: fee.categoryName,
      feePercent: fee.feePercent.toString(),
      notes: fee.notes ?? "",
      isActive: fee.isActive,
    });
  };

  const handleToggleStatus = async (fee: MarketplaceCategoryFee) => {
    if (!authorization) {
      return;
    }

    setSubmitError(null);
    try {
      await apiFetch<MarketplaceCategoryFee>(
        `/api/v1/marketplace-category-fees/${fee.id}`,
        {
          method: "PATCH",
          headers: { Authorization: authorization },
          body: JSON.stringify({ isActive: !fee.isActive }),
        },
      );
      await refresh();
    } catch (toggleError) {
      setSubmitError(
        toggleError instanceof Error
          ? toggleError.message
          : "Gagal memperbarui status fee kategori.",
      );
    }
  };

  const handleDelete = async (fee: MarketplaceCategoryFee) => {
    if (!authorization) {
      return;
    }

    const confirmed = window.confirm(
      `Hapus konfigurasi fee untuk kategori "${fee.categoryName}"?`,
    );
    if (!confirmed) {
      return;
    }

    setSubmitError(null);
    try {
      await apiFetch<{ success: boolean }>(
        `/api/v1/marketplace-category-fees/${fee.id}`,
        {
          method: "DELETE",
          headers: { Authorization: authorization },
        },
      );
      await refresh();
      if (editingId === fee.id) {
        resetForm();
      }
    } catch (deleteError) {
      setSubmitError(
        deleteError instanceof Error
          ? deleteError.message
          : "Gagal menghapus fee kategori.",
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Master fee kategori marketplace"
        description="Kelola biaya kategori Shopee dari dashboard agar update persentase fee tidak perlu rebuild extension. Jalur ini nanti menjadi sumber data untuk Kalkulator ROAS."
        actions={
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={!authorization || isLoading}
            className="rounded-full border border-white/12 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-sky-300/35 hover:text-sky-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? "Memuat..." : "Refresh"}
          </button>
        }
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="glass-card rounded-[1.75rem] border border-white/10 p-6 sm:p-7">
          <p className="text-sm text-sky-200/75">Total konfigurasi</p>
          <p className="mt-3 text-3xl font-semibold text-white">{fees.length}</p>
          <p className="mt-2 text-sm muted-text">
            Jumlah master fee kategori yang tersimpan untuk tenant aktif.
          </p>
        </div>
        <div className="glass-card rounded-[1.75rem] border border-white/10 p-6 sm:p-7">
          <p className="text-sm text-sky-200/75">Status aktif</p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {fees.filter((fee) => fee.isActive).length}
          </p>
          <p className="mt-2 text-sm muted-text">
            Hanya fee aktif yang nantinya akan dipakai sebagai opsi utama di extension.
          </p>
        </div>
        <div className="glass-card rounded-[1.75rem] border border-white/10 p-6 sm:p-7">
          <p className="text-sm text-sky-200/75">Fokus awal</p>
          <p className="mt-3 text-3xl font-semibold text-white">Shopee</p>
          <p className="mt-2 text-sm muted-text">
            Struktur ini sudah siap diperluas ke marketplace lain setelah jalur Shopee selesai.
          </p>
        </div>
      </section>

      <section className="glass-card rounded-[1.75rem] border border-white/10 p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {editingId ? "Edit fee kategori" : "Tambah fee kategori"}
            </h2>
            <p className="mt-2 text-sm leading-7 muted-text">
              Simpan kombinasi marketplace, jenis toko, kategori, dan persentase fee yang
              ingin digunakan sebagai referensi ROAS.
            </p>
          </div>
          {editingId ? (
            <button
              type="button"
              onClick={() => resetForm()}
              className="rounded-full border border-white/12 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-sky-300/35 hover:text-sky-100"
            >
              Batal Edit
            </button>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 grid gap-4 lg:grid-cols-3">
          <label className="block">
            <span className="text-sm text-slate-200">Marketplace</span>
            <select
              required
              value={form.marketplaceId}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  marketplaceId: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/40"
            >
              {marketplaces.map((marketplace) => (
                <option key={marketplace.id} value={marketplace.id}>
                  {marketplace.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm text-slate-200">Jenis toko</span>
            <select
              required
              value={form.storeType}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  storeType: event.target.value as StoreType,
                }))
              }
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/40"
            >
              <option value="NON_STAR">Non-Star</option>
              <option value="STAR">Star/Star+</option>
              <option value="MALL">Mall</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm text-slate-200">Fee (%)</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              required
              value={form.feePercent}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  feePercent: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/40"
              placeholder="Contoh: 10.20"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-200">Kategori utama</span>
            <input
              type="text"
              required
              value={form.primaryCategory}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  primaryCategory: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/40"
              placeholder="Contoh: Fashion"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-200">Sub kategori</span>
            <input
              type="text"
              value={form.secondaryCategory}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  secondaryCategory: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/40"
              placeholder="Contoh: Sepatu Pria"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-200">Nama kategori</span>
            <input
              type="text"
              required
              value={form.categoryName}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  categoryName: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/40"
              placeholder="Contoh: Aksesoris & Perawatan Sepatu"
            />
          </label>

          <label className="block lg:col-span-2">
            <span className="text-sm text-slate-200">Catatan</span>
            <input
              type="text"
              value={form.notes}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  notes: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/40"
              placeholder="Opsional: sumber, catatan perubahan, atau konteks biaya"
            />
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 lg:self-end">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  isActive: event.target.checked,
                }))
              }
            />
            <span className="text-sm text-slate-200">Aktifkan fee ini</span>
          </label>

          {submitError ? (
            <p className="rounded-2xl border border-rose-300/15 bg-rose-400/10 px-4 py-3 text-sm text-rose-100 lg:col-span-3">
              {submitError}
            </p>
          ) : null}

          <div className="lg:col-span-3">
            <button
              type="submit"
              disabled={!authorization || isSubmitting || !form.marketplaceId}
              className="rounded-full bg-sky-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting
                ? "Menyimpan..."
                : editingId
                  ? "Update Fee Kategori"
                  : "Simpan Fee Kategori"}
            </button>
          </div>
        </form>
      </section>

      <section className="glass-card rounded-[1.75rem] border border-white/10 p-6 sm:p-7">
        <div className="flex flex-wrap items-center gap-4">
          <label className="block min-w-[220px] flex-1">
            <span className="text-sm text-slate-200">Filter marketplace</span>
            <select
              value={marketplaceFilter}
              onChange={(event) => setMarketplaceFilter(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/40"
            >
              <option value="ALL">Semua marketplace</option>
              {marketplaces.map((marketplace) => (
                <option key={marketplace.id} value={marketplace.id}>
                  {marketplace.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block min-w-[220px] flex-1">
            <span className="text-sm text-slate-200">Filter jenis toko</span>
            <select
              value={storeTypeFilter}
              onChange={(event) =>
                setStoreTypeFilter(event.target.value as StoreType | "ALL")
              }
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/40"
            >
              <option value="ALL">Semua jenis toko</option>
              <option value="NON_STAR">Non-Star</option>
              <option value="STAR">Star/Star+</option>
              <option value="MALL">Mall</option>
            </select>
          </label>
        </div>
      </section>

      {error ? (
        <p className="rounded-[1.75rem] border border-rose-300/15 bg-rose-400/10 px-6 py-4 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      {filteredFees.length === 0 ? (
        <EmptyStatePanel
          title="Belum ada master fee kategori"
          description="Tambahkan data fee kategori Shopee terlebih dulu agar dashboard siap menjadi sumber konfigurasi untuk Kalkulator ROAS di extension."
          secondaryAction={{ label: "Kembali ke dashboard", href: "/app/dashboard" }}
        />
      ) : (
        <section className="grid gap-4">
          {filteredFees.map((fee) => (
            <div
              key={fee.id}
              className="glass-card rounded-[1.75rem] border border-white/10 p-6 sm:p-7"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-sky-200/65">
                    {fee.marketplace.name} · {getStoreTypeLabel(fee.storeType)}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-white">
                    {fee.categoryName}
                  </h3>
                  <p className="mt-2 text-sm muted-text">
                    {fee.primaryCategory}
                    {fee.secondaryCategory ? ` / ${fee.secondaryCategory}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-4 py-2 text-xs font-semibold tracking-wide ${
                      fee.isActive
                        ? "border border-emerald-300/20 bg-emerald-400/10 text-emerald-100"
                        : "border border-white/12 text-slate-200"
                    }`}
                  >
                    {fee.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                  <span className="rounded-full border border-sky-300/20 bg-sky-400/10 px-4 py-2 text-xs font-semibold tracking-wide text-sky-100">
                    {formatPercent(fee.feePercent)}
                  </span>
                </div>
              </div>

              {fee.notes ? (
                <p className="mt-4 text-sm leading-7 muted-text">{fee.notes}</p>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => handleEdit(fee)}
                  className="rounded-full border border-white/12 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-sky-300/35 hover:text-sky-100"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void handleToggleStatus(fee)}
                  className="rounded-full border border-white/12 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-sky-300/35 hover:text-sky-100"
                >
                  {fee.isActive ? "Nonaktifkan" : "Aktifkan"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(fee)}
                  className="rounded-full border border-rose-300/20 px-4 py-2.5 text-sm font-medium text-rose-100 transition hover:bg-rose-400/10"
                >
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
