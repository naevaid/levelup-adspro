import Link from "next/link";

const trustBadges = [
  "Riset produk lebih rapi",
  "Insight iklan lebih cepat dibaca",
  "Satu dashboard untuk tim",
];

const featureCards = [
  {
    eyebrow: "Market Research",
    title: "Simpan temuan produk penting tanpa catat ulang satu per satu",
    description:
      "Rapikan hasil riset toko, market, dan produk ke dashboard agar shortlist kandidat lebih mudah dipantau dan dibandingkan.",
  },
  {
    eyebrow: "Ads Performance",
    title: "Lihat metrik iklan yang lebih mudah dipahami",
    description:
      "Pantau ACOS, ROAS, konversi, RPM, dan ringkasan performa iklan dalam tampilan yang lebih siap dipakai untuk ambil keputusan.",
  },
  {
    eyebrow: "Workspace",
    title: "Satu tempat untuk lanjut dari riset ke eksekusi",
    description:
      "Tim tidak perlu bolak-balik antar catatan dan halaman berbeda saat ingin melanjutkan analisis, evaluasi, atau shortlist produk.",
  },
];

const workflowSteps = [
  {
    step: "01",
    title: "Temukan peluang lebih cepat",
    description:
      "Kumpulkan insight produk dan iklan yang layak diperhatikan langsung dari alur kerja harian Anda.",
  },
  {
    step: "02",
    title: "Simpan data yang benar-benar penting",
    description:
      "Hasil penting masuk ke dashboard agar tidak tercecer dan tetap mudah dilihat lagi saat dibutuhkan.",
  },
  {
    step: "03",
    title: "Ambil keputusan dengan lebih tenang",
    description:
      "Gunakan ringkasan performa dan kalkulasi yang lebih jelas untuk menentukan langkah optimasi berikutnya.",
  },
];

const audiences = [
  "Owner brand yang ingin riset lebih cepat",
  "Tim operasional yang butuh dashboard rapi",
  "Advertiser yang ingin membaca performa dengan cepat",
  "Agency yang ingin alur kerja lebih konsisten",
];

const socialProof = [
  {
    value: "1 workspace",
    label: "untuk merapikan riset produk dan evaluasi iklan",
  },
  {
    value: "Lebih cepat",
    label: "membaca insight penting tanpa catatan yang tercecer",
  },
  {
    value: "Lebih nyaman",
    label: "untuk owner, tim operasional, advertiser, dan agency",
  },
];

const comparisonRows = [
  {
    aspect: "Mencatat hasil riset",
    manual: "Pindah-pindah tab, catatan, dan spreadsheet manual.",
    product: "Insight penting langsung tersusun di dashboard.",
  },
  {
    aspect: "Membaca performa iklan",
    manual: "Perlu cek angka satu per satu dan rawan salah baca konteks.",
    product: "Metrik inti lebih siap dibaca untuk evaluasi cepat.",
  },
  {
    aspect: "Lanjut ke keputusan",
    manual: "Tim perlu merapikan ulang data sebelum mengambil aksi.",
    product: "Workflow lanjut dari riset ke evaluasi terasa lebih singkat.",
  },
];

const plans = [
  {
    name: "Mulai Cepat",
    price: "Siap dipakai",
    description:
      "Cocok untuk pengguna yang ingin langsung mencoba workflow riset dan evaluasi yang lebih rapi.",
    bullets: [
      "Akses dashboard utama",
      "Simpan insight produk lebih tertata",
      "Lihat metrik iklan lebih mudah dipahami",
      "Mulai kerja dari satu workspace",
    ],
    cta: "Buat Workspace Baru",
  },
  {
    name: "Untuk Tim Aktif",
    price: "Lebih terarah",
    description:
      "Cocok untuk tim yang butuh alur kerja lebih konsisten saat mengelola insight produk dan iklan setiap hari.",
    bullets: [
      "Workflow riset lebih rapi",
      "Ringkasan performa lebih mudah dibaca",
      "Titik lanjut kerja tim lebih jelas",
      "Siap dipakai untuk evaluasi harian",
    ],
    cta: "Masuk ke Akun",
  },
];

