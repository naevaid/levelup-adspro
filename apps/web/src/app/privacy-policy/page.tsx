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
      <section className="glass-card overflow-hidden rounded-[2rem] p-8 sm:p-10">
        <div className="max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-sky-100">
            <span className="status-dot" />
            Dokumen publik untuk website dan Chrome Extension
          </div>

          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.3em] text-sky-200/70">
              LevelUP adsPRO
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Kebijakan Privasi
            </h1>
            <p className="max-w-3xl text-base leading-8 muted-text sm:text-lg">
              Halaman ini menjelaskan bagaimana LevelUP adsPRO mengumpulkan,
              menggunakan, dan melindungi data pengguna pada website dan Chrome
              extension kami.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/6 p-5 text-sm leading-7 text-slate-100">
            <p>
              <span className="font-semibold text-white">
                Tujuan tunggal layanan:
              </span>{" "}
              membantu pengguna LevelUP adsPRO mendeteksi halaman marketplace
              yang didukung, mengelola sesi extension, dan menyinkronkan data
              halaman yang dipilih secara manual ke platform LevelUP adsPRO
              untuk kebutuhan operasional dan riset pasar.
            </p>
            <p className="mt-3 muted-text">
              Pembaruan terakhir: 16 Juni 2026
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 py-8 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="glass-card rounded-[1.75rem] p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-sky-200/70">
            Data Yang Diproses
          </p>
          <div className="mt-5 space-y-3">
            {collectedData.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
              >
                <p className="text-base font-semibold text-white">
                  {item.title}
                </p>
                <p className="mt-2 text-sm leading-7 muted-text">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </article>

        <article className="glass-card rounded-[1.75rem] p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-sky-200/70">
            Izin Extension
          </p>
          <div className="mt-5 space-y-3">
            {extensionPermissions.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
              >
                <p className="font-mono text-sm text-white">{item.title}</p>
                <p className="mt-2 text-sm leading-7 muted-text">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-6 pb-8 lg:grid-cols-2">
        <article className="glass-card rounded-[1.75rem] p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-sky-200/70">
            Penggunaan Data
          </p>
          <div className="mt-5 space-y-3 text-sm leading-7 text-slate-100">
            <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              Data digunakan hanya untuk menjalankan fungsi inti LevelUP
              adsPRO, termasuk login, pengelolaan sesi, deteksi halaman yang
              didukung, dan sinkronisasi data yang dipicu oleh pengguna.
            </p>
            <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              Kami tidak menjual data pengguna dan tidak menggunakan data
              pengguna untuk tujuan yang tidak terkait dengan fungsi utama item
              ini.
            </p>
            <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              Chrome extension tidak menggunakan remote code. Semua kode
              extension dibundel saat build dan didistribusikan sebagai bagian
              dari paket extension.
            </p>
          </div>
        </article>

        <article className="glass-card rounded-[1.75rem] p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-sky-200/70">
            Cakupan Domain
          </p>
          <div className="mt-5 space-y-3 text-sm leading-7 text-slate-100">
            <p className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">
              Website publik dan kebijakan privasi:
              <br />
              <span className="font-mono text-sky-100">
                https://adspro.naeva.id/privacy-policy
              </span>
            </p>
            <p className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">
              Backend aplikasi:
              <br />
              <span className="font-mono text-sky-100">
                https://adspro.naeva.id/api/*
              </span>
            </p>
            <p className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">
              Domain marketplace yang didukung extension mencakup Shopee dan
              TikTok sesuai `manifest.json`.
            </p>
          </div>
        </article>
      </section>

      <section className="pb-8">
        <div className="glass-card rounded-[1.75rem] p-6 text-sm leading-7 text-slate-100">
          <p className="text-sm uppercase tracking-[0.24em] text-sky-200/70">
            Tautan Publik
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-full border border-white/12 px-4 py-2 font-semibold text-slate-100 transition hover:border-sky-300/35 hover:text-sky-100"
            >
              Kembali ke Landing Page
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-white/12 px-4 py-2 font-semibold text-slate-100 transition hover:border-sky-300/35 hover:text-sky-100"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-sky-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-sky-300"
            >
              Buat Workspace
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
