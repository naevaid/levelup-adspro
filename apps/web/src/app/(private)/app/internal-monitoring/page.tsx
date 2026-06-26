"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyStatePanel } from "@/components/shared/empty-state-panel";
import { useAuth } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api";

type MonitoringAlert = {
  code: "api_failure" | "ingestion_failure_spike" | "worker_stopped_risk";
  severity: "critical" | "warning";
  severityLevel: "sev_1" | "sev_2" | "sev_3";
  title: string;
  message: string;
  metric: {
    value: number | string;
    unit: "count" | "ratio" | "status" | "minutes";
  };
  operatorGuidance: {
    summary: string;
    firstChecks: string[];
    runbookRefs: string[];
  };
};

type MonitoringSummary = {
  status: "ok" | "degraded";
  generatedAt: string;
  readiness: {
    appEnv: string;
    port: number;
    service: string;
    status: "ok" | "degraded";
    dependencies: {
      database: {
        status: "up" | "down";
        latencyMs: number;
        error?: string | null;
      };
      redis: {
        status: "up" | "down";
        latencyMs: number;
        error?: string | null;
      };
    };
    queue: {
      transport: string;
      configured: boolean;
      status: "ready" | "degraded";
    };
  };
  alerts: MonitoringAlert[];
  severityMapping: Record<
    "sev_1" | "sev_2" | "sev_3",
    {
      label: string;
      description: string;
      responseExpectation: string;
    }
  >;
  operatorGuidance: {
    summary: string;
    nextActions: string[];
  };
  queue: {
    backlog: {
      accepted: number;
      processing: number;
      total: number;
    };
    transport: string;
    status: string;
  };
  ingestion: {
    recentWindowHours: number;
    recentCounts: {
      accepted: number;
      processing: number;
      completed: number;
      failed: number;
    };
    staleIndicators: {
      thresholdMinutes: number;
      acceptedOlderThanThreshold: number;
      processingOlderThanThreshold: number;
      total: number;
    };
    latestBatch:
      | {
          id: string;
          status: string;
          pageType: string;
          captureMode: string;
          createdAt: string;
          capturedAt: string;
          processedAt: string | null;
          errorCode: string | null;
          ageMinutes: number;
        }
      | null;
    latestProcessedBatch:
      | {
          id: string;
          status: string;
          processedAt: string | null;
          errorCode: string | null;
          ageMinutes: number | null;
        }
      | null;
    errorSummary: {
      failedLast24h: number;
      failureRateLast24h: number;
      topErrorCodes: Array<{
        errorCode: string;
        count: number;
      }>;
    };
  };
  activity: {
    activeExtensionSessions: number;
  };
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("id-ID");
}

