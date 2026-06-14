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
    <section className="glass-card rounded-[1.75rem] border border-white/10 p-6 sm:p-7">
      <div className="max-w-2xl">
        <p className="text-xs uppercase tracking-[0.28em] text-sky-200/65">
          Empty State
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-7 muted-text sm:text-base">
          {description}
        </p>
      </div>

      {(primaryAction || secondaryAction) && (
        <div className="mt-6 flex flex-wrap gap-3">
          {primaryAction ? (
            <Link
              href={primaryAction.href}
              className="rounded-full bg-sky-400 px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-sky-300"
            >
              {primaryAction.label}
            </Link>
          ) : null}
          {secondaryAction ? (
            <Link
              href={secondaryAction.href}
              className="rounded-full border border-white/12 px-5 py-3 text-sm font-medium text-slate-100 transition hover:border-sky-300/45 hover:text-sky-100"
            >
              {secondaryAction.label}
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}
