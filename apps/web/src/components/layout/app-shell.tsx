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
    roles: ["OWNER", "MANAGER", "STAFF", "AGENCY_ADMIN"],
    internalRoles: ["PLATFORM_ADMIN"],
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

function formatWorkspaceLabel(name: string, isInternal?: boolean) {
  if (isInternal) {
    return "Internal";
  }

  return name;
}

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
        <div className="glass-card w-full max-w-xl rounded-[2rem] border border-[#fb6a35]/8 p-8 text-center">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#9a3412]/75">
            Memuat Workspace
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-[#111827]">
            Menyiapkan ruang kerja Anda.
          </h1>
          <p className="mt-2.5 text-sm leading-6 muted-text">
            Mohon tunggu sebentar, kami sedang memuat sesi dan akses Anda.
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,106,53,0.10),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.08),_transparent_18%),linear-gradient(180deg,_rgba(255,247,243,0.92)_0%,_rgba(255,250,248,0.96)_52%,_rgba(255,244,238,1)_100%)]">
      <div className="mx-auto grid min-h-screen w-full max-w-[1560px] gap-5 px-4 py-4 lg:grid-cols-[270px_minmax(0,1fr)] lg:px-5 lg:py-5">
        <aside className="glass-card rounded-[1.8rem] border border-[#fb6a35]/8 p-4 lg:sticky lg:top-5 lg:flex lg:h-[calc(100vh-2.5rem)] lg:flex-col lg:overflow-hidden">
          <div className="shrink-0 rounded-[1.35rem] border border-[#fb6a35]/8 bg-[#fff8f5] p-4">
            <div className="flex items-center gap-3">
              <span className="status-dot" />
              <div>
                <p className="text-base font-semibold text-[#111827]">LevelUP adsPRO</p>
                <p className="mt-1 text-sm text-[#9a3412]/75">
                  Grow Higher, Achieve More
                </p>
              </div>
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
                        ? "border border-[#fb6a35]/16 bg-[#fb6a35]/10 text-[#9a3412]"
                        : "border border-transparent bg-transparent text-[#4b5563] hover:border-[#fb6a35]/8 hover:bg-[#fff8f5]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {internalItems.length ? (
              <div className="mt-6 border-t border-[#fb6a35]/8 pt-4">
                <p className="px-3 text-[11px] uppercase tracking-[0.2em] text-[#9a3412]/70">
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
                            ? "border border-[#fb6a35]/16 bg-[#fb6a35]/10 text-[#9a3412]"
                            : "border border-transparent bg-transparent text-[#4b5563] hover:border-[#fb6a35]/8 hover:bg-[#fff8f5]"
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

          <div className="mt-5 shrink-0 rounded-[1.35rem] border border-[#fb6a35]/8 bg-[#fff8f5] p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#9a3412]/70">
              User
            </p>
            <p className="mt-2 text-sm font-medium text-[#111827]">
              {activeSession.user.name}
            </p>
            <p className="mt-1 text-sm muted-text">{activeSession.user.email}</p>
            <button
              type="button"
              onClick={() => {
                clearSession();
                router.replace("/login");
              }}
              className="mt-4 w-full rounded-full border border-[#fb6a35]/12 bg-white px-4 py-2.5 text-sm font-medium text-[#9a3412] transition hover:border-[#fb6a35]/24 hover:bg-[#fff5ef]"
            >
              Keluar
            </button>
          </div>
        </aside>

        <div className="flex min-h-screen flex-col gap-6">
          <section className="glass-card rounded-[1.8rem] border border-[#fb6a35]/8 px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.24em] text-[#9a3412]/70">
                  Workspace Aktif
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#111827] sm:text-2xl">
                  {activeOrganization.name}
                </h2>
                <p className="mt-2 text-sm muted-text">
                  Anda sedang masuk sebagai{" "}
                  {profile?.membership.role.toLowerCase().replace("_", " ")} di
                  workspace {activeOrganizationIsInternal ? "internal" : "tenant"}.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 sm:justify-end">
                {organizations.length > 1 ? (
                  <select
                    aria-label="Workspace aktif"
                    value={activeOrganization.id}
                    onChange={(event) => {
                      void switchOrganization(event.target.value);
                    }}
                    disabled={isSwitchingOrganization}
                    className="min-w-[180px] rounded-full border border-[#fb6a35]/12 bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#fb6a35]/24 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {organizations.map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {formatWorkspaceLabel(
                          organization.name,
                          organization.isInternal,
                        )}
                      </option>
                    ))}
                  </select>
                ) : null}
                <button
                  type="button"
                  onClick={() => void refreshProfile()}
                  className="rounded-full border border-[#fb6a35]/12 bg-white px-4 py-2.5 text-sm font-medium text-[#9a3412] transition hover:border-[#fb6a35]/24 hover:bg-[#fff5ef]"
                >
                  {isRefreshingProfile ? "Memuat ulang..." : "Muat Ulang Data"}
                </button>
                <Link
                  href="/"
                  className="rounded-full border border-[#fb6a35]/35 bg-[#fb6a35] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#f85a21]"
                >
                  Buka Beranda
                </Link>
              </div>
            </div>
          </section>

          {profileError ? (
            <EmptyStatePanel
              title="Informasi workspace belum berhasil dimuat"
              description={profileError}
              primaryAction={{
                label: "Coba Lagi",
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
