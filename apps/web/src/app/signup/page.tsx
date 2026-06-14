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
      eyebrow="Buat Workspace Baru"
      title="Signup sekaligus membuat organization pertama."
      description="Flow ini mengikuti dokumen fase 1: sistem membuat user, organization pertama, membership role owner, lalu mengembalikan session aktif."
      footer={
        <span>
          Sudah punya akun?{" "}
          <Link href="/login" className="text-sky-200 hover:text-sky-100">
            Login di sini
          </Link>
        </span>
      }
    >
      <div>
        <p className="text-sm uppercase tracking-[0.28em] text-sky-200/65">
          Signup
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
          Buat tenant pertama
        </h2>
        <p className="mt-3 text-sm leading-7 muted-text">
          Setelah selesai, Anda langsung masuk sebagai owner di organization aktif.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <label className="block">
          <span className="text-sm text-slate-200">Nama</span>
          <input
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/40"
            placeholder="Amin M"
          />
        </label>

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

        <label className="block">
          <span className="text-sm text-slate-200">Nama Organization</span>
          <input
            type="text"
            required
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/40"
            placeholder="Naeva Performance Lab"
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
          {isSubmitting ? "Sedang membuat workspace..." : "Buat Account & Workspace"}
        </button>
      </form>
    </AuthShell>
  );
}
