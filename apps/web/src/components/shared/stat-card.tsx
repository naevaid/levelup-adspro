type StatCardProps = {
  label: string;
  value: string;
  helper: string;
  badge?: string;
};

export function StatCard({ label, value, helper, badge }: StatCardProps) {
  return (
    <article className="rounded-[1.5rem] border border-white/14 bg-white/8 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-sky-100/75">{label}</p>
          <p className="mt-2.5 text-2xl font-semibold tracking-tight text-white">
            {value}
          </p>
        </div>
        {badge ? (
          <span className="rounded-full border border-sky-200/25 bg-sky-200/12 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-sky-50">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-sm leading-6 muted-text">{helper}</p>
    </article>
  );
}
