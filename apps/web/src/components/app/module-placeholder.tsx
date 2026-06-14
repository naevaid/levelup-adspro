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
        title={`${title} masuk wave berikutnya`}
        description="Struktur navigasi dan app shell sudah aktif. Halaman ini sengaja dibuat sebagai placeholder terhubung agar fase implementasi berikutnya tinggal mengisi komponen domain sesuai dokumen."
        primaryAction={{
          label: primaryCtaLabel,
          href: "/app/dashboard",
        }}
        secondaryAction={{
          label: "Lihat Landing",
          href: "/",
        }}
      />
    </div>
  );
}
