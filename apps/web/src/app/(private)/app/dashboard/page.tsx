"use client";

import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyStatePanel } from "@/components/shared/empty-state-panel";
import { StatCard } from "@/components/shared/stat-card";
import { useAuth } from "@/features/auth/auth-provider";

const workspaceHighlights = [
  {
    label: "Auth Flow",
    value: "Aktif",
    helper: "Signup, login, logout, dan me sudah terhubung ke backend fase 1.",
    badge: "wave 1",
  },
  {
    label: "Tenant Context",
    value: "1 Session",
    helper: "Session browser menyimpan organization aktif sesuai dokumen auth/tenant.",
    badge: "ready",
  },
  {
    label: "Navigation",
    value: "Core",
    helper: "Sidebar memakai menu inti dari UI information architecture v1.",
    badge: "ia",
  },
];

const nextActions = [
  "Tambah page domain untuk Shops dan Team pada fase berikutnya.",
  "Hubungkan dashboard KPI ke kontrak data backend setelah ingestion siap.",
  "Tambahkan organization switcher saat multi-organization flow dibuka.",
];

export default function DashboardPage() {
  const { session, currentOrganization, profile } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title={`Selamat datang, ${session?.user.name ?? "User"}`}
        description="Ini adalah private app shell wave 1. Fokusnya belum pada analytics final, tetapi pada autentikasi tenant, navigasi utama, dan workspace context yang konsisten."
        actions={
          <>
            <Link
              href="/app/market-research"
              className="rounded-full border border-white/12 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-sky-300/35 hover:text-sky-100"
            >
              Buka Market Research
            </Link>
            <Link
              href="/app/recommendations"
              className="rounded-full bg-sky-400 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-sky-300"
            >
              Lihat Recommendations
            </Link>
          </>
        }
      />

      <section className="grid gap-4 xl:grid-cols-3">
        {workspaceHighlights.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="glass-card rounded-[1.75rem] border border-white/10 p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-sky-200/65">
            Active Organization
          </p>
          <h2 className="mt-4 text-2xl font-semibold text-white">
            {currentOrganization?.name ?? session?.activeOrganization.name}
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-sky-200/70">Slug</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {currentOrganization?.slug ?? session?.activeOrganization.slug}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-sky-200/70">Role</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {profile?.membership.role ?? session?.membership.role}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-sky-200/70">Status</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {currentOrganization?.status ?? session?.activeOrganization.status}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-sky-200/70">User Session</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {session ? "Tersimpan di browser" : "Belum ada"}
              </p>
            </div>
          </div>
        </article>

        <article className="glass-card rounded-[1.75rem] border border-white/10 p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-sky-200/65">
            Fokus Berikutnya
          </p>
          <div className="mt-5 space-y-3">
            {nextActions.map((item, index) => (
              <div
                key={item}
                className="rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-4"
              >
                <p className="text-xs uppercase tracking-[0.22em] text-sky-200/60">
                  Step 0{index + 1}
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-100">{item}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <EmptyStatePanel
        title="Belum ada data analytics tenant"
        description="Ini sengaja mengikuti empty state fase awal. User sudah bisa login dan masuk dashboard walau shop, ingestion, dan analytics final belum tersedia."
        primaryAction={{
          label: "Buka Shops",
          href: "/app/shops",
        }}
        secondaryAction={{
          label: "Buka Team",
          href: "/app/team",
        }}
      />
    </div>
  );
}
