"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyStatePanel } from "@/components/shared/empty-state-panel";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api";

type IngestionBatchSummary = {
  id: string;
  status: string;
  captureMode: string;
  pageType: string;
  marketplace: string;
  payloadSchemaVersion: string;
  capturedAt: string;
  processedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  extensionSession: {
    id: string;
    deviceLabel: string;
    extensionVersion: string;
    status: string;
    expiresAt: string;
  };
  shop: {
    id: string;
    name: string | null;
    externalId: string;
    status: string;
    marketplace: {
      id: string;
      code: string;
      name: string;
    };
  } | null;
  rawPayloadObject: {
    id: string;
    storageKey: string;
    sizeBytes: number;
    retentionUntil: string;
    status: string;
  } | null;
  preview:
    | {
        type: "public_search";
        keyword: string | null;
        resultCount: number;
        pageTitle: string | null;
        topResults: Array<{
          position: number | null;
          productTitle: string | null;
          productUrl: string | null;
          imageUrl: string | null;
          shopName: string | null;
          priceMin: number | null;
          priceMax: number | null;
          salesHint: string | null;
          sold30d: number | null;
          ratingStar: number | null;
          reviewCount: number | null;
          listingCtime: number | null;
          revenue30dEstimate: number | null;
        }>;
      }
    | {
        type: "public_product";
        pageTitle: string | null;
        product: {
          productTitle: string | null;
          productUrl: string | null;
          imageUrl: string | null;
          shopName: string | null;
          priceMin: number | null;
          priceMax: number | null;
          salesHint: string | null;
          monthlySoldHint: string | null;
          ratingHint: string | null;
          reviewCountHint: string | null;
          monthlyRevenueHint: string | null;
          listingAgeHint: string | null;
          sold30d: number | null;
          ratingStar: number | null;
          reviewCount: number | null;
          listingCtime: number | null;
          revenue30dEstimate: number | null;
        } | null;
        salesHistory: {
          currentTotalSold: number | null;
          estimatedSold7d: number | null;
          estimatedSold15d: number | null;
          estimatedSold30d: number | null;
        } | null;
        highlights: string[];
      }
    | null;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("id-ID");
}

function formatSize(sizeBytes: number | null | undefined) {
  if (typeof sizeBytes !== "number" || !Number.isFinite(sizeBytes)) {
    return "-";
  }

  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  return `Rp${value.toLocaleString("id-ID")}`;
}

function formatUnits(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  return `${value.toLocaleString("id-ID")} unit`;
}

function formatPcs(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  return `${value.toLocaleString("id-ID")} pcs`;
}

function formatListingAgeFromCtime(ctimeSeconds: number | null | undefined) {
  if (typeof ctimeSeconds !== "number" || !Number.isFinite(ctimeSeconds)) {
    return "-";
  }

  const ageMs = Date.now() - ctimeSeconds * 1000;
  if (!Number.isFinite(ageMs) || ageMs < 0) {
    return "-";
  }

  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  if (ageDays <= 0) {
    return "Hari ini";
  }

  if (ageDays === 1) {
    return "1 hari";
  }

  return `${ageDays.toLocaleString("id-ID")} hari`;
}

function formatPriceRange(
  priceMin: number | null | undefined,
  priceMax: number | null | undefined,
) {
  if (
    typeof priceMin === "number" &&
    typeof priceMax === "number" &&
    Number.isFinite(priceMin) &&
    Number.isFinite(priceMax)
  ) {
    return priceMin === priceMax
      ? formatCurrency(priceMin)
      : `${formatCurrency(priceMin)} - ${formatCurrency(priceMax)}`;
  }

  if (typeof priceMin === "number" && Number.isFinite(priceMin)) {
    return formatCurrency(priceMin);
  }

  if (typeof priceMax === "number" && Number.isFinite(priceMax)) {
    return formatCurrency(priceMax);
  }

  return "-";
}

function countPreviewItemsWithSales(
  items: Array<{ salesHint: string | null; sold30d: number | null }>,
) {
  return items.filter(
    (item) => (item.sold30d ?? 0) > 0 || Boolean(item.salesHint),
  ).length;
}

