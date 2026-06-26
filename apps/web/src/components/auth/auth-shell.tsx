import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  footer: ReactNode;
  children: ReactNode;
};

export function AuthShell({
  eyebrow,
  title,
  description,
  footer,
  children,
}: AuthShellProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-center px-6 py-10 sm:px-10">
      <section className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="glass-card rounded-[2rem] border border-[#fb6a35]/14 p-7 sm:p-8">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#9a3412]/75">
            {eyebrow}
          </p>
          <h1 className="mt-4 max-w-2xl text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 muted-text">
            {description}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {["Market Research", "Ads Insight", "ROAS Review", "Workspace Tim"].map(
              (item) => (
                <span
                  key={item}
                  className="rounded-full border border-[#fb6a35]/12 bg-white/75 px-4 py-2 text-sm text-[#9a3412]"
                >
                  {item}
                </span>
              ),
            )}
          </div>

          <div className="mt-8 space-y-4">
            <div className="rounded-[1.5rem] border border-[#fb6a35]/12 bg-[#fff8f5] p-5">
              <p className="text-sm text-[#9a3412]/75">Masuk dan lanjutkan kerja</p>
              <p className="mt-2 text-base font-semibold text-[#111827] sm:text-lg">
                Semua insight penting tetap dekat dengan keputusan Anda
              </p>
              <p className="mt-2 text-sm leading-6 muted-text">
                Buka kembali shortlist produk, performa iklan, dan catatan penting
                tanpa harus merapikan semuanya dari awal.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-[#fb6a35]/16 bg-[#fb6a35]/8 p-5">
              <p className="text-sm text-[#9a3412]/75">Untuk pengguna harian</p>
              <p className="mt-2 text-base font-semibold text-[#111827] sm:text-lg">
                Tampilan dibuat agar Anda langsung paham apa yang perlu dilakukan
              </p>
              <p className="mt-2 text-sm leading-6 text-[#7c2d12]">
                Dari riset awal sampai evaluasi iklan, fokusnya adalah membantu
                Anda bergerak lebih cepat dan lebih yakin.
              </p>
            </div>
          </div>

          <div className="mt-8">
            <Link
              href="/"
              className="inline-flex rounded-full border border-[#fb6a35]/18 bg-white/80 px-5 py-2.5 text-sm font-medium text-[#9a3412] transition hover:border-[#fb6a35]/35 hover:bg-[#fff5ef]"
            >
              Kembali ke Beranda
            </Link>
          </div>
        </div>

        <div className="glass-card rounded-[2rem] border border-[#fb6a35]/14 p-7 sm:p-8">
          {children}
          <div className="mt-8 border-t border-[#fb6a35]/12 pt-6 text-sm muted-text">
            {footer}
          </div>
        </div>
      </section>

      <div className="mt-6 flex justify-center">
        <Link
          href="/privacy-policy"
          className="text-sm text-[#9a3412]/75 transition hover:text-[#9a3412]"
        >
          Kebijakan Privasi
        </Link>
      </div>
    </main>
  );
}
