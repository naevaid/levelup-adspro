"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { EmptyStatePanel } from "@/components/shared/empty-state-panel";
import { useAuth } from "@/features/auth/auth-provider";
import type { InternalUserRole, MembershipRole } from "@/features/auth/types";

type NavigationItem = {
  label: string;
  href: string;
  roles: MembershipRole[];
  internalRoles?: InternalUserRole[];
  hideOnInternal?: boolean;
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
    label: "Internal Monitoring",
    href: "/app/internal-monitoring",
    roles: ["OWNER", "MANAGER", "AGENCY_ADMIN"],
  },
  {
    label: "Plan Management",
    href: "/app/internal-plans",
    roles: ["OWNER", "MANAGER", "STAFF", "AGENCY_ADMIN"],
    internalRoles: ["PLATFORM_ADMIN"],
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
    hideOnInternal: true,
  },
  {
    label: "Settings",
    href: "/app/settings",
    roles: ["OWNER", "AGENCY_ADMIN"],
    internalRoles: ["PLATFORM_ADMIN"],
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
    organizations,
    isRefreshingProfile,
    isSwitchingOrganization,
    profileError,
    clearSession,
    refreshProfile,
    switchOrganization,
  } = useAuth();

  useEffect(() => {
    if (isReady && !session) {
      router.replace("/login");
    }
  }, [isReady, router, session]);

  if (!isReady || (!session && isReady)) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-6 py-10">
        <div className="glass-card w-full max-w-xl rounded-[2rem] border border-white/14 p-8 text-center">
          <p className="text-[11px] uppercase tracking-[0.24em] text-sky-100/70">
            Memuat Workspace
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-white">
            Menyiapkan konteks tenant Anda.
          </h1>
          <p className="mt-2.5 text-sm leading-6 muted-text">
            Session browser sedang diperiksa sebelum halaman private dibuka.
          </p>
        </div>
      </main>
    );
  }

  const activeSession = session!;
  const role = activeSession.membership.role;
  const internalRole = activeSession.user.internalRole;
  const activeOrganization =
    currentOrganization ?? {
      ...activeSession.activeOrganization,
      currentMembership: activeSession.membership,
    };
  const activeOrganizationIsInternal = activeOrganization.isInternal;
  const visibleItems = navigationItems.filter((item) => {
    if (!item.roles.includes(role)) {
      return false;
    }

    if (activeOrganizationIsInternal && item.hideOnInternal) {
      return false;
    }

    if (!item.internalRoles?.length) {
      return true;
    }

    return internalRole ? item.internalRoles.includes(internalRole) : false;
  });
  const primaryItems = visibleItems.filter((item) => !item.internalRoles?.length);
  const internalItems = visibleItems.filter((item) => item.internalRoles?.length);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(186,230,253,0.16),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(191,219,254,0.12),_transparent_18%),linear-gradient(180deg,_rgba(25,49,78,0.98)_0%,_rgba(40,72,108,1)_100%)]">
      <div className="mx-auto grid min-h-screen w-full max-w-[1560px] gap-5 px-4 py-4 lg:grid-cols-[270px_minmax(0,1fr)] lg:px-5 lg:py-5">
        <aside className="glass-card rounded-[1.8rem] border border-white/14 p-4 lg:sticky lg:top-5 lg:flex lg:h-[calc(100vh-2.5rem)] lg:flex-col lg:overflow-hidden">
          <div className="shrink-0">
            <div className="flex items-center gap-3">
              <span className="status-dot" />
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-sky-100/70">
                  LevelUP adsPRO
                </p>
                <p className="mt-1 text-base font-semibold text-white">
                  {activeOrganization.name}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-[1.35rem] border border-white/14 bg-white/8 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-sky-100/70">
                Organization Context
              </p>
              <p className="mt-2 text-sm font-medium text-white">
                {activeOrganization.slug}
              </p>
              <p className="mt-2 text-sm muted-text">
                Role aktif: {role.toLowerCase().replace("_", " ")}
              </p>
              <p className="mt-2 text-sm muted-text">
                Workspace: {activeOrganizationIsInternal ? "Internal" : "Tenant"}
              </p>
              {internalRole ? (
                <p className="mt-2 text-sm text-sky-100/80">
                  Internal: {internalRole.toLowerCase().replace("_", " ")}
                </p>
              ) : null}

              {organizations.length > 1 ? (
                <label className="mt-4 block">
                  <span className="text-[11px] uppercase tracking-[0.2em] text-sky-100/70">
                    Switch Workspace
                  </span>
                  <select
                    value={activeOrganization.id}
                    onChange={(event) => {
                      void switchOrganization(event.target.value);
                    }}
                    disabled={isSwitchingOrganization}
                    className="mt-2 w-full rounded-2xl border border-white/12 bg-slate-950/45 px-3 py-2.5 text-sm text-white outline-none transition focus:border-sky-300/35 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {organizations.map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.name}
                        {organization.isInternal ? " (Internal)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          </div>

          <div
            className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            <nav className="space-y-1.5">
              {primaryItems.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? "border border-sky-200/35 bg-sky-200/15 text-white"
                        : "border border-transparent bg-transparent text-slate-100/90 hover:border-white/12 hover:bg-white/8"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {internalItems.length ? (
              <div className="mt-6 border-t border-white/12 pt-4">
                <p className="px-3 text-[11px] uppercase tracking-[0.2em] text-sky-100/70">
                  Internal
                </p>
                <nav className="mt-3 space-y-1.5">
                  {internalItems.map((item) => {
                    const isActive =
                      pathname === item.href || pathname.startsWith(`${item.href}/`);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`block rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                          isActive
                            ? "border border-sky-200/35 bg-sky-200/15 text-white"
                            : "border border-transparent bg-transparent text-slate-100/90 hover:border-white/12 hover:bg-white/8"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            ) : null}
          </div>

          <div className="mt-5 shrink-0 rounded-[1.35rem] border border-white/14 bg-white/7 p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-sky-100/70">
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
              className="mt-4 w-full rounded-full border border-white/16 bg-white/6 px-4 py-2.5 text-sm font-medium text-slate-50 transition hover:border-sky-200/55 hover:bg-white/10 hover:text-white"
            >
              Keluar
            </button>
          </div>
        </aside>

        <div className="flex min-h-screen flex-col gap-6">
          <section className="glass-card rounded-[1.8rem] border border-white/14 px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-sky-100/70">
                  Workspace
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
                  {activeOrganization.name}
                </h2>
                <p className="mt-2 text-sm muted-text">
                  {profile?.membership.role.toLowerCase().replace("_", " ")} aktif
                  pada workspace {activeOrganizationIsInternal ? "internal" : "tenant"}.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {organizations.length > 1 ? (
                  <span className="rounded-full border border-white/14 bg-white/6 px-4 py-2.5 text-sm text-slate-100">
                    {isSwitchingOrganization ? "Mengganti workspace..." : `${organizations.length} workspace`}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => void refreshProfile()}
                  className="rounded-full border border-white/16 bg-white/6 px-4 py-2.5 text-sm font-medium text-slate-50 transition hover:border-sky-200/55 hover:bg-white/10 hover:text-white"
                >
                  {isRefreshingProfile ? "Menyegarkan..." : "Refresh Context"}
                </button>
                <Link
                  href="/"
                  className="rounded-full bg-sky-300 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-sky-200"
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
