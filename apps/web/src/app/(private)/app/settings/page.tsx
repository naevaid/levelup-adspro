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
  gratisOngkirPctRegular: number;
  gratisOngkirCapRegular: number;
  gratisOngkirPctSpecial: number;
  gratisOngkirCapSpecial: number;
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
  gratisOngkirPctRegular: string;
  gratisOngkirCapRegular: string;
  gratisOngkirPctSpecial: string;
  gratisOngkirCapSpecial: string;
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
  gratisOngkirPctRegular: "",
  gratisOngkirCapRegular: "",
  gratisOngkirPctSpecial: "",
  gratisOngkirCapSpecial: "",
  notes: "",
  isActive: true,
};

const PAGE_SIZE = 20;
const SHOPEE_SEED_NOTE_PREFIX =
  /^Sumber:\s*Shopee artikel 15965,\s*berlaku 2025-01-01\.\s*/i;

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

function formatCurrency(value: number) {
  return `Rp${Math.round(value).toLocaleString("id-ID")}`;
}

function formatShippingFee(valuePct: number, capValue: number) {
  if (valuePct <= 0) {
    return "-";
  }

  const capText = capValue > 0 ? ` maks ${formatCurrency(capValue)}` : "";
  return `${formatPercent(valuePct)}${capText}`;
}

