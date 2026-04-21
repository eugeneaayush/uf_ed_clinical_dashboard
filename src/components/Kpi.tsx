import clsx from "clsx";

interface KpiProps {
  label: string;
  value: string;
  hint?: string;
  /** Treatment: neutral (default), accent (UF blue), warn (orange), good (blue-ink) */
  tone?: "default" | "accent" | "warn" | "good";
  className?: string;
}

/**
 * Number-stat tile replicating the template's hero metric treatment:
 *   - Anybody display font, extra-bold, tracked-tight
 *   - IBM Plex Mono label above
 *   - Color tone drives a left accent bar + number color
 */
export function Kpi({ label, value, hint, tone = "default", className }: KpiProps) {
  const tones = {
    default: { bar: "bg-slate-300", num: "text-slate-900" },
    accent: { bar: "bg-uf-blue", num: "text-uf-blue" },
    warn: { bar: "bg-uf-orange", num: "text-uf-orange" },
    good: { bar: "bg-sky-500", num: "text-uf-blue-ink" },
  } as const;
  const t = tones[tone];

  return (
    <div
      className={clsx(
        "tile relative overflow-hidden p-5 animate-fade-up",
        className
      )}
    >
      <span className={clsx("absolute left-0 top-0 bottom-0 w-1", t.bar)} aria-hidden />
      <div className="kpi-label">{label}</div>
      <div className={clsx("kpi-num mt-3", t.num)}>{value}</div>
      {hint && <div className="kpi-hint mt-2">{hint}</div>}
    </div>
  );
}
