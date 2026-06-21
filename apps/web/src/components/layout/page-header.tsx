import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 rounded-[1.75rem] border border-white/14 bg-white/8 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="text-[11px] uppercase tracking-[0.24em] text-sky-100/70">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-2.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2.5 max-w-2xl text-sm leading-6 muted-text">
          {description}
        </p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2.5">{actions}</div> : null}
    </header>
  );
}
