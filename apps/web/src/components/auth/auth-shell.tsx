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
        <div className="glass-card rounded-[2rem] border border-white/10 p-8 sm:p-10">
          <p className="text-xs uppercase tracking-[0.3em] text-sky-200/65">
            {eyebrow}
          </p>
          <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-8 muted-text sm:text-base">
            {description}
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-sky-200/70">Tenant-aware</p>
              <p className="mt-2 text-lg font-semibold text-white">
                Satu session, satu organization aktif
              </p>
              <p className="mt-2 text-sm leading-7 muted-text">
                Semua request private memakai konteks tenant dari session aktif.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-sky-200/70">Wave 1</p>
              <p className="mt-2 text-lg font-semibold text-white">
                Login, signup, dashboard shell
              </p>
              <p className="mt-2 text-sm leading-7 muted-text">
                Fondasi UI siap untuk melanjut ke dashboard, shops, dan team.
              </p>
            </div>
          </div>

          <Link
            href="/"
            className="mt-8 inline-flex rounded-full border border-white/12 px-5 py-3 text-sm font-medium text-slate-100 transition hover:border-sky-300/35 hover:text-sky-100"
          >
            Kembali ke Landing
          </Link>
        </div>

        <div className="glass-card rounded-[2rem] border border-white/10 p-8 sm:p-10">
          {children}
          <div className="mt-8 border-t border-white/10 pt-6 text-sm muted-text">
            {footer}
          </div>
        </div>
      </section>
    </main>
  );
}
