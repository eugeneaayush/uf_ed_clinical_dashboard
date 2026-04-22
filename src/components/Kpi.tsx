import clsx from "clsx";

interface KpiProps {
  label: string;
  value: string;
  hint?: string;
  /** Treatment: neutral (default), accent (UF blue), warn (orange), good (light blue) */
  tone?: "default" | "accent" | "warn" | "good";
  className?: string;
}

/**
 * Number-stat tile — Anybody display, tracked-tight, with a tone bar accent.
 * Dark-mode zinc surface with brand accents kept intact.
 */
export function Kpi({
  label,
  value,
  hint,
  tone = "default",
  className,
}: KpiProps) {
  const tones = {
    default: { bar: "bg-zinc-700", num: "text-zinc-100" },
    accent: { bar: "bg-uf-blue", num: "text-blue-400" },
    warn: { bar: "bg-uf-orange", num: "text-uf-orange" },
    good: { bar: "bg-sky-400", num: "text-cyan-300" },
  } as const;
  const t = tones[tone];

  return (
    <div
      className={clsx(
        "tile relative overflow-hidden p-5 animate-fade-up",
        "transition-colors hover:ring-zinc-700",
        className
      )}
    >
      <span
        className={clsx("absolute left-0 top-0 bottom-0 w-1", t.bar)}
        aria-hidden
      />
      <div className="kpi-label">{label}</div>
      <div className={clsx("kpi-num mt-3", t.num)}>{value}</div>
      {hint && <div className="kpi-hint mt-2">{hint}</div>}
    </div>
  );
}
