import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kebijakan Privasi | LevelUP adsPRO",
  description:
    "Kebijakan privasi untuk website dan Chrome Extension LevelUP adsPRO.",
};

const collectedData = [
  {
    title: "Informasi identitas pribadi",
    description:
      "Kami dapat memproses alamat email dan informasi akun yang diperlukan untuk mengakses layanan LevelUP adsPRO.",
  },
  {
    title: "Informasi autentikasi",
    description:
      "Kami memproses data login, token sesi, dan metadata sesi untuk menjaga autentikasi aplikasi web dan Chrome extension tetap aman.",
  },
  {
    title: "Konten situs",
    description:
      "Chrome extension dapat membaca konten halaman marketplace yang didukung untuk mendeteksi konteks halaman dan mengirim data yang dipilih pengguna ke platform LevelUP adsPRO.",
  },
];

const extensionPermissions = [
  {
    title: "storage",
    description:
      "Digunakan untuk menyimpan pengaturan lokal, status sesi, pilihan toko, dan state extension agar pengalaman pengguna tetap konsisten.",
  },
  {
    title: "tabs",
    description:
      "Digunakan untuk membaca informasi tab aktif yang diperlukan untuk mendeteksi halaman yang didukung dan menjalankan sinkronisasi.",
  },
  {
    title: "activeTab",
    description:
      "Digunakan saat pengguna secara aktif meminta refresh status halaman atau sinkronisasi manual dari tab yang sedang dibuka.",
  },
  {
    title: "alarms",
    description:
      "Digunakan untuk mengirim heartbeat berkala agar sesi extension tetap aktif selama digunakan.",
  },
  {
    title: "host permissions",
    description:
      "Digunakan untuk mengakses backend LevelUP adsPRO dan halaman marketplace yang didukung agar login, deteksi halaman, dan sinkronisasi data dapat berjalan.",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8 sm:px-10 lg:px-12">
      <section className="glass-card overflow-hidden rounded-[2rem] border border-[#fb6a35]/8 p-8 sm:p-10">
        <div className="max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-3 rounded-full border border-[#fb6a35]/12 bg-[#fb6a35]/8 px-4 py-2 text-sm text-[#9a3412]">
            <span className="status-dot" />
            Dokumen publik untuk website dan Chrome Extension
          </div>

          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.3em] text-[#9a3412]/75">
              LevelUP adsPRO
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-[#111827] sm:text-4xl">
              Kebijakan Privasi
            </h1>
            <p className="max-w-3xl text-base leading-8 muted-text sm:text-lg">
              Halaman ini menjelaskan bagaimana LevelUP adsPRO mengumpulkan,
              menggunakan, dan melindungi data pengguna pada website dan Chrome
              extension kami.
            </p>
          </div>

          <div className="rounded-3xl border border-[#fb6a35]/8 bg-[#fff8f5] p-5 text-sm leading-7 text-[#374151]">
            <p>
              <span className="font-semibold text-[#111827]">
                Tujuan tunggal layanan:
              </span>{" "}
              membantu pengguna LevelUP adsPRO mendeteksi halaman marketplace
              yang didukung, mengelola sesi extension, dan menyinkronkan data
              halaman yang dipilih secara manual ke platform LevelUP adsPRO
              untuk kebutuhan operasional dan riset pasar.
            </p>
            <p className="mt-3 text-[#9a3412]/80">
              Pembaruan terakhir: 16 Juni 2026
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 py-8 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="glass-card rounded-[1.75rem] border border-[#fb6a35]/8 p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-[#9a3412]/75">
            Data Yang Diproses
          </p>
          <div className="mt-5 space-y-3">
            {collectedData.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-[#fb6a35]/8 bg-[#fff8f5] px-4 py-4"
              >
                <p className="text-base font-semibold text-[#111827]">
                  {item.title}
                </p>
                <p className="mt-2 text-sm leading-7 muted-text">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </article>

        <article className="glass-card rounded-[1.75rem] border border-[#fb6a35]/8 p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-[#9a3412]/75">
            Izin Extension
          </p>
          <div className="mt-5 space-y-3">
            {extensionPermissions.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-[#fb6a35]/8 bg-[#fff8f5] px-4 py-4"
              >
                <p className="font-mono text-sm text-[#9a3412]">{item.title}</p>
                <p className="mt-2 text-sm leading-7 muted-text">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-6 pb-8 lg:grid-cols-2">
        <article className="glass-card rounded-[1.75rem] border border-[#fb6a35]/8 p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-[#9a3412]/75">
            Penggunaan Data
          </p>
          <div className="mt-5 space-y-3 text-sm leading-7 text-[#374151]">
            <p className="rounded-2xl border border-[#fb6a35]/8 bg-[#fff8f5] px-4 py-3">
              Data digunakan hanya untuk menjalankan fungsi inti LevelUP
              adsPRO, termasuk login, pengelolaan sesi, deteksi halaman yang
              didukung, dan sinkronisasi data yang dipicu oleh pengguna.
            </p>
            <p className="rounded-2xl border border-[#fb6a35]/8 bg-[#fff8f5] px-4 py-3">
              Kami tidak menjual data pengguna dan tidak menggunakan data
              pengguna untuk tujuan yang tidak terkait dengan fungsi utama item
              ini.
            </p>
            <p className="rounded-2xl border border-[#fb6a35]/8 bg-[#fff8f5] px-4 py-3">
              Chrome extension tidak menggunakan remote code. Semua kode
              extension dibundel saat build dan didistribusikan sebagai bagian
              dari paket extension.
            </p>
          </div>
        </article>

        <article className="glass-card rounded-[1.75rem] border border-[#fb6a35]/8 p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-[#9a3412]/75">
            Cakupan Domain
          </p>
          <div className="mt-5 space-y-3 text-sm leading-7 text-[#374151]">
            <p className="rounded-2xl border border-[#fb6a35]/8 bg-[#fff8f5] px-4 py-3">
              Website publik dan kebijakan privasi:
              <br />
              <span className="font-mono text-[#9a3412]">
                https://adspro.naeva.id/privacy-policy
              </span>
            </p>
            <p className="rounded-2xl border border-[#fb6a35]/8 bg-[#fff8f5] px-4 py-3">
              Backend aplikasi:
              <br />
              <span className="font-mono text-[#9a3412]">
                https://adspro.naeva.id/api/*
              </span>
            </p>
            <p className="rounded-2xl border border-[#fb6a35]/8 bg-[#fff8f5] px-4 py-3">
              Domain marketplace yang didukung extension mencakup Shopee dan
              TikTok sesuai `manifest.json`.
            </p>
          </div>
        </article>
      </section>

      <section className="pb-8">
        <div className="glass-card rounded-[1.75rem] border border-[#fb6a35]/8 p-6 text-sm leading-7 text-[#374151]">
          <p className="text-sm uppercase tracking-[0.24em] text-[#9a3412]/75">
            Tautan Publik
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-full border border-[#fb6a35]/12 bg-white/80 px-4 py-2 font-semibold text-[#9a3412] transition hover:border-[#fb6a35]/22 hover:bg-[#fff5ef]"
            >
              Kembali ke Landing Page
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-[#fb6a35]/12 bg-white/80 px-4 py-2 font-semibold text-[#9a3412] transition hover:border-[#fb6a35]/22 hover:bg-[#fff5ef]"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="rounded-full border border-[#fb6a35]/35 bg-[#fb6a35] px-4 py-2 font-semibold text-white transition hover:bg-[#f85a21]"
            >
              Buat Workspace
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
