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
              className="rounded-full border border-[#fb6a35]/12 bg-white px-4 py-2.5 text-sm font-medium text-[#9a3412] transition hover:border-[#fb6a35]/24 hover:bg-[#fff5ef]"
            >
              Kelola Toko
            </Link>
            <Link
              href="/app/team"
              className="rounded-full border border-[#fb6a35]/35 bg-[#fb6a35] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#f85a21]"
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
        <article className="glass-card rounded-[1.75rem] border border-[#fb6a35]/8 p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-[#9a3412]/70">
            Workspace Aktif
          </p>
          <h2 className="mt-4 text-2xl font-semibold text-[#111827]">
            {currentOrganization?.name ?? session?.activeOrganization.name}
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-[#fb6a35]/8 bg-[#fff8f5] p-4">
              <p className="text-sm text-[#9a3412]/75">Alamat Workspace</p>
              <p className="mt-2 text-lg font-semibold text-[#111827]">
                {currentOrganization?.slug ?? session?.activeOrganization.slug}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-[#fb6a35]/8 bg-[#fff8f5] p-4">
              <p className="text-sm text-[#9a3412]/75">Peran Anda</p>
              <p className="mt-2 text-lg font-semibold text-[#111827]">
                {profile?.membership.role ?? session?.membership.role}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-[#fb6a35]/8 bg-[#fff8f5] p-4">
              <p className="text-sm text-[#9a3412]/75">Status Workspace</p>
              <p className="mt-2 text-lg font-semibold text-[#111827]">
                {currentOrganization?.status ?? session?.activeOrganization.status}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-[#fb6a35]/8 bg-[#fff8f5] p-4">
              <p className="text-sm text-[#9a3412]/75">Status Login</p>
              <p className="mt-2 text-lg font-semibold text-[#111827]">
                {session ? "Masih aktif" : "Belum tersedia"}
              </p>
            </div>
          </div>
        </article>

        <article className="glass-card rounded-[1.75rem] border border-[#fb6a35]/8 p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-[#9a3412]/70">
            Langkah Berikutnya
          </p>
          <div className="mt-5 space-y-3">
            {nextActions.map((item, index) => (
              <div
                key={item}
                className="rounded-[1.5rem] border border-[#fb6a35]/8 bg-[#fff8f5] px-4 py-4"
              >
                <p className="text-xs uppercase tracking-[0.22em] text-[#9a3412]/65">
                  Saran 0{index + 1}
                </p>
                <p className="mt-2 text-sm leading-7 text-[#374151]">{item}</p>
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
