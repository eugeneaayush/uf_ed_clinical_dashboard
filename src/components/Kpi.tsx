import clsx from "clsx";

interface KpiProps {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "accent" | "warn" | "good";
  className?: string;
}

export function Kpi({ label, value, hint, tone = "default", className }: KpiProps) {
  const tones = {
    default: { bar: "bg-zinc-300 dark:bg-zinc-600", num: "text-zinc-900 dark:text-white" },
    accent: { bar: "bg-indigo-600", num: "text-indigo-600 dark:text-indigo-400" },
    warn: { bar: "bg-orange-500", num: "text-orange-600 dark:text-orange-400" },
    good: { bar: "bg-sky-500", num: "text-sky-600 dark:text-sky-400" },
  } as const;
  const t = tones[tone];

  return (
    <div
      className={clsx(
        "relative flex flex-col bg-white dark:bg-white shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10 rounded-xl overflow-hidden p-5 animate-fade-up",
        className
      )}
    >
      <span className={clsx("absolute left-0 top-0 bottom-0 w-1", t.bar)} aria-hidden />
      <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-600">{label}</div>
      <div className={clsx("font-display text-[38px] leading-[1] font-extrabold tracking-tighter tabular mt-3", t.num)}>{value}</div>
      {hint && <div className="text-[12px] text-zinc-500 dark:text-zinc-600 mt-2">{hint}</div>}
    </div>
  );
}
