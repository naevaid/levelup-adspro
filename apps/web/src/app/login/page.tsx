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
      eyebrow="Masuk ke LevelUP adsPRO"
      title="Masuk dan lanjutkan riset produk serta evaluasi iklan Anda."
      description="Akses kembali dashboard, insight tersimpan, dan workflow harian Anda dari satu tempat yang lebih rapi."
      footer={
        <span>
          Belum punya akun?{" "}
          <Link href="/signup" className="text-[#c2410c] hover:text-[#9a3412]">
            Daftar dan mulai sekarang
          </Link>
        </span>
      }
    >
      <div>
        <p className="text-sm uppercase tracking-[0.28em] text-[#9a3412]/70">
          Masuk
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
          Selamat datang kembali
        </h2>
        <p className="mt-3 text-sm leading-7 muted-text">
          Masuk untuk melihat shortlist produk, membaca performa iklan, dan
          melanjutkan analisis tanpa mulai dari nol.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <label className="block">
          <span className="text-sm text-[#374151]">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[#fb6a35]/12 bg-white px-4 py-3 text-sm text-[#111827] outline-none transition focus:border-[#fb6a35]/35"
            placeholder="owner@brandanda.com"
          />
        </label>

        <label className="block">
          <span className="flex items-center justify-between gap-3 text-sm text-[#374151]">
            <span>Password</span>
            <Link href="/forgot-password" className="text-[#c2410c] hover:text-[#9a3412]">
              Lupa Password?
            </Link>
          </span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[#fb6a35]/12 bg-white px-4 py-3 text-sm text-[#111827] outline-none transition focus:border-[#fb6a35]/35"
            placeholder="Minimal 8 karakter"
          />
        </label>

        {error ? (
          <p className="rounded-2xl border border-rose-300/18 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-[#fb6a35] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#f85a21] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Sedang masuk..." : "Masuk ke Workspace"}
        </button>
      </form>
    </AuthShell>
  );
}
