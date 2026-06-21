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
    <section className="glass-card rounded-[1.75rem] border border-white/14 p-5 sm:p-6">
      <div className="max-w-2xl">
        <p className="text-[11px] uppercase tracking-[0.24em] text-sky-100/70">
          Empty State
        </p>
        <h2 className="mt-2.5 text-xl font-semibold tracking-tight text-white sm:text-2xl">
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
              className="rounded-full bg-sky-300 px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-sky-200"
            >
              {primaryAction.label}
            </Link>
          ) : null}
          {secondaryAction ? (
            <Link
              href={secondaryAction.href}
              className="rounded-full border border-white/16 bg-white/6 px-5 py-2.5 text-sm font-medium text-slate-50 transition hover:border-sky-200/55 hover:bg-white/10 hover:text-white"
            >
              {secondaryAction.label}
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}
