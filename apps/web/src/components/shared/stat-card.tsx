type StatCardProps = {
  label: string;
  value: string;
  helper: string;
  badge?: string;
};

export function StatCard({ label, value, helper, badge }: StatCardProps) {
  return (
    <article className="rounded-[1.5rem] border border-white/10 bg-white/6 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-sky-200/70">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
            {value}
          </p>
        </div>
        {badge ? (
          <span className="rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-sky-100">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-sm leading-6 muted-text">{helper}</p>
    </article>
  );
}
