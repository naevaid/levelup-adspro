"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { apiFetch } from "@/lib/api";

type ForgotPasswordResponse = {
  ok: boolean;
  message: string;
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await apiFetch<ForgotPasswordResponse>(
        "/api/v1/auth/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({ email }),
        },
      );
      setSuccessMessage(response.message);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Permintaan reset password gagal. Coba lagi.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Lupa Password"
      title="Atur ulang password akun Anda."
      description="Masukkan email yang terdaftar. Kami akan mengirimkan tautan untuk membuat password baru."
      footer={
        <span>
          Sudah ingat password?{" "}
          <Link href="/login" className="text-sky-200 hover:text-sky-100">
            Kembali ke login
          </Link>
        </span>
      }
    >
      <div>
        <p className="text-sm uppercase tracking-[0.28em] text-sky-200/65">
          Reset Password
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
          Kirim tautan reset
        </h2>
        <p className="mt-3 text-sm leading-7 muted-text">
          Tautan reset akan dikirim ke email Anda dan hanya berlaku sementara.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <label className="block">
          <span className="text-sm text-slate-200">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/40"
            placeholder="owner@brandanda.com"
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
          disabled={isSubmitting}
          className="w-full rounded-full bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Mengirim tautan..." : "Kirim Tautan Reset"}
        </button>
      </form>
    </AuthShell>
  );
}