const faqs = [
  {
    question: "Apa manfaat utama LevelUP adsPRO?",
    answer:
      "LevelUP adsPRO membantu Anda merapikan hasil riset produk, membaca performa iklan lebih cepat, dan melanjutkan analisis dari satu workspace yang lebih nyaman dipakai.",
  },
  {
    question: "Apakah saya bisa langsung mulai dari dashboard?",
    answer:
      "Ya. Setelah daftar atau masuk, Anda langsung diarahkan ke workspace untuk melanjutkan pekerjaan tanpa perlu memahami istilah teknis terlebih dahulu.",
  },
  {
    question: "Siapa yang paling cocok memakai platform ini?",
    answer:
      "Platform ini cocok untuk owner brand, tim operasional, advertiser, dan agency yang ingin workflow riset dan evaluasi lebih rapi.",
  },
  {
    question: "Apakah fitur Recommendations akan tersedia nanti?",
    answer:
      "Ya. Fitur itu sedang disiapkan dengan pendekatan yang lebih matang agar nantinya benar-benar memberi insight tambahan yang praktis dan menarik untuk pengguna.",
  },
];

export default function Home() {

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 sm:px-10 lg:px-12">
      <section className="glass-card overflow-hidden rounded-[2rem] border border-[#fb6a35]/8">
        <div className="grid gap-10 px-6 py-8 sm:px-8 lg:grid-cols-[1.35fr_0.95fr] lg:px-10 lg:py-10">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-3 rounded-full border border-[#fb6a35]/12 bg-[#fb6a35]/8 px-4 py-2 text-sm text-[#9a3412]">
              <span className="status-dot" />
              Riset produk dan iklan Shopee dalam satu workflow
            </div>

            <div className="space-y-5">
              <p className="text-sm uppercase tracking-[0.3em] text-[#9a3412]/75">
                LevelUP adsPRO
              </p>
              <h1 className="max-w-4xl text-xl leading-tight font-semibold tracking-tight text-[#111827] sm:text-2xl lg:text-3xl">
                Rapikan riset produk, pahami performa iklan, dan lanjutkan aksi
                dari satu dashboard.
              </h1>
              <p className="max-w-2xl text-sm leading-7 muted-text sm:text-base">
                LevelUP adsPRO membantu Anda menyimpan insight penting dari
                Seller Center, membaca metrik iklan lebih cepat, dan menjaga
                workflow tim tetap rapi tanpa bolak-balik catatan manual.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="rounded-full border border-[#fb6a35]/35 bg-[#fb6a35] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(251,106,53,0.16)] transition hover:bg-[#f85a21]"
              >
                Mulai Sekarang
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-[#fb6a35]/12 bg-white/80 px-5 py-3 text-sm font-semibold text-[#9a3412] transition hover:border-[#fb6a35]/22 hover:bg-[#fff5ef]"
              >
                Masuk ke Akun
              </Link>
            </div>

            <div className="flex flex-wrap gap-3">
              {trustBadges.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-[#fb6a35]/8 bg-white/72 px-4 py-2 text-sm text-[#9a3412]"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.75rem] border border-[#fb6a35]/10 bg-white/84 p-6">
              <p className="text-sm uppercase tracking-[0.24em] text-[#9a3412]/75">
                Ringkasan Manfaat
              </p>
              <div className="mt-5 grid gap-4">
                <div className="rounded-3xl border border-[#fb6a35]/8 bg-[#fff8f5] p-5">
                  <p className="text-sm text-[#9a3412]/75">Simpan Insight</p>
                  <p className="mt-2 text-xl font-semibold text-[#111827]">
                    Lebih tertata
                  </p>
                  <p className="mt-2 text-sm muted-text">
                    Temuan produk penting tetap mudah dicari saat Anda ingin
                    membandingkan peluang berikutnya.
                  </p>
                </div>
                <div className="rounded-3xl border border-[#fb6a35]/8 bg-[#fff8f5] p-5">
                  <p className="text-sm text-[#9a3412]/75">Baca Metrik</p>
                  <p className="mt-2 text-xl font-semibold text-[#111827]">
                    Lebih cepat paham
                  </p>
                  <p className="mt-2 text-sm muted-text">
                    ROAS, ACOS, konversi, dan metrik inti tampil lebih siap
                    dipakai untuk evaluasi.
                  </p>
                </div>
                <div className="rounded-3xl border border-[#fb6a35]/8 bg-[#fff8f5] p-5">
                  <p className="text-sm text-[#9a3412]/75">Kerja Tim</p>
                  <p className="mt-2 text-xl font-semibold text-[#111827]">
                    Lebih terarah
                  </p>
                  <p className="mt-2 text-sm muted-text">
                    Dashboard menjadi titik lanjut dari riset ke keputusan tanpa
                    harus merapikan ulang data secara manual.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 py-8 lg:grid-cols-3">
        {featureCards.map((item) => (
          <article
            key={item.title}
            className="glass-card rounded-[1.75rem] border border-[#fb6a35]/8 p-6"
          >
            <p className="text-sm uppercase tracking-[0.24em] text-[#9a3412]/75">
              {item.eyebrow}
            </p>
            <h2 className="mt-4 text-xl font-semibold tracking-tight text-[#111827] sm:text-2xl">
              {item.title}
            </h2>
            <p className="mt-4 text-sm leading-7 muted-text">{item.description}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 pb-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="glass-card rounded-[1.75rem] p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-[#9a3412]/75">
            Cara Kerja
          </p>
          <div className="mt-5 space-y-4">
            {workflowSteps.map((item) => (
              <div
                key={item.step}
                className="rounded-3xl border border-[#fb6a35]/8 bg-[#fff8f5] px-5 py-5"
              >
                <p className="text-xs uppercase tracking-[0.24em] text-[#9a3412]/65">
                  Langkah {item.step}
                </p>
                <h3 className="mt-3 text-lg font-semibold text-[#111827] sm:text-xl">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-7 muted-text">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-[1.75rem] p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-[#9a3412]/75">
            Cocok Untuk
          </p>
          <div className="mt-5 space-y-3">
            {audiences.map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-[#fb6a35]/8 bg-[#fff8f5] px-4 py-3"
              >
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#fb6a35]" />
                <p className="text-sm leading-7 text-[#374151]">{item}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[1.75rem] border border-[#fb6a35]/10 bg-[#fb6a35]/8 p-5">
            <p className="text-sm uppercase tracking-[0.24em] text-[#9a3412]/75">
              Siap Mulai
            </p>
            <h3 className="mt-3 text-xl font-semibold text-[#111827] sm:text-2xl">
              Buka workspace Anda dan mulai rapikan insight penting hari ini.
            </h3>
            <p className="mt-3 text-sm leading-7 text-[#7c2d12]">
              Masuk jika sudah punya akun, atau buat akun baru untuk mulai
              menyimpan temuan produk dan membaca performa iklan dengan lebih
              nyaman.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="rounded-full border border-[#fb6a35]/35 bg-[#fb6a35] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(251,106,53,0.16)] transition hover:bg-[#f85a21]"
              >
                Daftar Sekarang
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-[#fb6a35]/12 bg-white/80 px-5 py-3 text-sm font-semibold text-[#9a3412] transition hover:border-[#fb6a35]/22 hover:bg-[#fff5ef]"
              >
                Saya Sudah Punya Akun
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 pb-8 lg:grid-cols-3">
        {socialProof.map((item) => (
          <div
            key={item.value}
            className="glass-card rounded-[1.75rem] border border-[#fb6a35]/8 p-6"
          >
            <p className="text-2xl font-semibold text-[#111827] sm:text-3xl">{item.value}</p>
            <p className="mt-3 text-sm leading-7 muted-text">{item.label}</p>
          </div>
        ))}
      </section>

      <section className="glass-card rounded-[1.75rem] p-6 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[#9a3412]/75">
              Lebih Nyaman Dipakai
            </p>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
              Dari catatan manual ke workflow yang lebih rapi
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 muted-text">
              Saat insight tersebar di banyak tempat, keputusan jadi lebih
              lambat. LevelUP adsPRO membantu Anda membawa hasil riset dan
              evaluasi ke satu workspace yang lebih mudah ditindaklanjuti.
            </p>
          </div>
          <div className="space-y-4">
            {comparisonRows.map((item) => (
              <div
                key={item.aspect}
                className="rounded-[1.5rem] border border-[#fb6a35]/8 bg-[#fff8f5] p-5"
              >
                <p className="text-sm uppercase tracking-[0.2em] text-[#9a3412]/65">
                  {item.aspect}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[#fb6a35]/8 bg-white px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#9a3412]/65">
                      Cara Lama
                    </p>
                    <p className="mt-2 text-sm leading-7 text-[#4b5563]">
                      {item.manual}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#fb6a35]/10 bg-[#fb6a35]/8 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#9a3412]/75">
                      Dengan LevelUP adsPRO
                    </p>
                    <p className="mt-2 text-sm leading-7 text-[#7c2d12]">
                      {item.product}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 py-8 lg:grid-cols-2">
        {plans.map((plan) => (
          <article
            key={plan.name}
            className="glass-card rounded-[1.75rem] border border-[#fb6a35]/8 p-6 sm:p-8"
          >
            <p className="text-sm uppercase tracking-[0.24em] text-[#9a3412]/75">
              {plan.name}
            </p>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
              {plan.price}
            </h2>
            <p className="mt-4 text-sm leading-7 muted-text">{plan.description}</p>
            <div className="mt-6 space-y-3">
              {plan.bullets.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-2xl border border-[#fb6a35]/8 bg-[#fff8f5] px-4 py-3"
                >
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#fb6a35]" />
                  <p className="text-sm leading-7 text-[#374151]">{item}</p>
                </div>
              ))}
            </div>
            <Link
              href={plan.cta === "Buat Workspace Baru" ? "/signup" : "/login"}
              className="mt-6 inline-flex rounded-full border border-[#fb6a35]/35 bg-[#fb6a35] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(251,106,53,0.16)] transition hover:bg-[#f85a21]"
            >
              {plan.cta}
            </Link>
          </article>
        ))}
      </section>

      <section className="glass-card rounded-[1.75rem] p-6 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[#9a3412]/75">
              Pertanyaan Umum
            </p>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
              Jawaban singkat sebelum Anda mulai
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 muted-text">
              Kami rangkum pertanyaan yang paling sering muncul agar calon
              pengguna lebih cepat memahami manfaat produk dan arah fiturnya.
            </p>
          </div>
          <div className="space-y-4">
            {faqs.map((item) => (
              <div
                key={item.question}
                className="rounded-[1.5rem] border border-[#fb6a35]/8 bg-[#fff8f5] p-5"
              >
                <h3 className="text-base font-semibold text-[#111827] sm:text-lg">{item.question}</h3>
                <p className="mt-3 text-sm leading-7 muted-text">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-8">
        <div className="glass-card rounded-[2rem] border border-[#fb6a35]/10 bg-[#fb6a35]/8 px-6 py-8 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm uppercase tracking-[0.24em] text-[#9a3412]/75">
                Siap Mulai Hari Ini
              </p>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
                Buka workspace Anda dan buat alur riset serta evaluasi terasa
                lebih rapi.
              </h2>
              <p className="mt-4 text-sm leading-7 text-[#7c2d12]">
                Daftar sekarang untuk mulai menyimpan insight penting, membaca
                metrik iklan dengan lebih nyaman, dan melanjutkan keputusan dari
                satu dashboard.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="rounded-full border border-[#fb6a35]/35 bg-[#fb6a35] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(251,106,53,0.16)] transition hover:bg-[#f85a21]"
              >
                Daftar Sekarang
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-[#fb6a35]/12 bg-white/80 px-5 py-3 text-sm font-semibold text-[#9a3412] transition hover:border-[#fb6a35]/22 hover:bg-[#fff5ef]"
              >
                Masuk ke Akun
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="pb-10 pt-2">
        <div className="flex flex-col gap-3 rounded-[1.5rem] border border-[#fb6a35]/8 bg-white/75 px-5 py-4 text-sm text-[#4b5563] sm:flex-row sm:items-center sm:justify-between">
          <p>LevelUP adsPRO untuk riset produk dan evaluasi iklan yang lebih rapi.</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/privacy-policy"
              className="text-[#9a3412]/80 transition hover:text-[#9a3412]"
            >
              Kebijakan Privasi
            </Link>
            <Link
              href="/login"
              className="text-[#9a3412]/80 transition hover:text-[#9a3412]"
            >
              Masuk
            </Link>
            <Link
              href="/signup"
              className="text-[#9a3412]/80 transition hover:text-[#9a3412]"
            >
              Daftar
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
