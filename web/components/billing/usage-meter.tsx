export function UsageMeter({
  label,
  current,
  max,
  percentage,
  sublabel,
}: {
  label: string;
  current: number;
  max: number | null;
  percentage: number;
  sublabel?: string;
}) {
  const isUnlimited = max === null;
  const atLimit = !isUnlimited && percentage >= 100;
  const nearLimit = !isUnlimited && percentage >= 80;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
        <span className="text-slate-600 dark:text-slate-400">{label}</span>
        <span
          className={`shrink-0 font-medium ${
            atLimit ? "text-red-600 dark:text-red-400" : nearLimit ? "text-orange-600 dark:text-orange-400" : "text-slate-700 dark:text-slate-300"
          }`}
        >
          {isUnlimited ? `${current.toLocaleString()} / ∞` : `${current.toLocaleString()} / ${max!.toLocaleString()}`}
        </span>
      </div>
      {!isUnlimited ? (
        <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className={`h-2 rounded-full transition-all ${
              atLimit ? "bg-red-500" : nearLimit ? "bg-orange-500" : "bg-sky-600"
            }`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      ) : null}
      {sublabel ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sublabel}</p> : null}
    </div>
  );
}
