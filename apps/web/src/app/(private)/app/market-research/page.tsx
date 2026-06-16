"use client";

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

export default function MarketResearchPage() {
  const { isReady, session } = useAuth();
  const [batches, setBatches] = useState<IngestionBatchSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            Menampilkan maksimal 20 batch ingestion terbaru untuk organization aktif.
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
        <section className="grid gap-4">
          {batches.map((batch) => (
            <article
              key={batch.id}
              className="glass-card rounded-[1.75rem] border border-white/10 p-6 sm:p-7"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-sky-200/65">
                    {batch.marketplace} • {batch.captureMode}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    {batch.pageType}
                  </h2>
                  <p className="mt-2 text-sm muted-text">
                    Batch ID: {batch.id}
                  </p>
                </div>
                <span className="rounded-full border border-white/12 px-4 py-2 text-xs font-semibold tracking-wide text-slate-100">
                  {batch.status}
                </span>
              </div>

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
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
