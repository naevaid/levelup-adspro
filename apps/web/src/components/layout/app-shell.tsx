"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { EmptyStatePanel } from "@/components/shared/empty-state-panel";
import { useAuth } from "@/features/auth/auth-provider";
import type { MembershipRole } from "@/features/auth/types";

type NavigationItem = {
  label: string;
  href: string;
  roles: MembershipRole[];
};

const navigationItems: NavigationItem[] = [
  {
    label: "Dashboard",
    href: "/app/dashboard",
    roles: ["OWNER", "MANAGER", "STAFF", "AGENCY_ADMIN"],
  },
  {
    label: "Shops",
    href: "/app/shops",
    roles: ["OWNER", "MANAGER", "AGENCY_ADMIN"],
  },
  {
    label: "Market Research",
    href: "/app/market-research",
    roles: ["OWNER", "MANAGER", "STAFF", "AGENCY_ADMIN"],
  },
  {
    label: "Recommendations",
    href: "/app/recommendations",
    roles: ["OWNER", "MANAGER", "STAFF", "AGENCY_ADMIN"],
  },
  {
    label: "Team",
    href: "/app/team",
    roles: ["OWNER", "MANAGER", "AGENCY_ADMIN"],
  },
  {
    label: "Subscription",
    href: "/app/subscription",
    roles: ["OWNER", "AGENCY_ADMIN"],
  },
  {
    label: "Settings",
    href: "/app/settings",
    roles: ["OWNER", "AGENCY_ADMIN"],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    isReady,
    session,
    profile,
    currentOrganization,
    isRefreshingProfile,
    profileError,
    clearSession,
    refreshProfile,
  } = useAuth();

  useEffect(() => {
    if (isReady && !session) {
      router.replace("/login");
    }
  }, [isReady, router, session]);

  if (!isReady || (!session && isReady)) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-6 py-10">
        <div className="glass-card w-full max-w-xl rounded-[2rem] p-8 text-center">
          <p className="text-sm uppercase tracking-[0.28em] text-sky-200/65">
            Memuat Workspace
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-white">
            Menyiapkan konteks tenant Anda.
          </h1>
          <p className="mt-3 text-sm leading-7 muted-text">
            Session browser sedang diperiksa sebelum halaman private dibuka.
          </p>
        </div>
      </main>
    );
  }

  const activeSession = session!;
  const role = activeSession.membership.role;
  const visibleItems = navigationItems.filter((item) => item.roles.includes(role));

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_28%),linear-gradient(180deg,_rgba(8,17,31,0.98)_0%,_rgba(15,23,42,1)_100%)]">
      <div className="mx-auto grid min-h-screen w-full max-w-[1600px] gap-6 px-4 py-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-6 lg:py-6">
        <aside className="glass-card rounded-[2rem] border border-white/10 p-5 lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
          <div className="flex items-center gap-3">
            <span className="status-dot" />
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-sky-200/65">
                LevelUP adsPRO
              </p>
              <p className="mt-1 text-lg font-semibold text-white">
                {currentOrganization?.name ?? activeSession.activeOrganization.name}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-sky-200/65">
              Organization Context
            </p>
            <p className="mt-2 text-sm font-medium text-white">
              {currentOrganization?.slug ?? activeSession.activeOrganization.slug}
            </p>
            <p className="mt-2 text-sm muted-text">
              Role aktif: {role.toLowerCase().replace("_", " ")}
            </p>
          </div>

          <nav className="mt-6 space-y-2">
            {visibleItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? "border border-sky-300/20 bg-sky-400/12 text-sky-100"
                      : "border border-transparent bg-transparent text-slate-200 hover:border-white/10 hover:bg-white/6"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-sky-200/65">
              User
            </p>
            <p className="mt-2 text-sm font-medium text-white">
              {activeSession.user.name}
            </p>
            <p className="mt-1 text-sm muted-text">{activeSession.user.email}</p>
            <button
              type="button"
              onClick={() => {
                clearSession();
                router.replace("/login");
              }}
              className="mt-4 w-full rounded-full border border-white/12 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-sky-300/35 hover:text-sky-100"
            >
              Keluar
            </button>
          </div>
        </aside>

        <div className="flex min-h-screen flex-col gap-6">
          <section className="glass-card rounded-[2rem] border border-white/10 px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-sky-200/65">
                  Workspace
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                  {currentOrganization?.name ?? activeSession.activeOrganization.name}
                </h2>
                <p className="mt-2 text-sm muted-text">
                  {profile?.membership.role.toLowerCase().replace("_", " ")} aktif
                  dengan tenant context tunggal untuk semua halaman private.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void refreshProfile()}
                  className="rounded-full border border-white/12 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-sky-300/35 hover:text-sky-100"
                >
                  {isRefreshingProfile ? "Menyegarkan..." : "Refresh Context"}
                </button>
                <Link
                  href="/"
                  className="rounded-full bg-sky-400 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-sky-300"
                >
                  Landing
                </Link>
              </div>
            </div>
          </section>

          {profileError ? (
            <EmptyStatePanel
              title="Konteks tenant belum termuat sempurna"
              description={profileError}
              primaryAction={{
                label: "Coba Muat Ulang",
                href: pathname,
              }}
              secondaryAction={{
                label: "Kembali ke Login",
                href: "/login",
              }}
            />
          ) : null}

          <main className="flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
