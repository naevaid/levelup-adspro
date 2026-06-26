import Link from "next/link";
import { EmptyStatePanel } from "@/components/shared/empty-state-panel";
import { PageHeader } from "@/components/layout/page-header";

type ModulePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  primaryCtaLabel: string;
};

export function ModulePlaceholder({
  eyebrow,
  title,
  description,
  primaryCtaLabel,
}: ModulePlaceholderProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={
          <Link
            href="/app/dashboard"
            className="rounded-full border border-white/12 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-sky-300/35 hover:text-sky-100"
          >
            Kembali ke Dashboard
          </Link>
        }
      />
      <EmptyStatePanel
        title={`${eyebrow} segera hadir`}
        description="Kami sedang menyiapkan pengalaman yang lebih matang untuk fitur ini agar benar-benar nyaman dipakai. Nantikan insight, ringkasan, dan alur kerja yang lebih praktis di update berikutnya."
        primaryAction={{
          label: primaryCtaLabel,
          href: "/app/dashboard",
        }}
        secondaryAction={{
          label: "Lihat Beranda",
          href: "/",
        }}
      />
    </div>
  );
}