function formatRatio(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatMetricValue(alert: MonitoringAlert) {
  if (alert.metric.unit === "ratio" && typeof alert.metric.value === "number") {
    return formatRatio(alert.metric.value);
  }

  if (alert.metric.unit === "minutes" && typeof alert.metric.value === "number") {
    return `${alert.metric.value} menit`;
  }

  return String(alert.metric.value);
}

function getStatusTone(status: string) {
  if (status === "ok" || status === "up" || status === "ready" || status === "idle") {
    return "border-emerald-300/20 bg-emerald-400/10 text-emerald-100";
  }

  if (status === "degraded" || status === "down") {
    return "border-rose-300/20 bg-rose-400/10 text-rose-100";
  }

  return "border-white/12 bg-white/5 text-slate-100";
}

export default function InternalMonitoringPage() {
  const { isReady, session } = useAuth();
  const [summary, setSummary] = useState<MonitoringSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authorization = useMemo(() => {
    if (!session) {
      return null;
    }

    return `${session.tokenType} ${session.accessToken}`;
  }, [session]);

  const hasAccess = session?.user.internalRole === "PLATFORM_ADMIN";

  const refresh = useCallback(async () => {
    if (!authorization || !hasAccess) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextSummary = await apiFetch<MonitoringSummary>(
        "/api/v1/internal/monitoring/summary",
        {
          headers: { Authorization: authorization },
        },
      );
      setSummary(nextSummary);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Gagal memuat internal monitoring summary.",
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

  if (isReady && session && !hasAccess) {
    return (
      <EmptyStatePanel
        title="Akses monitoring internal dibatasi"
        description="Halaman ini hanya dibuka untuk user internal dengan role platform admin agar monitoring operasional tetap berada di workspace internal."
        secondaryAction={{ label: "Kembali ke dashboard", href: "/app/dashboard" }}
      />
    );
  }

  const activeAlerts = summary?.alerts ?? [];
  const severityMapping = summary?.severityMapping ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Internal Monitoring"
        title="Pantau kesehatan API, queue, dan ingestion"
        description="Halaman ini mengubah endpoint monitoring internal menjadi workspace operasional yang lebih mudah dibaca. Fokusnya adalah alert aktif, readiness dependency, backlog queue, stale ingestion, dan guidance operator awal."
        actions={
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={!authorization || !hasAccess || isLoading}
            className="rounded-full border border-white/12 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-sky-300/35 hover:text-sky-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? "Memuat..." : "Refresh Monitoring"}
          </button>
        }
      />

      <section className="grid gap-4 lg:grid-cols-4">
        <div className="glass-card rounded-[1.75rem] border border-white/10 p-6 sm:p-7">
          <p className="text-sm text-sky-200/75">Status workspace</p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {summary?.status?.toUpperCase() ?? "-"}
          </p>
          <p className="mt-2 text-sm muted-text">
            Ringkasan health tenant dari API readiness, backlog queue, dan indikator ingestion.
          </p>
        </div>
        <div className="glass-card rounded-[1.75rem] border border-white/10 p-6 sm:p-7">
          <p className="text-sm text-sky-200/75">Alert aktif</p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {activeAlerts.length}
          </p>
          <p className="mt-2 text-sm muted-text">
            Alert operasional yang butuh tindakan berdasarkan severity mapping.
          </p>
        </div>
        <div className="glass-card rounded-[1.75rem] border border-white/10 p-6 sm:p-7">
          <p className="text-sm text-sky-200/75">Queue backlog</p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {summary?.queue.backlog.total ?? 0}
          </p>
          <p className="mt-2 text-sm muted-text">
            Total batch queue accepted dan processing yang masih tertahan.
          </p>
        </div>
        <div className="glass-card rounded-[1.75rem] border border-white/10 p-6 sm:p-7">
          <p className="text-sm text-sky-200/75">Extension session aktif</p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {summary?.activity.activeExtensionSessions ?? 0}
          </p>
          <p className="mt-2 text-sm muted-text">
            Jumlah extension session tenant yang masih aktif dan belum kedaluwarsa.
          </p>
        </div>
      </section>

      {error ? (
        <p className="rounded-[1.75rem] border border-rose-300/15 bg-rose-400/10 px-6 py-4 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      {summary ? (
        <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <article className="glass-card rounded-[1.75rem] border border-white/10 p-6 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-sky-200/65">
                  Alert Summary
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  {activeAlerts.length > 0 ? "Ada alert aktif" : "Tidak ada alert aktif"}
                </h2>
                <p className="mt-2 text-sm leading-7 muted-text">
                  {summary.operatorGuidance.summary}
                </p>
              </div>
              <div className="rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
                Generated:
                <div className="mt-2 font-semibold text-white">
                  {formatDateTime(summary.generatedAt)}
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {activeAlerts.length > 0 ? (
                activeAlerts.map((alert) => (
                  <article
                    key={alert.code}
                    className={`rounded-[1.5rem] border px-5 py-5 ${
                      alert.severity === "critical"
                        ? "border-rose-300/20 bg-rose-400/10"
                        : "border-amber-300/20 bg-amber-400/10"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-100/75">
                          {alert.severityLevel.replace("_", " ").toUpperCase()} ·{" "}
                          {alert.severity.toUpperCase()}
                        </p>
                        <h3 className="mt-2 text-lg font-semibold text-white">
                          {alert.title}
                        </h3>
                        <p className="mt-2 text-sm leading-7 text-slate-100/90">
                          {alert.message}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 text-sm text-slate-100">
                        Metric
                        <div className="mt-2 text-base font-semibold text-white">
                          {formatMetricValue(alert)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                      <p className="text-sm font-medium text-white">
                        Guidance
                      </p>
                      <p className="mt-2 text-sm leading-7 muted-text">
                        {alert.operatorGuidance.summary}
                      </p>
                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-sky-200/65">
                            First Checks
                          </p>
                          <div className="mt-3 space-y-2">
                            {alert.operatorGuidance.firstChecks.map((item) => (
                              <p
                                key={`${alert.code}-${item}`}
                                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100"
                              >
                                {item}
                              </p>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-sky-200/65">
                            Runbook Refs
                          </p>
                          <div className="mt-3 space-y-2">
                            {alert.operatorGuidance.runbookRefs.map((item) => (
                              <p
                                key={`${alert.code}-${item}`}
                                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100"
                              >
                                {item}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <EmptyStatePanel
                  title="Monitoring dalam kondisi tenang"
                  description="Belum ada alert aktif untuk tenant ini. Gunakan refresh berkala setelah deploy manual atau saat investigasi incident."
                  secondaryAction={{ label: "Kembali ke dashboard", href: "/app/dashboard" }}
                />
              )}
            </div>
          </article>

          <article className="glass-card rounded-[1.75rem] border border-white/10 p-6 sm:p-7">
            <p className="text-xs uppercase tracking-[0.28em] text-sky-200/65">
              Severity Mapping
            </p>
            <div className="mt-5 space-y-3">
              {severityMapping
                ? (Object.entries(severityMapping) as Array<
                    [keyof typeof severityMapping, (typeof severityMapping)[keyof typeof severityMapping]]
                  >).map(([key, item]) => (
                    <div
                      key={key}
                      className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4"
                    >
                      <p className="text-sm font-semibold text-white">{item.label}</p>
                      <p className="mt-2 text-sm leading-7 muted-text">
                        {item.description}
                      </p>
                      <p className="mt-3 text-xs uppercase tracking-[0.22em] text-sky-200/65">
                        Response
                      </p>
                      <p className="mt-2 text-sm text-slate-100">
                        {item.responseExpectation}
                      </p>
                    </div>
                  ))
                : null}
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-4">
              <p className="text-sm font-semibold text-white">
                Global Next Actions
              </p>
              <div className="mt-3 space-y-2">
                {summary.operatorGuidance.nextActions.map((item) => (
                  <p
                    key={item}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100"
                  >
                    {item}
                  </p>
                ))}
              </div>
            </div>
          </article>
        </section>
      ) : null}

      {summary ? (
        <>
          <section className="grid gap-6 xl:grid-cols-3">
            <article className="glass-card rounded-[1.75rem] border border-white/10 p-6 sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-sky-200/65">
                    Readiness
                  </p>
                  <h2 className="mt-3 text-xl font-semibold text-white">
                    API dan dependency inti
                  </h2>
                </div>
                <span
                  className={`rounded-full border px-4 py-2 text-xs font-semibold tracking-wide ${getStatusTone(summary.readiness.status)}`}
                >
                  {summary.readiness.status.toUpperCase()}
                </span>
              </div>
              <div className="mt-5 space-y-3">
                {[
                  {
                    label: "Database",
                    status: summary.readiness.dependencies.database.status,
                    latencyMs: summary.readiness.dependencies.database.latencyMs,
                    error: summary.readiness.dependencies.database.error,
                  },
                  {
                    label: "Redis",
                    status: summary.readiness.dependencies.redis.status,
                    latencyMs: summary.readiness.dependencies.redis.latencyMs,
                    error: summary.readiness.dependencies.redis.error,
                  },
                  {
                    label: "Queue",
                    status: summary.readiness.queue.status,
                    latencyMs: null,
                    error: null,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">{item.label}</p>
                      <span
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide ${getStatusTone(item.status)}`}
                      >
                        {item.status.toUpperCase()}
                      </span>
                    </div>
                    {typeof item.latencyMs === "number" ? (
                      <p className="mt-2 text-sm text-slate-100">
                        Latency: {item.latencyMs} ms
                      </p>
                    ) : null}
                    {item.error ? (
                      <p className="mt-2 text-sm text-rose-100">{item.error}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </article>

            <article className="glass-card rounded-[1.75rem] border border-white/10 p-6 sm:p-7">
              <p className="text-xs uppercase tracking-[0.28em] text-sky-200/65">
                Queue Health
              </p>
              <h2 className="mt-3 text-xl font-semibold text-white">
                Backlog dan transport worker
              </h2>
              <div className="mt-5 grid gap-3">
                <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-sky-200/75">Transport</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {summary.queue.transport}
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-sky-200/75">Status queue</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {summary.queue.status}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                    <p className="text-sm text-sky-200/75">Accepted</p>
                    <p className="mt-2 text-xl font-semibold text-white">
                      {summary.queue.backlog.accepted}
                    </p>
                  </div>
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                    <p className="text-sm text-sky-200/75">Processing</p>
                    <p className="mt-2 text-xl font-semibold text-white">
                      {summary.queue.backlog.processing}
                    </p>
                  </div>
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                    <p className="text-sm text-sky-200/75">Total</p>
                    <p className="mt-2 text-xl font-semibold text-white">
                      {summary.queue.backlog.total}
                    </p>
                  </div>
                </div>
              </div>
            </article>

            <article className="glass-card rounded-[1.75rem] border border-white/10 p-6 sm:p-7">
              <p className="text-xs uppercase tracking-[0.28em] text-sky-200/65">
                Ingestion Health
              </p>
              <h2 className="mt-3 text-xl font-semibold text-white">
                Failure dan stale indicators
              </h2>
              <div className="mt-5 space-y-3">
                <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-sky-200/75">Failed last 24h</p>
                  <p className="mt-2 text-xl font-semibold text-white">
                    {summary.ingestion.errorSummary.failedLast24h}
                  </p>
                  <p className="mt-2 text-sm muted-text">
                    Failure rate: {formatRatio(summary.ingestion.errorSummary.failureRateLast24h)}
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-sky-200/75">Stale indicators</p>
                  <p className="mt-2 text-xl font-semibold text-white">
                    {summary.ingestion.staleIndicators.total}
                  </p>
                  <p className="mt-2 text-sm muted-text">
                    Threshold {summary.ingestion.staleIndicators.thresholdMinutes} menit
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-sky-200/75">Latest processed batch</p>
                  <p className="mt-2 text-sm text-slate-100">
                    {summary.ingestion.latestProcessedBatch
                      ? `${summary.ingestion.latestProcessedBatch.id} · ${
                          summary.ingestion.latestProcessedBatch.ageMinutes ?? 0
                        } menit lalu`
                      : "Belum ada batch processed"}
                  </p>
                </div>
              </div>
            </article>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <article className="glass-card rounded-[1.75rem] border border-white/10 p-6 sm:p-7">
              <p className="text-xs uppercase tracking-[0.28em] text-sky-200/65">
                Recent Ingestion Counts
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {Object.entries(summary.ingestion.recentCounts).map(([key, value]) => (
                  <div
                    key={key}
                    className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4"
                  >
                    <p className="text-sm capitalize text-sky-200/75">{key}</p>
                    <p className="mt-2 text-xl font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-4">
                <p className="text-sm text-sky-200/75">
                  Window observasi: {summary.ingestion.recentWindowHours} jam
                </p>
                <p className="mt-2 text-sm muted-text">
                  Gunakan angka ini untuk memvalidasi spike error, backlog, dan kualitas jalur ingestion tenant.
                </p>
              </div>
            </article>

            <article className="glass-card rounded-[1.75rem] border border-white/10 p-6 sm:p-7">
              <p className="text-xs uppercase tracking-[0.28em] text-sky-200/65">
                Error Dominan
              </p>
              <div className="mt-5 space-y-3">
                {summary.ingestion.errorSummary.topErrorCodes.length > 0 ? (
                  summary.ingestion.errorSummary.topErrorCodes.map((item) => (
                    <div
                      key={`${item.errorCode}-${item.count}`}
                      className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-white">{item.errorCode}</p>
                        <span className="rounded-full border border-white/12 px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-100">
                          {item.count}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-sm text-slate-100">
                    Belum ada error code dominan dalam window observasi terbaru.
                  </p>
                )}
              </div>

              <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-4">
                <p className="text-sm font-medium text-white">Latest batch</p>
                <p className="mt-2 text-sm text-slate-100">
                  {summary.ingestion.latestBatch
                    ? `${summary.ingestion.latestBatch.id} · ${summary.ingestion.latestBatch.status} · ${summary.ingestion.latestBatch.ageMinutes} menit lalu`
                    : "Belum ada batch terbaru"}
                </p>
              </div>
            </article>
          </section>
        </>
      ) : !isLoading && !error ? (
        <EmptyStatePanel
          title="Monitoring summary belum termuat"
          description="Gunakan tombol refresh untuk mengambil data monitoring internal dari API tenant aktif."
          secondaryAction={{ label: "Kembali ke dashboard", href: "/app/dashboard" }}
        />
      ) : null}
    </div>
  );
}
