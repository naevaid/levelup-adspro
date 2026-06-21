"use client";

import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyStatePanel } from "@/components/shared/empty-state-panel";
import { StatCard } from "@/components/shared/stat-card";
import { useAuth } from "@/features/auth/auth-provider";

const workspaceHighlights = [
  {
    label: "Akses Akun",
    value: "Siap",
    helper: "Anda sudah masuk dan bisa membuka seluruh menu sesuai peran yang aktif.",
    badge: "aktif",
  },
  {
    label: "Workspace Aktif",
    value: "Tersambung",
    helper: "Semua data dan menu yang tampil mengikuti workspace yang sedang Anda pilih.",
    badge: "siap",
  },
  {
    label: "Navigasi",
    value: "Mudah Diakses",
    helper: "Menu utama dirapikan agar perpindahan ke toko, tim, dan pengaturan lebih cepat.",
    badge: "baru",
  },
];

const nextActions = [
  "Tambahkan atau cek toko yang ingin Anda kelola dari menu Shops.",
  "Undang anggota tim jika workspace ini dikelola bersama.",
  "Lengkapi pengaturan dan paket sesuai kebutuhan operasional Anda.",
];

export default function DashboardPage() {
  const { session, currentOrganization, profile } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title={`Selamat datang, ${session?.user.name ?? "User"}`}
        description="Ringkasan singkat workspace Anda untuk mulai mengelola toko, tim, dan pengaturan dari satu tempat."
        actions={
          <>
            <Link
              href="/app/shops"
              className="rounded-full border border-white/12 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-sky-300/35 hover:text-sky-100"
            >
              Kelola Toko
            </Link>
            <Link
              href="/app/team"
              className="rounded-full bg-sky-400 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-sky-300"
            >
              Kelola Tim
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
            Workspace Aktif
          </p>
          <h2 className="mt-4 text-2xl font-semibold text-white">
            {currentOrganization?.name ?? session?.activeOrganization.name}
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-sky-200/70">Alamat Workspace</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {currentOrganization?.slug ?? session?.activeOrganization.slug}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-sky-200/70">Peran Anda</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {profile?.membership.role ?? session?.membership.role}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-sky-200/70">Status Workspace</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {currentOrganization?.status ?? session?.activeOrganization.status}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-sky-200/70">Status Login</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {session ? "Masih aktif" : "Belum tersedia"}
              </p>
            </div>
          </div>
        </article>

        <article className="glass-card rounded-[1.75rem] border border-white/10 p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-sky-200/65">
            Langkah Berikutnya
          </p>
          <div className="mt-5 space-y-3">
            {nextActions.map((item, index) => (
              <div
                key={item}
                className="rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-4"
              >
                <p className="text-xs uppercase tracking-[0.22em] text-sky-200/60">
                  Saran 0{index + 1}
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-100">{item}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <EmptyStatePanel
        title="Data performa belum tersedia"
        description="Tambahkan toko dan mulai proses sinkronisasi data agar ringkasan performa bisa tampil di dashboard ini."
        primaryAction={{
          label: "Kelola Toko",
          href: "/app/shops",
        }}
        secondaryAction={{
          label: "Kelola Tim",
          href: "/app/team",
        }}
      />
    </div>
  );
}
