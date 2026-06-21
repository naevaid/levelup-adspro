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
      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="glass-card rounded-[2rem] border border-white/14 p-7 sm:p-8">
          <p className="text-[11px] uppercase tracking-[0.24em] text-sky-100/70">
            {eyebrow}
          </p>
          <h1 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 muted-text">
            {description}
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-white/14 bg-white/8 p-5">
              <p className="text-sm text-sky-100/75">Akses Aman</p>
              <p className="mt-2 text-base font-semibold text-white sm:text-lg">
                Satu akun, akses sesuai workspace
              </p>
              <p className="mt-2 text-sm leading-6 muted-text">
                Login Anda langsung mengikuti workspace yang sedang aktif.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/14 bg-white/8 p-5">
              <p className="text-sm text-sky-100/75">Siap Digunakan</p>
              <p className="mt-2 text-base font-semibold text-white sm:text-lg">
                Login, daftar, dan kelola akses
              </p>
              <p className="mt-2 text-sm leading-6 muted-text">
                Semua alur akun utama tersedia untuk mulai memakai produk.
              </p>
            </div>
          </div>

          <Link
            href="/"
            className="mt-8 inline-flex rounded-full border border-white/16 bg-white/6 px-5 py-2.5 text-sm font-medium text-slate-50 transition hover:border-sky-200/55 hover:bg-white/10 hover:text-white"
          >
            Kembali ke Landing
          </Link>
        </div>

        <div className="glass-card rounded-[2rem] border border-white/14 p-7 sm:p-8">
          {children}
          <div className="mt-8 border-t border-white/12 pt-6 text-sm muted-text">
            {footer}
          </div>
        </div>
      </section>
    </main>
  );
}
