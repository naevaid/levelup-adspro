"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyStatePanel } from "@/components/shared/empty-state-panel";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/features/auth/auth-provider";
import type { MembershipRole } from "@/features/auth/types";
import { apiFetch } from "@/lib/api";

type MemberSummary = {
  id: string;
  role: MembershipRole;
  status: string;
  joinedAt: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    status: string;
  };
  invitedBy: {
    id: string;
    name: string;
    email: string;
  } | null;
};

type SubscriptionResponse = {
  data: {
    subscription: {
      status: string;
      plan_code: string;
      billing_interval: string;
      current_period_start: string | null;
      current_period_end: string | null;
      grace_period_end: string | null;
    };
    entitlements: {
      features: Record<string, unknown>;
      quotas: Record<string, unknown>;
    };
    usage: {
      active_shops: number;
      active_members: number;
    };
  };
};

const roleOptions: MembershipRole[] = ["MANAGER", "STAFF", "AGENCY_ADMIN"];

function formatRole(role: MembershipRole) {
  return role.toLowerCase().replaceAll("_", " ");
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function TeamPage() {
  const { isReady, session } = useAuth();
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionResponse["data"] | null>(null);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteRole, setInviteRole] = useState<MembershipRole>("STAFF");

  const authorization = useMemo(() => {
    if (!session) {
      return null;
    }

    return `${session.tokenType} ${session.accessToken}`;
  }, [session]);

  const activeRole = session?.membership.role ?? null;
  const hasAccess =
    activeRole === "OWNER" || activeRole === "MANAGER" || activeRole === "AGENCY_ADMIN";

  const memberLimit = useMemo(() => {
    const rawLimit = subscription?.entitlements.quotas.max_members;
    return typeof rawLimit === "number" ? rawLimit : null;
  }, [subscription]);

  const activeMembers = subscription?.usage.active_members ?? members.filter((member) => member.status === "ACTIVE").length;
  const seatsRemaining =
    typeof memberLimit === "number" ? Math.max(memberLimit - activeMembers, 0) : null;
  const limitReached =
    typeof memberLimit === "number" ? activeMembers >= memberLimit : false;

  const refresh = useCallback(async () => {
    if (!authorization) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [nextMembers, nextSubscription] = await Promise.all([
        apiFetch<MemberSummary[]>("/api/v1/organizations/current/members", {
          headers: { Authorization: authorization },
        }),
        apiFetch<SubscriptionResponse>("/api/v1/subscription", {
          headers: { Authorization: authorization },
        }),
      ]);

      setMembers(nextMembers);
      setSubscription(nextSubscription.data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Gagal memuat data anggota organization.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [authorization]);

  useEffect(() => {
    if (!isReady || !authorization || !hasAccess) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [authorization, hasAccess, isReady, refresh]);

  const resetInviteForm = () => {
    setInviteName("");
    setInviteEmail("");
    setInvitePassword("");
    setInviteRole("STAFF");
    setSubmitError(null);
  };

  const handleInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authorization) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const created = await apiFetch<MemberSummary>(
        "/api/v1/organizations/current/members/invite",
        {
          method: "POST",
          headers: { Authorization: authorization },
          body: JSON.stringify({
            name: inviteName || undefined,
            email: inviteEmail,
            password: invitePassword || undefined,
            role: inviteRole,
          }),
        },
      );

      setMembers((previous) => [...previous, created]);
      setSubscription((previous) =>
        previous
          ? {
              ...previous,
              usage: {
                ...previous.usage,
                active_members: previous.usage.active_members + 1,
              },
            }
          : previous,
      );
      resetInviteForm();
      setIsInviteOpen(false);
    } catch (inviteError) {
      setSubmitError(
        inviteError instanceof Error
          ? inviteError.message
          : "Gagal menambahkan anggota.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateRole = async (memberId: string, role: MembershipRole) => {
    if (!authorization) {
      return;
    }

    setUpdatingMemberId(memberId);
    setError(null);
    try {
      const updated = await apiFetch<MemberSummary>(
        `/api/v1/organizations/current/members/${memberId}`,
        {
          method: "PATCH",
          headers: { Authorization: authorization },
          body: JSON.stringify({ role }),
        },
      );

      setMembers((previous) =>
        previous.map((member) => (member.id === memberId ? updated : member)),
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Gagal memperbarui role anggota.",
      );
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const removeMember = async (memberId: string) => {
    if (!authorization) {
      return;
    }

    setUpdatingMemberId(memberId);
    setError(null);
    try {
      await apiFetch<{ ok: boolean; message: string }>(
        `/api/v1/organizations/current/members/${memberId}`,
        {
          method: "DELETE",
          headers: { Authorization: authorization },
        },
      );

      setMembers((previous) => previous.filter((member) => member.id !== memberId));
      setSubscription((previous) =>
        previous
          ? {
              ...previous,
              usage: {
                ...previous.usage,
                active_members: Math.max(previous.usage.active_members - 1, 0),
              },
            }
          : previous,
      );
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Gagal menghapus anggota.",
      );
    } finally {
      setUpdatingMemberId(null);
    }
  };

  if (isReady && session && !hasAccess) {
    return (
      <EmptyStatePanel
        title="Akses Team dibatasi"
        description="Halaman Team saat ini hanya dibuka untuk owner, manager, atau agency admin agar pengelolaan anggota dan seat subscription tetap terkendali."
        secondaryAction={{ label: "Kembali ke dashboard", href: "/app/dashboard" }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Team"
        title="Kelola anggota organization"
        description="Tambahkan anggota lewat modal popup dan pastikan jumlah seat tetap mengikuti batas subscription aktif organization."
        actions={
          <>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={!authorization || isLoading}
              className="rounded-full border border-white/12 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-sky-300/35 hover:text-sky-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? "Memuat..." : "Refresh"}
            </button>
            <button
              type="button"
              onClick={() => {
                resetInviteForm();
                setIsInviteOpen(true);
              }}
              disabled={!authorization || limitReached}
              className="rounded-full bg-sky-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Tambah Anggota
            </button>
          </>
        }
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="glass-card rounded-[1.75rem] border border-white/10 p-6 sm:p-7">
          <p className="text-xs uppercase tracking-[0.24em] text-sky-100/70">
            Plan Aktif
          </p>
          <h2 className="mt-3 text-xl font-semibold text-white">
            {subscription?.subscription.plan_code ?? "-"}
          </h2>
          <p className="mt-2 text-sm muted-text">
            Status subscription: {subscription?.subscription.status ?? "-"}
          </p>
        </div>

        <div className="glass-card rounded-[1.75rem] border border-white/10 p-6 sm:p-7">
          <p className="text-xs uppercase tracking-[0.24em] text-sky-100/70">
            Seat Anggota
          </p>
          <h2 className="mt-3 text-xl font-semibold text-white">
            {activeMembers}
            {typeof memberLimit === "number" ? ` / ${memberLimit}` : ""}
          </h2>
          <p className="mt-2 text-sm muted-text">
            {typeof seatsRemaining === "number"
              ? `${seatsRemaining} seat tersisa untuk anggota aktif.`
              : "Kuota anggota belum tersedia."}
          </p>
        </div>

        <div className="glass-card rounded-[1.75rem] border border-white/10 p-6 sm:p-7">
          <p className="text-xs uppercase tracking-[0.24em] text-sky-100/70">
            Aksi
          </p>
          <h2 className="mt-3 text-xl font-semibold text-white">
            {limitReached ? "Seat Penuh" : "Siap Menambah"}
          </h2>
          <p className="mt-2 text-sm muted-text">
            {limitReached
              ? "Upgrade plan bila ingin menambahkan anggota baru."
              : "Modal tambah anggota akan memvalidasi limit seat di backend."}
          </p>
        </div>
      </section>

      {error ? (
        <p className="rounded-[1.75rem] border border-rose-300/15 bg-rose-400/10 px-6 py-4 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      <section className="glass-card rounded-[1.75rem] border border-white/10 p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Daftar Anggota</h2>
            <p className="mt-2 text-sm leading-7 muted-text">
              Role owner tidak bisa diubah dari halaman ini. Role anggota lain bisa
              diperbarui tanpa melewati batas subscription aktif.
            </p>
          </div>
          <div className="rounded-full border border-white/12 px-4 py-2 text-xs font-semibold tracking-wide text-slate-100">
            {members.length} anggota tercatat
          </div>
        </div>

        {members.length === 0 ? (
          <div className="mt-6">
            <EmptyStatePanel
              title="Belum ada anggota"
              description="Tambahkan anggota pertama untuk mulai membagi akses organization ke tim Anda."
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {members.map((member) => {
              const isOwner = member.role === "OWNER";
              const isCurrentUser = member.user.id === session?.user.id;
              const isBusy = updatingMemberId === member.id;

              return (
                <div
                  key={member.id}
                  className="rounded-[1.5rem] border border-white/10 bg-slate-950/30 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-white">
                          {member.user.name}
                        </h3>
                        <span className="rounded-full border border-white/12 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-sky-100/75">
                          {formatRole(member.role)}
                        </span>
                        {isCurrentUser ? (
                          <span className="rounded-full border border-sky-300/25 bg-sky-400/10 px-3 py-1 text-[11px] font-medium text-sky-100">
                            Anda
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-slate-200">{member.user.email}</p>
                      <p className="mt-2 text-xs muted-text">
                        Bergabung: {formatDate(member.joinedAt || member.createdAt)}
                      </p>
                      <p className="mt-1 text-xs muted-text">
                        Ditambahkan oleh: {member.invitedBy?.name ?? "System"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <select
                        value={member.role}
                        onChange={(event) =>
                          void updateRole(member.id, event.target.value as MembershipRole)
                        }
                        disabled={!authorization || isOwner || isCurrentUser || isBusy}
                        className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-300/40 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {member.role === "OWNER" ? (
                          <option value="OWNER">OWNER</option>
                        ) : null}
                        {roleOptions.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => void removeMember(member.id)}
                        disabled={!authorization || isOwner || isCurrentUser || isBusy}
                        className="rounded-full border border-rose-300/20 bg-rose-400/10 px-4 py-2.5 text-sm font-medium text-rose-100 transition hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isBusy ? "Memproses..." : "Hapus"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {isInviteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm">
          <div className="glass-card w-full max-w-2xl rounded-[1.9rem] border border-white/14 p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-sky-100/70">
                  Team
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  Tambah Anggota Baru
                </h2>
                <p className="mt-2 text-sm leading-6 muted-text">
                  Jika email belum pernah terdaftar, isi nama dan password awal.
                  Jika email sudah punya akun, cukup email dan role saja.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsInviteOpen(false);
                  resetInviteForm();
                }}
                className="rounded-full border border-white/12 px-4 py-2 text-sm text-slate-100 transition hover:border-sky-300/35 hover:text-sky-100"
              >
                Tutup
              </button>
            </div>

            <form onSubmit={handleInvite} className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm text-slate-200">Nama</span>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(event) => setInviteName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/40"
                  placeholder="Nama anggota"
                />
              </label>

              <label className="block">
                <span className="text-sm text-slate-200">Email</span>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/40"
                  placeholder="nama@contoh.com"
                />
              </label>

              <label className="block">
                <span className="text-sm text-slate-200">Role</span>
                <select
                  value={inviteRole}
                  onChange={(event) =>
                    setInviteRole(event.target.value as MembershipRole)
                  }
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/40"
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm text-slate-200">
                  Password awal (opsional jika user sudah ada)
                </span>
                <input
                  type="password"
                  value={invitePassword}
                  onChange={(event) => setInvitePassword(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/40"
                  placeholder="Minimal 8 karakter"
                />
              </label>

              {submitError ? (
                <p className="rounded-2xl border border-rose-300/15 bg-rose-400/10 px-4 py-3 text-sm text-rose-100 sm:col-span-2">
                  {submitError}
                </p>
              ) : null}

              <div className="sm:col-span-2">
                <div className="rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm muted-text">
                  Seat aktif: {activeMembers}
                  {typeof memberLimit === "number" ? ` / ${memberLimit}` : ""}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 sm:col-span-2">
                <button
                  type="submit"
                  disabled={isSubmitting || limitReached}
                  className="rounded-full bg-sky-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Anggota"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsInviteOpen(false);
                    resetInviteForm();
                  }}
                  className="rounded-full border border-white/12 px-6 py-3 text-sm font-medium text-slate-100 transition hover:border-sky-300/35 hover:text-sky-100"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
