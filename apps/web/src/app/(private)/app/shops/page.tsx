"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyStatePanel } from "@/components/shared/empty-state-panel";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api";

type MarketplaceSummary = {
  id: string;
  code: string;
  name: string;
};

type ShopSummary = {
  id: string;
  name: string | null;
  status: string;
  externalId: string;
  createdAt: string;
  marketplace: MarketplaceSummary;
};

export default function ShopsPage() {
  const { isReady, session } = useAuth();
  const [shops, setShops] = useState<ShopSummary[]>([]);
  const [marketplaces, setMarketplaces] = useState<MarketplaceSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [marketplaceId, setMarketplaceId] = useState<string>("");
  const [externalId, setExternalId] = useState("");
  const [shopName, setShopName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
      const [nextMarketplaces, nextShops] = await Promise.all([
        apiFetch<MarketplaceSummary[]>("/api/v1/marketplaces", {
          headers: { Authorization: authorization },
        }),
        apiFetch<ShopSummary[]>("/api/v1/shops", {
          headers: { Authorization: authorization },
        }),
      ]);

      setMarketplaces(nextMarketplaces);
      setShops(nextShops);
      setMarketplaceId((previous) => previous || nextMarketplaces[0]?.id || "");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Gagal memuat daftar shop.",
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authorization) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const created = await apiFetch<ShopSummary>("/api/v1/shops", {
        method: "POST",
        headers: { Authorization: authorization },
        body: JSON.stringify({
          marketplaceId,
          externalId,
          name: shopName || undefined,
        }),
      });

      setShops((previous) => [...previous, created]);
      setExternalId("");
      setShopName("");
    } catch (createError) {
      setSubmitError(
        createError instanceof Error
          ? createError.message
          : "Gagal membuat shop.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Shops"
        title="Kelola daftar shop organization"
        description="Fase Sprint 2: marketplace master + registrasi shop tenant-scoped, termasuk enforcement limit shop berdasarkan plan."
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

      <section className="glass-card rounded-[1.75rem] border border-white/10 p-6 sm:p-7">
        <h2 className="text-lg font-semibold text-white">Tambah Shop</h2>
        <p className="mt-2 text-sm leading-7 muted-text">
          Shop ditautkan ke marketplace master. External identifier ini nanti akan
          dipakai untuk connection/ingestion di sprint berikutnya.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 grid gap-4 lg:grid-cols-3">
          <label className="block">
            <span className="text-sm text-slate-200">Marketplace</span>
            <select
              required
              value={marketplaceId}
              onChange={(event) => setMarketplaceId(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/40"
            >
              {marketplaces.length === 0 ? (
                <option value="">Belum ada marketplace</option>
              ) : null}
              {marketplaces.map((marketplace) => (
                <option key={marketplace.id} value={marketplace.id}>
                  {marketplace.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm text-slate-200">External Identifier</span>
            <input
              type="text"
              required
              value={externalId}
              onChange={(event) => setExternalId(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/40"
              placeholder="Contoh: username / shop_id"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-200">Nama (opsional)</span>
            <input
              type="text"
              value={shopName}
              onChange={(event) => setShopName(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/40"
              placeholder="Misal: Shop Utama"
            />
          </label>

          {submitError ? (
            <p className="rounded-2xl border border-rose-300/15 bg-rose-400/10 px-4 py-3 text-sm text-rose-100 lg:col-span-3">
              {submitError}
            </p>
          ) : null}

          <div className="lg:col-span-3">
            <button
              type="submit"
              disabled={!authorization || isSubmitting}
              className="rounded-full bg-sky-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Menyimpan..." : "Simpan Shop"}
            </button>
          </div>
        </form>
      </section>

      {error ? (
        <p className="rounded-[1.75rem] border border-rose-300/15 bg-rose-400/10 px-6 py-4 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      {shops.length === 0 ? (
        <EmptyStatePanel
          title="Belum ada shop terdaftar"
          description="Tambahkan minimal 1 shop agar tenant siap masuk ke fase extension dan ingestion."
          secondaryAction={{ label: "Kembali ke dashboard", href: "/app/dashboard" }}
        />
      ) : (
        <section className="grid gap-4">
          {shops.map((shop) => (
            <div
              key={shop.id}
              className="glass-card rounded-[1.75rem] border border-white/10 p-6 sm:p-7"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-sky-200/65">
                    {shop.marketplace.name}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-white">
                    {shop.name || shop.externalId}
                  </h3>
                  <p className="mt-2 text-sm muted-text">
                    External ID: {shop.externalId}
                  </p>
                </div>
                <span className="rounded-full border border-white/12 px-4 py-2 text-xs font-semibold tracking-wide text-slate-100">
                  {shop.status}
                </span>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
