"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { useAuth } from "@/features/auth/auth-provider";
import type { StoredAuthSession } from "@/features/auth/types";
import { apiFetch } from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();
  const { isReady, session, saveSession } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
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
      const response = await apiFetch<StoredAuthSession>("/api/v1/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          password,
          organizationName,
        }),
      });

      saveSession(response);
      router.push("/app/dashboard");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Signup gagal. Coba lagi.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Mulai dengan workspace baru"
      title="Buat akun dan mulai rapikan riset produk serta insight iklan Anda."
      description="Daftar sekali, lalu masuk ke workspace yang siap dipakai untuk menyimpan insight penting dan melanjutkan analisis harian."
      footer={
        <span>
          Sudah punya akun?{" "}
          <Link href="/login" className="text-[#c2410c] hover:text-[#9a3412]">
            Masuk di sini
          </Link>
        </span>
      }
    >
      <div>
        <p className="text-sm uppercase tracking-[0.28em] text-[#9a3412]/70">
          Daftar
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
          Siapkan workspace Anda
        </h2>
        <p className="mt-3 text-sm leading-7 muted-text">
          Setelah selesai, Anda bisa langsung masuk dan mulai bekerja dari
          dashboard yang lebih rapi dan mudah dibaca.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <label className="block">
          <span className="text-sm text-[#374151]">Nama</span>
          <input
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[#fb6a35]/12 bg-white px-4 py-3 text-sm text-[#111827] outline-none transition focus:border-[#fb6a35]/35"
            placeholder="Amin M"
          />
        </label>

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
          <span className="text-sm text-[#374151]">Password</span>
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

        <label className="block">
          <span className="text-sm text-[#374151]">Nama Bisnis / Tim</span>
          <input
            type="text"
            required
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[#fb6a35]/12 bg-white px-4 py-3 text-sm text-[#111827] outline-none transition focus:border-[#fb6a35]/35"
            placeholder="Nama brand atau tim Anda"
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
          {isSubmitting ? "Sedang membuat workspace..." : "Buat Akun & Workspace"}
        </button>
      </form>
    </AuthShell>
  );
}
