type BarChartProps = {
  days: string[];
  values: number[];
  label: string;
  barClass: string;
  formatter?: (n: number) => string;
};

export function BarChart({ days, values, label, barClass, formatter }: BarChartProps) {
  const max = Math.max(...values, 1);
  const w = 480;
  const h = 90;
  const padLeft = 48;
  const padRight = 8;
  const padTop = 8;
  const padBottom = 22;
  const plotW = w - padLeft - padRight;
  const plotH = h - padTop - padBottom;
  const slotW = plotW / days.length;
  const barW = Math.max(4, slotW - 4);

  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <svg
        width="100%"
        viewBox={`0 0 ${w} ${h}`}
        style={{ maxWidth: w }}
        role="img"
        aria-label={label}
        className="overflow-visible"
      >
        {[0, 0.5, 1].map((frac) => {
          const y = padTop + (1 - frac) * plotH;
          return (
            <g key={frac}>
              <line x1={padLeft} x2={padLeft + plotW} y1={y} y2={y} stroke="currentColor" strokeWidth="0.5" className="text-slate-200 dark:text-slate-700" strokeDasharray="3,3" />
              <text x={(padLeft - 5).toString()} y={y.toFixed(1)} textAnchor="end" dominantBaseline="middle" fontSize="8" className="fill-slate-400 dark:fill-slate-500">
                {formatter ? formatter(Math.round(max * frac)) : Math.round(max * frac).toString()}
              </text>
            </g>
          );
        })}
        {days.map((day, i) => {
          const barH = (values[i] / max) * plotH;
          const x = padLeft + i * slotW + (slotW - barW) / 2;
          const y = padTop + plotH - barH;
          return <rect key={day} x={x.toFixed(1)} y={y.toFixed(1)} width={barW.toFixed(1)} height={Math.max(0, barH).toFixed(1)} rx="2" className={barClass} />;
        })}
        {[0, Math.floor(days.length / 2), days.length - 1].map((i) => {
          const x = padLeft + i * slotW + slotW / 2;
          return <text key={i} x={x.toFixed(1)} y={(h - 5).toString()} textAnchor="middle" fontSize="8" className="fill-slate-400 dark:fill-slate-500">{days[i]}</text>;
        })}
      </svg>
    </div>
  );
}
