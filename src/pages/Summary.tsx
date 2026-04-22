import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { Card } from "../components/Card";
import { ChartTooltip } from "../components/ChartTooltip";
import { LoadingDots, ErrorState, PageHeader } from "../components/States";
import { useSummary, useMeta } from "../lib/data";
import type { SummaryKpi } from "../lib/types";
import { fmtInt, fmtDec, fmtYearMonth, truncate } from "../lib/format";
import { LOCATION_COLOR, ACUITY_COLOR } from "../lib/palette";

/**
 * Oracle-style overview. Layout mirrors the Oracle BI Clinical Dashboard
 * screenshot Aayush shared.
 *
 *   ─────────────────────────────────────────────────────────────────
 *   Header KPIs: Patients · Inpatients · ED Patients · Outpatients · Discharges
 *   ─────────────────────────────────────────────────────────────────
 *   Admissions by Diagnosis  │  Discharges by Diagnosis
 *   Avg Acuity by ED Location│  % Encounters by Diagnosis
 *   Top 10 Diagnoses (full width)
 *   Arrival by Year-Mode     │  Acuity by Month
 *   ─────────────────────────────────────────────────────────────────
 *
 * Clickable KPI tiles drill into /metrics/<slug>.
 */
// Dark-mode chart tokens shared across every Recharts instance on this page.
const GRID_STROKE = "#27272a"; // zinc-800
const TICK_FILL = "#71717a"; // zinc-500
const CURSOR_FILL = "rgba(63, 63, 70, 0.35)"; // zinc-700 @ 35%
const TICK_STYLE = { fill: TICK_FILL, fontSize: 10 } as const;
// Darker palette for the "% of Encounters by Diagnosis" donut so slices
// read against a zinc-900 surface. Order mirrors lib/palette CHART_COLORS
// but drops the slate-800 tone (invisible on dark) in favor of brighter hues.
const DONUT_PALETTE = [
  "#0021A5", // UF blue
  "#FA4616", // UF orange
  "#67e8f9", // cyan-300
  "#a78bfa", // violet-400
  "#34d399", // emerald-400
  "#f59e0b", // amber-500
];
const donutColor = (i: number): string => DONUT_PALETTE[i % DONUT_PALETTE.length];

