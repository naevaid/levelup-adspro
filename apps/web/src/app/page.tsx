import Link from "next/link";

type ApiHealth = {
  appEnv?: string;
  port?: number;
  service: string;
  status: string;
};

async function getApiHealth(): Promise<{
  data: ApiHealth | null;
  error: string | null;
}> {
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

  try {
    const response = await fetch(`${apiBaseUrl}/health`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        data: null,
        error: `API merespons ${response.status}`,
      };
    }

    const data = (await response.json()) as ApiHealth;

    return {
      data,
      error: null,
    };
  } catch {
    return {
      data: null,
      error: "API belum aktif atau belum dapat dijangkau",
    };
  }
}

const checkpoints = [
  "Monorepo apps/web, apps/api, apps/worker sudah hidup",
  "Auth API fase 1 sudah tersedia: signup, login, logout, me, current organization",
  "Private app shell wave 1 sudah siap untuk dashboard tenant",
  "Deploy VPS, nginx, dan SSL domain adspro.naeva.id sudah aktif",
];

const nextSteps = [
  "Hubungkan dashboard ke kontrak data analytics setelah ingestion siap",
  "Tambahkan page domain Shops, Team, dan Market Research secara bertahap",
  "Buka multi-organization switcher setelah flow membership berkembang",
];

export default async function Home() {
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
  const { data, error } = await getApiHealth();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 sm:px-10 lg:px-12">
      <section className="glass-card overflow-hidden rounded-[2rem]">
        <div className="grid gap-10 px-6 py-8 sm:px-8 lg:grid-cols-[1.45fr_0.95fr] lg:px-10 lg:py-10">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-sky-100">
              <span className="status-dot" />
              Fase 1 identity and tenant foundation sedang aktif
            </div>

            <div className="space-y-5">
              <p className="text-sm uppercase tracking-[0.3em] text-sky-200/70">
                LevelUP adsPRO
              </p>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Tenant workspace sudah siap untuk signup, login, dan private app
                shell.
              </h1>
              <p className="max-w-2xl text-base leading-8 muted-text sm:text-lg">
                Sprint 0 bootstrap sudah selesai, backend auth fase 1 sudah
                terhubung, dan frontend kini punya jalur masuk ke dashboard
                tenant-aware sesuai roadmap dokumen.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="rounded-full bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300"
              >
                Buat Workspace Baru
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-white/12 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-sky-300/35 hover:text-sky-100"
              >
                Login
              </Link>
              <Link
                href="/app/dashboard"
                className="rounded-full border border-white/12 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-sky-300/35 hover:text-sky-100"
              >
                Buka App Shell
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/6 p-5">
                <p className="text-sm text-sky-200/70">Frontend Wave 1</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  Auth + App Shell
                </p>
                <p className="mt-2 text-sm muted-text">
                  Login, signup, sidebar, top bar, dashboard, dan placeholder
                  route inti.
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/6 p-5">
                <p className="text-sm text-sky-200/70">Backend Fase 1</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  Auth + Tenant API
                </p>
                <p className="mt-2 text-sm muted-text">
                  Signup, login, session bearer, `me`, dan current organization.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.75rem] border border-sky-300/18 bg-slate-950/55 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-sky-200/75">Status API</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {data ? "Terhubung" : "Menunggu"}
                  </p>
                </div>
                <div className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-sky-100">
                  {data?.status ?? "offline"}
                </div>
              </div>

              <div className="mt-6 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="muted-text">Base URL</span>
                  <span className="font-mono text-sky-100">{apiBaseUrl}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="muted-text">App Env</span>
                  <span className="font-mono text-sky-100">
                    {data?.appEnv ?? "belum terbaca"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="muted-text">Port</span>
                  <span className="font-mono text-sky-100">
                    {data?.port ?? 3001}
                  </span>
                </div>
              </div>

              <p className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm muted-text">
                {error ??
                  "Health endpoint API sudah merespons dan bisa dipakai sebagai baseline integrasi web."}
              </p>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-white/6 p-6">
              <p className="text-sm text-sky-200/75">Endpoint Penting</p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">
                  <p className="text-white">Public Landing</p>
                  <p className="mt-1 font-mono muted-text">
                    http://localhost:3000
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">
                  <p className="text-white">API Health</p>
                  <p className="mt-1 font-mono muted-text">
                    {apiBaseUrl}/health
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">
                  <p className="text-white">Auth Login</p>
                  <p className="mt-1 font-mono muted-text">
                    {apiBaseUrl}/api/v1/auth/login
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 py-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="glass-card rounded-[1.75rem] p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-sky-200/70">
            Checklist Fase Aktif
          </p>
          <div className="mt-5 space-y-3">
            {checkpoints.map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-sky-300" />
                <p className="text-sm leading-7 text-slate-100">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-[1.75rem] p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-sky-200/70">
            Fokus Berikutnya
          </p>
          <div className="mt-5 space-y-3">
            {nextSteps.map((item, index) => (
              <div
                key={item}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
              >
                <p className="text-xs uppercase tracking-[0.22em] text-sky-200/60">
                  Langkah 0{index + 1}
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-100">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
