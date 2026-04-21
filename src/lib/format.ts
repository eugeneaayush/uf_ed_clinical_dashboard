/**
 * Display formatters — centralized so rounding, locale, and unit conventions
 * stay consistent across every chart, KPI, and table cell.
 */

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const nfPct = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

export const fmtInt = (n: number | null | undefined): string =>
  n == null ? "—" : nf0.format(n);

export const fmtDec = (n: number | null | undefined, digits = 1): string => {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(n);
};

export const fmtPct = (n: number | null | undefined): string => {
  if (n == null) return "—";
  return nfPct.format(n / 100);
};

/** Minutes → "4h 32m" (or "32m" if <60). */
export const fmtMinutes = (m: number | null | undefined): string => {
  if (m == null) return "—";
  const mins = Math.round(m);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
};

/** Minutes → decimal hours for chart axes. */
export const minToHours = (m: number | null | undefined): number | null =>
  m == null ? null : Math.round((m / 60) * 10) / 10;

export const fmtYearMonth = (ym: string): string => {
  // "2025-07" → "Jul '25"
  const [y, m] = ym.split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const mi = parseInt(m, 10) - 1;
  return `${months[mi] ?? m} ’${y.slice(2)}`;
};

/** Truncate long labels for chart axes without cutting mid-word. */
export const truncate = (s: string, max: number): string => {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
};

export { nf0, nf1 };

/** Signed minutes delta → "+32m" or "-1h 12m" (null-safe). */
export const fmtDeltaMinutes = (
  m: number | null | undefined
): string => {
  if (m == null) return "—";
  const sign = m > 0 ? "+" : m < 0 ? "−" : "±";
  const abs = Math.abs(m);
  const mins = Math.round(abs);
  if (mins < 60) return `${sign}${mins}m`;
  const h = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem === 0 ? `${sign}${h}h` : `${sign}${h}h ${rem}m`;
};

/** Convenient short hours formatter: 421.7 → "7.0h". */
export const fmtHours = (m: number | null | undefined, digits = 1): string => {
  if (m == null) return "—";
  return `${(m / 60).toFixed(digits)}h`;
};

/**
 * Unit-aware formatter — dispatches to the right formatter based on metric unit.
 * Used by MetricDetail which renders any metric generically.
 */
export type MetricUnit = "min" | "pct" | "count" | "score";

export const fmtByUnit = (
  v: number | null | undefined,
  unit: MetricUnit
): string => {
  if (v == null) return "—";
  switch (unit) {
    case "min": return fmtMinutes(v);
    case "pct": return fmtPct(v);
    case "count": return fmtInt(v);
    case "score": return fmtDec(v, 2);
  }
};

/**
 * Signed delta formatter respecting the metric's unit. For scores we show
 * two decimals; for everything else we delegate to the unit's formatter.
 */
export const fmtDeltaByUnit = (
  delta: number | null | undefined,
  unit: MetricUnit
): string => {
  if (delta == null) return "—";
  if (unit === "min") return fmtDeltaMinutes(delta);
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "±";
  const abs = Math.abs(delta);
  if (unit === "pct") return `${sign}${abs.toFixed(2)}pp`;
  if (unit === "count") return `${sign}${fmtInt(Math.round(abs))}`;
  return `${sign}${abs.toFixed(2)}`;
};