export function Summary() {
  const { data, loading, error } = useSummary();
  const meta = useMeta();
  const nav = useNavigate();

  const condNameToSlug = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of meta.data?.conditions ?? []) m.set(c.name, c.slug);
    return m;
  }, [meta.data]);

  const drillToCondition = (label: string | undefined) => {
    const slug = label ? condNameToSlug.get(label) : undefined;
    if (slug) nav(`/conditions/${slug}`);
  };

  if (loading || !data) return <LoadingDots />;
  if (error) return <ErrorState error={error} />;

  return (
    <div>
      <PageHeader
        num="01"
        kicker="Summary"
        title="Enterprise overview of every ED encounter."
        subtitle={
          meta.data
            ? `${fmtInt(meta.data.total_encounters)} encounters across ${meta.data.locations.length} sites, ${meta.data.date_range.start} → ${meta.data.date_range.end}. Click any KPI tile to drill into the metric.`
            : undefined
        }
      />

      <KpiHeaderRow kpis={data.kpis} />

      {/* Row 1: Admissions + Discharges by Diagnosis */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          num="02"
          title="Admissions by Diagnosis"
          sub="Top ICD-10 categories among admitted encounters (Final ED Disposition = ADMIT)"
        >
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.admissions_by_diagnosis}
                margin={{ top: 8, right: 16, bottom: 20, left: 0 }}
              >
                <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  angle={-20}
                  textAnchor="end"
                  interval={0}
                  height={70}
                  tick={TICK_STYLE}
                  tickFormatter={(v) => truncate(v, 18)}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: TICK_FILL }}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: CURSOR_FILL }} />
                <Bar
                  dataKey="value"
                  fill="#0021A5"
                  fillOpacity={0.9}
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card
          num="03"
          title="Discharges by Diagnosis"
          sub="Top ICD-10 categories among discharged encounters"
        >
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.discharges_by_diagnosis}
                margin={{ top: 8, right: 16, bottom: 20, left: 0 }}
              >
                <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  angle={-20}
                  textAnchor="end"
                  interval={0}
                  height={70}
                  tick={TICK_STYLE}
                  tickFormatter={(v) => truncate(v, 18)}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: TICK_FILL }}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: CURSOR_FILL }} />
                <Bar
                  dataKey="value"
                  fill="#FA4616"
                  fillOpacity={0.9}
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Row 2: Avg Acuity donut + % Diagnosis donut */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          num="04"
          title="Average Acuity by ED Location"
          sub="Mean ESI per site (1 = most acute, 5 = least). Lower values indicate a sicker case mix."
        >
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="w-full md:w-1/2 h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  {/*
                    Donut weighting: each slice's area is proportional to
                    encounters-at-that-site, but tooltip carries mean ESI.
                    Sites with lower mean ESI (sicker) get deeper red shading.
                    ESI tinting semantics are preserved in dark mode.
                  */}
                  <Pie
                    data={data.avg_acuity_by_location}
                    dataKey="encounters"
                    nameKey="label"
                    innerRadius={56}
                    outerRadius={90}
                    paddingAngle={1.5}
                    stroke="none"
                  >
                    {data.avg_acuity_by_location.map((d, i) => (
                      <Cell
                        key={d.label}
                        fill={acuityTint(d.value) ?? LOCATION_COLOR[d.label] ?? donutColor(i)}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={
                      <ChartTooltip
                        valueFormatter={(v) =>
                          typeof v === "number" ? `${fmtDec(v, 2)} ESI` : String(v)
                        }
                      />
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="w-full md:w-1/2 space-y-1">
              {data.avg_acuity_by_location.map((d, i) => (
                <li
                  key={d.label}
                  className="flex items-center justify-between py-1.5 border-b border-zinc-800 last:border-0"
                >
                  <span className="flex items-center gap-2 text-[12px]">
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{
                        backgroundColor:
                          acuityTint(d.value) ?? LOCATION_COLOR[d.label] ?? donutColor(i),
                      }}
                    />
                    <span className="font-medium text-zinc-100">{d.label}</span>
                  </span>
                  <span className="font-mono text-[11.5px] flex gap-3">
                    <span className="font-semibold text-zinc-100">
                      {d.value != null ? fmtDec(d.value, 2) : "—"}
                    </span>
                    <span className="text-zinc-500 w-16 text-right">
                      {fmtInt(d.encounters)} enc
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card
          num="05"
          title="% of Encounters by Diagnosis"
          sub="Relative share of top 6 condition categories"
        >
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.pct_by_diagnosis}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={56}
                  outerRadius={90}
                  paddingAngle={1.5}
                  stroke="none"
                  label={(e: { pct: number }) => `${e.pct.toFixed(1)}%`}
                  labelLine={false}
                >
                  {data.pct_by_diagnosis.map((_, i) => (
                    <Cell key={i} fill={donutColor(i)} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  iconType="square"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, color: TICK_FILL }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Row 3: Top 10 Diagnoses (full-width, clickable bars) */}
      <div className="mt-6">
        <Card
          num="06"
          title="Top 10 Diagnoses"
          sub="Most frequent ICD-10 categories. Click any condition to drill into its details."
        >
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.top_10_diagnoses}
                layout="vertical"
                margin={{ top: 4, right: 24, bottom: 4, left: 4 }}
              >
                <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: TICK_FILL }}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  width={180}
                  tick={{ fill: TICK_FILL, fontSize: 11 }}
                  tickFormatter={(v) => truncate(v, 26)}
                  onClick={(e: { value?: string }) => drillToCondition(e?.value)}
                  style={{ cursor: "pointer" }}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: CURSOR_FILL }} />
                <Bar
                  dataKey="value"
                  fill="#0021A5"
                  fillOpacity={0.85}
                  radius={[0, 6, 6, 0]}
                  style={{ cursor: "pointer" }}
                  onClick={(d: { label?: string }) => drillToCondition(d?.label)}
                  activeBar={{ fillOpacity: 1 }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Row 4: Arrival by Year + Acuity Monthly */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          num="07"
          title="Arrival Mode by Year"
          sub="Mode-of-arrival counts across fiscal years in this dataset"
        >
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.arrival_by_year}
                layout="vertical"
                margin={{ top: 8, right: 16, bottom: 4, left: 4 }}
              >
                <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: TICK_FILL }}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  width={140}
                  tick={{ fill: TICK_FILL }}
                  tickFormatter={(v) => truncate(v, 20)}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: CURSOR_FILL }} />
                <Legend
                  iconType="square"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, color: TICK_FILL }}
                />
                {yearColumns(data.arrival_by_year).map((y, i) => (
                  <Bar
                    key={y}
                    dataKey={y}
                    name={y}
                    fill={i === 0 ? "#0021A5" : "#FA4616"}
                    fillOpacity={0.9}
                    radius={[0, 4, 4, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card
          num="08"
          title="Acuity by Month"
          sub="ESI triage distribution over time"
        >
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.acuity_monthly}
                margin={{ top: 8, right: 16, bottom: 4, left: 0 }}
              >
                <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                <XAxis
                  dataKey="year_month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: TICK_FILL }}
                  tickFormatter={fmtYearMonth}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: TICK_FILL }}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: CURSOR_FILL }} />
                <Legend
                  iconType="square"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, color: TICK_FILL }}
                />
                {["ESI-1", "ESI-2", "ESI-3", "ESI-4", "ESI-5", "Unknown"].map((a) => (
                  <Bar
                    key={a}
                    dataKey={a}
                    stackId="a"
                    fill={ACUITY_COLOR[a] ?? "#3f3f46"}
                    fillOpacity={0.9}
                    radius={a === "Unknown" ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------- KPI header row ----------
 * Tight 5-column stat strip styled after the stats-four-columns UI-Kit
 * pattern: mono uppercase labels, large display-font numbers, hover-only
 * "Drill into X" micro-link. A zinc-800 hairline divides cells on the right
 * edge (suppressed on the last column and on the wrap-to-second-row boundary).
 */
function KpiHeaderRow({ kpis }: { kpis: SummaryKpi[] }) {
  const nav = useNavigate();
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 rounded-2xl bg-zinc-900/60 ring-1 ring-zinc-800 overflow-hidden">
      {kpis.map((k, i) => {
        const clickable = !!k.link;
        const isLastInRow = (i + 1) % 5 === 0;
        const content = (
          <div
            className={clsx(
              "relative px-5 py-5 transition-colors h-full",
              !isLastInRow && "md:border-r md:border-zinc-800",
              clickable && "hover:bg-zinc-900/80 cursor-pointer",
            )}
          >
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-zinc-500 mb-2">
              {String(i + 1).padStart(2, "0")} · {k.label}
            </div>
            <div className="font-display text-[34px] font-extrabold leading-none tracking-tighter tabular text-uf-blue">
              {fmtInt(k.value)}
            </div>
            {clickable && (
              <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-600 opacity-0 group-hover:opacity-100 group-hover:text-blue-400 transition-opacity">
                Drill into {k.link} →
              </div>
            )}
            {!clickable && <div className="mt-3 h-[14px]" aria-hidden />}
          </div>
        );
        if (clickable) {
          return (
            <button
              key={k.label}
              type="button"
              className="group text-left"
              onClick={() => nav(`/metrics/${k.link}`)}
            >
              {content}
            </button>
          );
        }
        return (
          <div key={k.label} className="group">
            {content}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Map a mean-ESI value to a color. Lower (sicker) = deeper red/orange;
 * higher (less acute) = lighter/blue. This is a diverging tint; leaves
 * LOCATION_COLOR as fallback when value is null.
 */
function acuityTint(v: number | null | undefined): string | undefined {
  if (v == null) return undefined;
  // clamp 1.0–5.0; interpolate across a 5-stop red→blue palette
  const stops: Array<[number, string]> = [
    [1.5, "#b91c1c"], // crimson - very acute
    [2.2, "#ea580c"], // orange - quite acute
    [2.8, "#f59e0b"], // amber - moderate
    [3.4, "#0ea5e9"], // sky - mild
    [4.0, "#0021A5"], // UF blue - least acute
  ];
  if (v <= stops[0][0]) return stops[0][1];
  if (v >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (v >= stops[i][0] && v <= stops[i + 1][0]) {
      return stops[i + 1][1];
    }
  }
  return undefined;
}

/* ---------- Helpers ---------- */

function yearColumns(rows: Array<Record<string, string | number>>): string[] {
  if (!rows.length) return [];
  return Object.keys(rows[0]).filter((k) => k !== "label");
}
