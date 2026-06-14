"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { useAuth } from "@/features/auth/auth-provider";
import { apiFetch } from "@/lib/api";
import type { StoredAuthSession } from "@/features/auth/types";

export default function LoginPage() {
  const router = useRouter();
  const { isReady, session, saveSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isReady && session) {
      router.replace("/app/dashboard");
    }
  }, [isReady, router, session]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await apiFetch<StoredAuthSession>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
        }),
      });

      saveSession(response);
      router.push("/app/dashboard");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Login gagal. Coba lagi.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Masuk ke Workspace"
      title="Login untuk membuka dashboard tenant Anda."
      description="Flow ini mengikuti auth scope dashboard user pada fase 1: email, password, dan session aktif dengan tenant context."
      footer={
        <span>
          Belum punya akun?{" "}
          <Link href="/signup" className="text-sky-200 hover:text-sky-100">
            Buat organization baru
          </Link>
        </span>
      }
    >
      <div>
        <p className="text-sm uppercase tracking-[0.28em] text-sky-200/65">
          Login
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
          Akses private app
        </h2>
        <p className="mt-3 text-sm leading-7 muted-text">
          Gunakan akun yang sudah memiliki membership aktif di organization.
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

        <label className="block">
          <span className="text-sm text-slate-200">Password</span>
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

        {error ? (
          <p className="rounded-2xl border border-rose-300/15 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Sedang masuk..." : "Masuk ke Dashboard"}
        </button>
      </form>
    </AuthShell>
  );
}
