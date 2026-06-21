"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { apiFetch } from "@/lib/api";

type ResetPasswordResponse = {
  ok: boolean;
  message: string;
};

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!token) {
      setError("Tautan reset password tidak valid.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Konfirmasi password belum sama.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiFetch<ResetPasswordResponse>(
        "/api/v1/auth/reset-password",
        {
          method: "POST",
          body: JSON.stringify({
            token,
            password,
          }),
        },
      );
      setSuccessMessage(response.message);
      setPassword("");
      setConfirmPassword("");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Reset password gagal. Coba lagi.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Password Baru"
      title="Buat password baru untuk akun Anda."
      description="Masukkan password baru minimal 8 karakter untuk melanjutkan login ke workspace."
      footer={
        <span>
          Sudah selesai?{" "}
          <Link href="/login" className="text-sky-200 hover:text-sky-100">
            Login sekarang
          </Link>
        </span>
      }
    >
      <div>
        <p className="text-sm uppercase tracking-[0.28em] text-sky-200/65">
          Reset Password
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
          Atur password baru
        </h2>
        <p className="mt-3 text-sm leading-7 muted-text">
          Setelah password diperbarui, Anda perlu login ulang di dashboard maupun extension.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <label className="block">
          <span className="text-sm text-slate-200">Password Baru</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/40"
            placeholder="Minimal 8 karakter"
          />
        </label>

        <label className="block">
          <span className="text-sm text-slate-200">Konfirmasi Password Baru</span>
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/40"
            placeholder="Ulangi password baru"
          />
        </label>

        {error ? (
          <p className="rounded-2xl border border-rose-300/15 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </p>
        ) : null}

        {successMessage ? (
          <p className="rounded-2xl border border-emerald-300/15 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
            {successMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || !token}
          className="w-full rounded-full bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Menyimpan password..." : "Simpan Password Baru"}
        </button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