function formatFeeNotes(notes: string | null) {
  const normalized = notes?.trim() ?? "";
  if (!normalized) {
    return null;
  }

  const cleaned = normalized.replace(SHOPEE_SEED_NOTE_PREFIX, "").trim();
  if (!cleaned) {
    return null;
  }

  return cleaned.replace(/^Cakupan produk:\s*/i, "").replace(/^Cakupan:\s*/i, "").trim();
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<FeeFormState>(EMPTY_FORM);
  const [marketplaceFilter, setMarketplaceFilter] = useState<string>("ALL");
  const [storeTypeFilter, setStoreTypeFilter] = useState<StoreType | "ALL">("ALL");
  const [currentPage, setCurrentPage] = useState(1);

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

  const closeModal = useCallback(() => {
    resetForm();
    setIsModalOpen(false);
  }, [resetForm]);

  const openCreateModal = useCallback(() => {
    resetForm();
    setIsModalOpen(true);
  }, [resetForm]);

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

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredFees.length / PAGE_SIZE)),
    [filteredFees.length],
  );

  const paginatedFees = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredFees.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, filteredFees]);

  const pageRange = useMemo(() => {
    if (filteredFees.length === 0) {
      return { start: 0, end: 0 };
    }

    const start = (currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(start + PAGE_SIZE - 1, filteredFees.length);
    return { start, end };
  }, [currentPage, filteredFees.length]);

  useEffect(() => {
    setCurrentPage(1);
  }, [marketplaceFilter, storeTypeFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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
        gratisOngkirPctRegular: form.gratisOngkirPctRegular
          ? Number.parseFloat(form.gratisOngkirPctRegular)
          : 0,
        gratisOngkirCapRegular: form.gratisOngkirCapRegular
          ? Number.parseFloat(form.gratisOngkirCapRegular)
          : 0,
        gratisOngkirPctSpecial: form.gratisOngkirPctSpecial
          ? Number.parseFloat(form.gratisOngkirPctSpecial)
          : 0,
        gratisOngkirCapSpecial: form.gratisOngkirCapSpecial
          ? Number.parseFloat(form.gratisOngkirCapSpecial)
          : 0,
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
      closeModal();
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
    setIsModalOpen(true);
    setForm({
      marketplaceId: fee.marketplace.id,
      storeType: fee.storeType,
      primaryCategory: fee.primaryCategory,
      secondaryCategory: fee.secondaryCategory ?? "",
      categoryName: fee.categoryName,
      feePercent: fee.feePercent.toString(),
      gratisOngkirPctRegular: fee.gratisOngkirPctRegular.toString(),
      gratisOngkirCapRegular: fee.gratisOngkirCapRegular.toString(),
      gratisOngkirPctSpecial: fee.gratisOngkirPctSpecial.toString(),
      gratisOngkirCapSpecial: fee.gratisOngkirCapSpecial.toString(),
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
        closeModal();
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
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Data fee kategori</h2>
            <p className="mt-2 text-sm leading-7 muted-text">
              Gunakan tabel untuk meninjau semua master fee kategori. Tambah dan edit
              dilakukan lewat popup agar halaman tetap ringkas dan mudah dipindai.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            disabled={!authorization}
            className="rounded-full bg-sky-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Tambah Fee Kategori
          </button>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-sky-200/75">Tampilan utama</p>
            <p className="mt-2 text-sm text-slate-100">
              Tabel fee kategori memudahkan scan cepat antar marketplace, jenis toko,
              fee, dan status aktif.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-sky-200/75">Tambah & edit</p>
            <p className="mt-2 text-sm text-slate-100">
              Form tambah dan edit dibuka melalui modal popup agar fokus pengisian lebih
              nyaman tanpa membuat halaman panjang.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-sky-200/75">Aksi cepat</p>
            <p className="mt-2 text-sm text-slate-100">
              Aktivasi, nonaktifkan, dan hapus tetap tersedia langsung dari tabel.
            </p>
          </div>
        </div>
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
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-sm text-slate-100">
            Menampilkan <span className="font-semibold text-white">{pageRange.start}</span>
            {" - "}
            <span className="font-semibold text-white">{pageRange.end}</span> dari{" "}
            <span className="font-semibold text-white">{filteredFees.length}</span> data
            fee kategori.
          </p>
          <p className="text-sm muted-text">
            Halaman {currentPage} dari {totalPages}
          </p>
        </div>
      </section>

      {error ? (
        <p className="rounded-[1.75rem] border border-rose-300/15 bg-rose-400/10 px-6 py-4 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      {filteredFees.length === 0 ? (
        <section className="glass-card rounded-[1.75rem] border border-white/10 p-6 sm:p-7">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.28em] text-sky-200/65">
              Empty State
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
              Belum ada master fee kategori
            </h2>
            <p className="mt-3 text-sm leading-7 muted-text sm:text-base">
              Tambahkan data fee kategori Shopee terlebih dulu agar dashboard siap
              menjadi sumber konfigurasi untuk Kalkulator ROAS di extension.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {authorization ? (
              <button
                type="button"
                onClick={openCreateModal}
                className="rounded-full bg-sky-400 px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-sky-300"
              >
                Tambah Fee Kategori
              </button>
            ) : (
              <a
                href="/app/dashboard"
                className="rounded-full border border-white/12 px-5 py-3 text-sm font-medium text-slate-100 transition hover:border-sky-300/45 hover:text-sky-100"
              >
                Kembali ke dashboard
              </a>
            )}
          </div>
        </section>
      ) : (
        <section className="glass-card overflow-hidden rounded-[1.75rem] border border-white/10">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr className="text-left text-xs uppercase tracking-[0.24em] text-sky-200/70">
                  <th className="px-5 py-4 font-medium">Marketplace</th>
                  <th className="px-5 py-4 font-medium">Jenis Toko</th>
                  <th className="px-5 py-4 font-medium">Kategori</th>
                  <th className="px-5 py-4 font-medium">Fee Kategori</th>
                  <th className="px-5 py-4 font-medium">Ongkir Extra</th>
                  <th className="px-5 py-4 font-medium">Status</th>
                  <th className="px-5 py-4 font-medium">Catatan</th>
                  <th className="px-5 py-4 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {paginatedFees.map((fee) => (
                  <tr key={fee.id} className="align-top">
                    <td className="px-5 py-4 text-sm text-white">{fee.marketplace.name}</td>
                    <td className="px-5 py-4 text-sm text-slate-100">
                      {getStoreTypeLabel(fee.storeType)}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-white">{fee.categoryName}</p>
                      <p className="mt-1 text-sm muted-text">
                        {fee.primaryCategory}
                        {fee.secondaryCategory ? ` / ${fee.secondaryCategory}` : ""}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-sky-100">
                        {formatPercent(fee.feePercent)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-100">
                      <p>Biasa: {formatShippingFee(fee.gratisOngkirPctRegular, fee.gratisOngkirCapRegular)}</p>
                      <p className="mt-1 muted-text">
                        Khusus:{" "}
                        {formatShippingFee(
                          fee.gratisOngkirPctSpecial,
                          fee.gratisOngkirCapSpecial,
                        )}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide ${
                          fee.isActive
                            ? "border border-emerald-300/20 bg-emerald-400/10 text-emerald-100"
                            : "border border-white/12 text-slate-200"
                        }`}
                      >
                        {fee.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-100">
                      {formatFeeNotes(fee.notes) ? (
                        formatFeeNotes(fee.notes)
                      ) : (
                        <span className="muted-text">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(fee)}
                          className="rounded-full border border-white/12 px-3 py-2 text-sm font-medium text-slate-100 transition hover:border-sky-300/35 hover:text-sky-100"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggleStatus(fee)}
                          className="rounded-full border border-white/12 px-3 py-2 text-sm font-medium text-slate-100 transition hover:border-sky-300/35 hover:text-sky-100"
                        >
                          {fee.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(fee)}
                          className="rounded-full border border-rose-300/20 px-3 py-2 text-sm font-medium text-rose-100 transition hover:bg-rose-400/10"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-white/5 px-5 py-4">
            <p className="text-sm muted-text">
              Menampilkan {pageRange.start}-{pageRange.end} dari {filteredFees.length} data.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((previous) => Math.max(1, previous - 1))}
                disabled={currentPage === 1}
                className="rounded-full border border-white/12 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-sky-300/35 hover:text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Sebelumnya
              </button>
              <button
                type="button"
                onClick={() =>
                  setCurrentPage((previous) => Math.min(totalPages, previous + 1))
                }
                disabled={currentPage === totalPages}
                className="rounded-full border border-white/12 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-sky-300/35 hover:text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Berikutnya
              </button>
            </div>
          </div>
        </section>
      )}

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] border border-white/10 bg-slate-950/95 p-6 shadow-2xl shadow-slate-950/40 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-sky-200/65">
                  {editingId ? "Edit Fee Kategori" : "Tambah Fee Kategori"}
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  {editingId ? "Perbarui master fee kategori" : "Tambah master fee kategori baru"}
                </h2>
                <p className="mt-2 text-sm leading-7 muted-text">
                  Simpan kombinasi marketplace, jenis toko, kategori, dan persentase fee
                  untuk dipakai sebagai referensi ROAS.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full border border-white/12 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-sky-300/35 hover:text-sky-100"
              >
                Tutup
              </button>
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
                <span className="text-sm text-slate-200">Ongkir Extra Biasa (%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.gratisOngkirPctRegular}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      gratisOngkirPctRegular: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/40"
                  placeholder="Contoh: 5.50"
                />
              </label>

              <label className="block">
                <span className="text-sm text-slate-200">Cap Biasa (Rp)</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.gratisOngkirCapRegular}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      gratisOngkirCapRegular: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/40"
                  placeholder="Contoh: 40000"
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

              <label className="block">
                <span className="text-sm text-slate-200">Ongkir Extra Khusus (%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.gratisOngkirPctSpecial}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      gratisOngkirPctSpecial: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/40"
                  placeholder="Contoh: 7.00"
                />
              </label>

              <label className="block">
                <span className="text-sm text-slate-200">Cap Khusus (Rp)</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.gratisOngkirCapSpecial}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      gratisOngkirCapSpecial: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/40"
                  placeholder="Contoh: 60000"
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

              <div className="flex flex-wrap gap-3 lg:col-span-3">
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
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-full border border-white/12 px-6 py-3 text-sm font-medium text-slate-100 transition hover:border-sky-300/35 hover:text-sky-100"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
