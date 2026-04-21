import type { TooltipProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { fmtInt } from "../lib/format";

export function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
}: TooltipProps<ValueType, NameType> & {
  valueFormatter?: (v: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const fmt = valueFormatter ?? ((v: number) => fmtInt(v));
  return (
    <div className="rounded-xl border border-slate-200 bg-white/98 backdrop-blur-md shadow-card-hover px-3 py-2.5 min-w-[140px]">
      {label != null && (
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500 mb-2">
          {label}
        </div>
      )}
      <ul className="space-y-1.5">
        {payload.map((p) => (
          <li
            key={String(p.dataKey)}
            className="flex items-center justify-between gap-4 text-[12px]"
          >
            <span className="flex items-center gap-2 text-slate-700 min-w-0">
              <span
                className="h-2.5 w-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: p.color }}
              />
              <span className="truncate max-w-[180px]">{p.name}</span>
            </span>
            <span className="font-mono font-semibold text-slate-900 tabular">
              {typeof p.value === "number" ? fmt(p.value) : String(p.value ?? "—")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
