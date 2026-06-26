import Link from "next/link";

type EmptyStatePanelProps = {
  title: string;
  description: string;
  primaryAction?: {
    label: string;
    href: string;
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
};

export function EmptyStatePanel({
  title,
  description,
  primaryAction,
  secondaryAction,
}: EmptyStatePanelProps) {
  return (
    <section className="glass-card rounded-[1.75rem] border border-[#fb6a35]/8 p-5 sm:p-6">
      <div className="max-w-2xl">
        <p className="text-[11px] uppercase tracking-[0.24em] text-[#9a3412]/70">
          Belum Ada Data
        </p>
        <h2 className="mt-2.5 text-xl font-semibold tracking-tight text-[#111827] sm:text-2xl">
          {title}
        </h2>
        <p className="mt-2.5 text-sm leading-6 muted-text">
          {description}
        </p>
      </div>

      {(primaryAction || secondaryAction) && (
        <div className="mt-5 flex flex-wrap gap-2.5">
          {primaryAction ? (
            <Link
              href={primaryAction.href}
              className="rounded-full border border-[#fb6a35]/35 bg-[#fb6a35] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#f85a21]"
            >
              {primaryAction.label}
            </Link>
          ) : null}
          {secondaryAction ? (
            <Link
              href={secondaryAction.href}
              className="rounded-full border border-[#fb6a35]/12 bg-white px-5 py-2.5 text-sm font-medium text-[#9a3412] transition hover:border-[#fb6a35]/24 hover:bg-[#fff5ef]"
            >
              {secondaryAction.label}
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}