function countPreviewItemsWithPrice(
  items: Array<{ priceMin: number | null; priceMax: number | null }>,
) {
  return items.filter(
    (item) =>
      typeof item.priceMin === "number" || typeof item.priceMax === "number",
  ).length;
}

const PAGE_SIZE = 5;

function formatCaptureMode(captureMode: string) {
  switch (captureMode.toLowerCase()) {
    case "public":
      return "Public Research";
    case "seller":
      return "Seller Center";
    default:
      return captureMode
        .replaceAll("_", " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
  }
}

function formatPageType(pageType: string) {
  switch (pageType.toLowerCase()) {
    case "shopee_public_product":
      return "Detail Produk Publik Shopee";
    case "shopee_public_search":
      return "Pencarian Publik Shopee";
    case "seller_product_detail":
      return "Detail Produk Seller";
    default:
      return pageType
        .replaceAll("_", " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
  }
}

function formatBatchStatus(status: string) {
  switch (status.toUpperCase()) {
    case "ACCEPTED":
      return "Diterima";
    case "PROCESSING":
      return "Diproses";
    case "COMPLETED":
      return "Selesai";
    case "FAILED":
      return "Gagal";
    default:
      return status
        .replaceAll("_", " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
  }
}

export default function MarketResearchPage() {
  const { isReady, session } = useAuth();
  const [batches, setBatches] = useState<IngestionBatchSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<IngestionBatchSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const authorization = useMemo(() => {
    if (!session) {
      return null;
    }

    return `${session.tokenType} ${session.accessToken}`;
  }, [session]);

  const refresh = useCallback(async () => {
    if (!authorization) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextBatches = await apiFetch<IngestionBatchSummary[]>(
        "/api/v1/ingestion/batches",
        {
          headers: { Authorization: authorization },
        },
      );
      setBatches(nextBatches);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Gagal memuat ingestion batches.",
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

  const totalPages = Math.max(1, Math.ceil(batches.length / PAGE_SIZE));
  const paginatedBatches = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return batches.slice(startIndex, startIndex + PAGE_SIZE);
  }, [batches, currentPage]);

  useEffect(() => {
    setCurrentPage((previous) => Math.min(previous, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (
      expandedBatchId &&
      !paginatedBatches.some((batch) => batch.id === expandedBatchId)
    ) {
      setExpandedBatchId(null);
    }
  }, [expandedBatchId, paginatedBatches]);

  const handleDelete = useCallback(async () => {
    if (!authorization || !deleteTarget) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      await apiFetch<{ success: boolean }>(
        `/api/v1/ingestion/batches/${deleteTarget.id}`,
        {
          method: "DELETE",
          headers: { Authorization: authorization },
        },
      );

      setBatches((previous) =>
        previous.filter((batch) => batch.id !== deleteTarget.id),
      );
      setExpandedBatchId((previous) =>
        previous === deleteTarget.id ? null : previous,
      );
      setDeleteTarget(null);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Gagal menghapus data market research.",
      );
    } finally {
      setIsDeleting(false);
    }
  }, [authorization, deleteTarget]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Market Research"
        title="Pantau ingestion batch terbaru"
        description="Halaman ini menjadi monitoring ringan untuk melihat hasil capture extension yang sudah masuk ke backend tenant Anda, sebelum workspace riset keyword penuh dibangun."
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
          <p className="text-sm text-sky-200/75">Total batch terlihat</p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {batches.length}
          </p>
          <p className="mt-2 text-sm muted-text">
            Menampilkan maksimal 20 batch ingestion terbaru untuk organization aktif,
            dengan pagination per {PAGE_SIZE} batch.
          </p>
        </div>
        <div className="glass-card rounded-[1.75rem] border border-white/10 p-6 sm:p-7">
          <p className="text-sm text-sky-200/75">Batch sukses</p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {batches.filter((batch) => batch.status === "ACCEPTED").length}
          </p>
          <p className="mt-2 text-sm muted-text">
            Batch yang diterima backend dan berhasil menyimpan raw payload awal.
          </p>
        </div>
        <div className="glass-card rounded-[1.75rem] border border-white/10 p-6 sm:p-7">
          <p className="text-sm text-sky-200/75">Batch gagal</p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {batches.filter((batch) => batch.status === "FAILED").length}
          </p>
          <p className="mt-2 text-sm muted-text">
            Gunakan daftar di bawah untuk melihat error code dan konteks batch.
          </p>
        </div>
      </section>

      {error ? (
        <p className="rounded-[1.75rem] border border-rose-300/15 bg-rose-400/10 px-6 py-4 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      {batches.length === 0 ? (
        <EmptyStatePanel
          title="Belum ada ingestion batch"
          description="Jalankan sync dari Chrome extension agar batch pertama muncul di sini. Halaman ini membantu observability sebelum data dinormalisasi ke workspace market research."
          secondaryAction={{ label: "Kembali ke dashboard", href: "/app/dashboard" }}
        />
      ) : (
        <section className="space-y-4">
          <div className="glass-card rounded-[1.75rem] border border-white/10 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-sky-200/75">Navigasi batch</p>
                <p className="mt-2 text-sm muted-text">
                  Buka satu batch untuk melihat detail. Saat batch lain dibuka, batch
                  sebelumnya otomatis ditutup.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((previous) => Math.max(1, previous - 1))}
                  disabled={currentPage === 1}
                  className="rounded-full border border-white/12 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-sky-300/35 hover:text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Sebelumnya
                </button>
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100">
                  Halaman {currentPage} / {totalPages}
                </span>
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
          </div>

          {paginatedBatches.map((batch) => {
            const isExpanded = expandedBatchId === batch.id;

            return (
            <article
              key={batch.id}
              className="glass-card rounded-[1.75rem] border border-white/10 p-6 sm:p-7"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-sky-200/65">
                    {batch.marketplace} • {formatCaptureMode(batch.captureMode)}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    {formatPageType(batch.pageType)}
                  </h2>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/12 px-3 py-1.5 text-xs text-slate-200">
                      Batch ID: {batch.id}
                    </span>
                    <span className="rounded-full border border-white/12 px-3 py-1.5 text-xs text-slate-200">
                      Captured: {formatDateTime(batch.capturedAt)}
                    </span>
                    <span className="rounded-full border border-white/12 px-3 py-1.5 text-xs text-slate-200">
                      Session: {batch.extensionSession.deviceLabel}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/12 px-4 py-2 text-xs font-semibold tracking-wide text-slate-100">
                    {formatBatchStatus(batch.status)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedBatchId((previous) =>
                        previous === batch.id ? null : batch.id,
                      )
                    }
                    className="rounded-full border border-sky-300/20 bg-sky-400/10 px-4 py-2 text-sm font-medium text-sky-100 transition hover:border-sky-300/35 hover:bg-sky-400/15"
                  >
                    {isExpanded ? "Tutup" : "Buka"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(batch)}
                    className="rounded-full border border-rose-300/20 px-4 py-2 text-sm font-medium text-rose-100 transition hover:bg-rose-400/10"
                  >
                    Hapus
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
                  Preview
                  <div className="mt-2 text-base font-semibold text-white">
                    {batch.preview?.type === "public_search"
                      ? "Riset Pencarian"
                      : batch.preview?.type === "public_product"
                        ? "Detail Produk"
                        : "Belum ada preview"}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
                  Shop Context
                  <div className="mt-2 text-base font-semibold text-white">
                    {batch.captureMode === "public"
                      ? "Public Capture"
                      : batch.shop?.name || batch.shop?.externalId || "-"}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
                  Raw Payload
                  <div className="mt-2 text-base font-semibold text-white">
                    {formatSize(batch.rawPayloadObject?.sizeBytes)}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
                  Storage
                  <div className="mt-2 line-clamp-1 text-sm font-semibold text-white">
                    {batch.rawPayloadObject?.storageKey ?? "-"}
                  </div>
                </div>
              </div>

              {isExpanded ? (
                <>
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-sky-200/75">Waktu</p>
                  <div className="mt-3 space-y-2 text-sm text-slate-100">
                    <p>Captured: {formatDateTime(batch.capturedAt)}</p>
                    <p>Created: {formatDateTime(batch.createdAt)}</p>
                    <p>Processed: {formatDateTime(batch.processedAt)}</p>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-sky-200/75">Extension Session</p>
                  <div className="mt-3 space-y-2 text-sm text-slate-100">
                    <p>Device: {batch.extensionSession.deviceLabel}</p>
                    <p>Version: {batch.extensionSession.extensionVersion}</p>
                    <p>Status: {batch.extensionSession.status}</p>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-sky-200/75">Shop Context</p>
                  <div className="mt-3 space-y-2 text-sm text-slate-100">
                    <p>
                      Shop:{" "}
                      {batch.captureMode === "public"
                        ? "Tidak dipakai untuk public research"
                        : batch.shop
                          ? batch.shop.name || batch.shop.externalId
                          : "Belum ada shop context"}
                    </p>
                    <p>
                      Marketplace:{" "}
                      {batch.shop ? batch.shop.marketplace.name : batch.marketplace}
                    </p>
                    <p>
                      Status:{" "}
                      {batch.captureMode === "public"
                        ? "Public capture"
                        : batch.shop?.status ?? "-"}
                    </p>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-sky-200/75">Raw Payload</p>
                  <div className="mt-3 space-y-2 text-sm text-slate-100">
                    <p>Status: {batch.rawPayloadObject?.status ?? "-"}</p>
                    <p>Size: {formatSize(batch.rawPayloadObject?.sizeBytes)}</p>
                    <p>
                      Retention:{" "}
                      {formatDateTime(batch.rawPayloadObject?.retentionUntil ?? null)}
                    </p>
                  </div>
                </div>
              </div>

              {batch.preview?.type === "public_search" ? (
                <div className="mt-4 rounded-[1.5rem] border border-sky-300/12 bg-slate-950/40 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-sky-200/75">
                        Preview Riset Pencarian
                      </p>
                      <h3 className="mt-2 text-lg font-semibold text-white">
                        {batch.preview.keyword || "Keyword belum terbaca"}
                      </h3>
                      <p className="mt-2 text-sm muted-text">
                        {batch.preview.pageTitle || "Judul halaman tidak tersedia"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
                      Top preview: {batch.preview.topResults.length} item
                      <br />
                      Result count: {batch.preview.resultCount}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
                      Produk dengan harga:
                      <div className="mt-2 text-xl font-semibold text-white">
                        {countPreviewItemsWithPrice(batch.preview.topResults)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
                      Ada sinyal terjual:
                      <div className="mt-2 text-xl font-semibold text-white">
                        {countPreviewItemsWithSales(batch.preview.topResults)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
                      Keyword:
                      <div className="mt-2 text-base font-semibold text-white">
                        {batch.preview.keyword || "-"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {batch.preview.topResults.map((result, index) => (
                      <article
                        key={`${batch.id}-${result.productUrl ?? index}`}
                        className="rounded-[1.25rem] border border-white/10 bg-white/5 p-3"
                      >
                        {result.imageUrl ? (
                          <img
                            src={result.imageUrl}
                            alt={result.productTitle ?? `Preview ${index + 1}`}
                            className="h-40 w-full rounded-2xl object-cover"
                          />
                        ) : (
                          <div className="flex h-40 w-full items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-900/50 text-xs text-slate-400">
                            Gambar belum tersedia
                          </div>
                        )}
                        <p className="mt-3 text-xs uppercase tracking-[0.22em] text-sky-200/65">
                          Urutan {result.position ?? index + 1}
                        </p>
                        <h4 className="mt-2 line-clamp-2 text-sm font-medium text-white">
                          {result.productTitle || "Judul produk belum terbaca"}
                        </h4>
                        <p className="mt-2 text-sm text-slate-200">
                          {formatPriceRange(result.priceMin, result.priceMax)}
                        </p>
                        <p className="mt-1 text-sm muted-text">
                          {result.shopName || "Toko belum terbaca"}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {result.salesHint || "Belum ada sinyal terjual"}
                        </p>
                        <div className="mt-3 grid gap-2 text-xs text-slate-300">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-400">Terjual 30 Hari</span>
                            <span className="font-medium text-slate-100">
                              {formatPcs(result.sold30d)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-400">Rating / Ulasan</span>
                            <span className="font-medium text-slate-100">
                              {typeof result.ratingStar === "number" &&
                              Number.isFinite(result.ratingStar) &&
                              typeof result.reviewCount === "number" &&
                              Number.isFinite(result.reviewCount)
                                ? `${result.ratingStar.toFixed(1)} / ${result.reviewCount.toLocaleString(
                                    "id-ID",
                                  )}`
                                : "-"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-400">Umur Listing</span>
                            <span className="font-medium text-slate-100">
                              {formatListingAgeFromCtime(result.listingCtime)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-400">Omset Kotor</span>
                            <span className="font-medium text-slate-100">
                              {formatCurrency(result.revenue30dEstimate)}
                            </span>
                          </div>
                        </div>
                        {result.productUrl ? (
                          <a
                            href={result.productUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-flex rounded-full border border-sky-300/15 bg-sky-400/10 px-3 py-1.5 text-xs font-medium text-sky-100 transition hover:border-sky-300/35 hover:bg-sky-400/15"
                          >
                            Buka Produk
                          </a>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}

              {batch.preview?.type === "public_product" ? (
                <div className="mt-4 rounded-[1.5rem] border border-sky-300/12 bg-slate-950/40 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-sky-200/75">
                        Preview Detail Produk
                      </p>
                      <p className="mt-2 text-sm muted-text">
                        {batch.preview.pageTitle || "Judul halaman produk tidak tersedia"}
                      </p>
                    </div>
                    {batch.preview.product?.productUrl ? (
                      <a
                        href={batch.preview.product.productUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex rounded-full border border-sky-300/15 bg-sky-400/10 px-4 py-2 text-sm font-medium text-sky-100 transition hover:border-sky-300/35 hover:bg-sky-400/15"
                      >
                        Buka Produk Asli
                      </a>
                    ) : null}
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
                    <div>
                      {batch.preview.product?.imageUrl ? (
                        <img
                          src={batch.preview.product.imageUrl}
                          alt={batch.preview.product.productTitle ?? "Produk"}
                          className="h-56 w-full rounded-[1.25rem] object-cover"
                        />
                      ) : (
                        <div className="flex h-56 w-full items-center justify-center rounded-[1.25rem] border border-dashed border-white/10 bg-slate-900/50 text-xs text-slate-400">
                          Gambar produk belum tersedia
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {batch.preview.product?.productTitle ||
                          batch.preview.pageTitle ||
                          "Detail produk belum terbaca"}
                      </h3>
                      <p className="mt-2 text-sm muted-text">
                        {batch.preview.product?.shopName || "Toko belum terbaca"}
                      </p>
                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
                          Harga
                          <div className="mt-2 text-base font-semibold text-white">
                            {formatPriceRange(
                              batch.preview.product?.priceMin,
                              batch.preview.product?.priceMax,
                            )}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
                          Terjual 30 Hari
                          <div className="mt-2 text-base font-semibold text-white">
                            {formatPcs(batch.preview.product?.sold30d)}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            {batch.preview.product?.salesHint || "-"}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
                          Rating / Ulasan
                          <div className="mt-2 text-base font-semibold text-white">
                            {typeof batch.preview.product?.ratingStar === "number" &&
                            Number.isFinite(batch.preview.product.ratingStar) &&
                            typeof batch.preview.product?.reviewCount === "number" &&
                            Number.isFinite(batch.preview.product.reviewCount)
                              ? `${batch.preview.product.ratingStar.toFixed(1)} / ${batch.preview.product.reviewCount.toLocaleString(
                                  "id-ID",
                                )}`
                              : batch.preview.product?.ratingHint || "-"}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            {batch.preview.product?.reviewCountHint || "-"}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
                          Umur Listing
                          <div className="mt-2 text-base font-semibold text-white">
                            {formatListingAgeFromCtime(
                              batch.preview.product?.listingCtime,
                            ) !== "-"
                              ? formatListingAgeFromCtime(
                                  batch.preview.product?.listingCtime,
                                )
                              : batch.preview.product?.listingAgeHint || "-"}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
                          Omset Kotor (30 Hari)
                          <div className="mt-2 text-base font-semibold text-white">
                            {formatCurrency(batch.preview.product?.revenue30dEstimate)}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            {batch.preview.product?.monthlyRevenueHint || "-"}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-emerald-300/12 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-50">
                          Estimasi 7 hari
                          <div className="mt-2 text-base font-semibold text-white">
                            {formatUnits(
                              batch.preview.salesHistory?.estimatedSold7d,
                            )}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-emerald-300/12 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-50">
                          Estimasi 15 hari
                          <div className="mt-2 text-base font-semibold text-white">
                            {formatUnits(
                              batch.preview.salesHistory?.estimatedSold15d,
                            )}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-emerald-300/12 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-50">
                          Estimasi 30 hari
                          <div className="mt-2 text-base font-semibold text-white">
                            {formatUnits(
                              batch.preview.salesHistory?.estimatedSold30d,
                            )}
                          </div>
                        </div>
                      </div>
                      {batch.preview.highlights.length > 0 ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {batch.preview.highlights.map((highlight) => (
                            <span
                              key={`${batch.id}-${highlight}`}
                              className="rounded-full border border-sky-300/12 bg-white/5 px-3 py-1.5 text-xs text-sky-100"
                            >
                              {highlight}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {batch.errorCode || batch.errorMessage ? (
                <p className="mt-4 rounded-2xl border border-rose-300/15 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  {batch.errorCode ? `${batch.errorCode}: ` : ""}
                  {batch.errorMessage ?? "Batch gagal diproses."}
                </p>
              ) : null}

              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-100">
                <p>Payload schema: {batch.payloadSchemaVersion}</p>
                <p className="mt-2 break-all muted-text">
                  Storage key: {batch.rawPayloadObject?.storageKey ?? "-"}
                </p>
              </div>
                </>
              ) : (
                <p className="mt-4 text-sm muted-text">
                  Klik <span className="text-slate-100">Buka</span> untuk melihat waktu
                  capture, extension session, shop context, raw payload, preview hasil,
                  dan detail error batch ini.
                </p>
              )}
            </article>
            );
          })}

          {totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    page === currentPage
                      ? "bg-sky-400 text-slate-950"
                      : "border border-white/12 text-slate-100 hover:border-sky-300/35 hover:text-sky-100"
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
          ) : null}
        </section>
      )}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-slate-950/95 p-6 shadow-2xl shadow-slate-950/40 sm:p-7">
            <p className="text-xs uppercase tracking-[0.28em] text-rose-200/70">
              Hapus Market Research
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              Yakin ingin menghapus batch ini?
            </h2>
            <p className="mt-3 text-sm leading-7 muted-text">
              Data market research yang dihapus tidak bisa dikembalikan. Raw payload
              terkait batch ini juga akan ikut dibersihkan.
            </p>
            <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-sm text-slate-100">
              <p>
                <span className="text-slate-400">Batch ID:</span> {deleteTarget.id}
              </p>
              <p className="mt-2">
                <span className="text-slate-400">Tipe halaman:</span>{" "}
                {formatPageType(deleteTarget.pageType)}
              </p>
              <p className="mt-2">
                <span className="text-slate-400">Captured:</span>{" "}
                {formatDateTime(deleteTarget.capturedAt)}
              </p>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="rounded-full border border-white/12 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-sky-300/35 hover:text-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={isDeleting}
                className="rounded-full border border-rose-300/20 bg-rose-400/10 px-5 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? "Menghapus..." : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
