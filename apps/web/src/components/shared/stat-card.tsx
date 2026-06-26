type StatCardProps = {
  label: string;
  value: string;
  helper: string;
  badge?: string;
};

export function StatCard({ label, value, helper, badge }: StatCardProps) {
  return (
    <article className="rounded-[1.5rem] border border-[#fb6a35]/8 bg-[#fff8f5] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[#9a3412]/75">{label}</p>
          <p className="mt-2.5 text-2xl font-semibold tracking-tight text-[#111827]">
            {value}
          </p>
        </div>
        {badge ? (
          <span className="rounded-full border border-[#fb6a35]/14 bg-[#fb6a35]/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-[#9a3412]">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-sm leading-6 muted-text">{helper}</p>
    </article>
  );
}
