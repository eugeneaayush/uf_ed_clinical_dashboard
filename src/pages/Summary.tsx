import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
import { fmtInt, fmtDec, truncate } from "../lib/format";
import {
  LOCATION_COLOR,
  ACUITY_COLOR,
  getColor,
} from "../lib/palette";

/**
 * Oracle-style overview. Layout mirrors the Oracle BI Clinical Dashboard
 * screenshot Aayush shared.
 *
 *   ─────────────────────────────────────────────────────────────────
 *   Header KPIs: Patients · Inpatients · ED Patients · Outpatients · Discharges
 *   ─────────────────────────────────────────────────────────────────
 *   Admissions by Diagnosis  │  Discharges by Diagnosis           ← revised
 *   Avg Acuity by ED Location│  % Encounters by Diagnosis         ← revised
 *   (Removed)                │  Top 10 Diagnoses                  ← Type gauge removed
 *   Arrival by Year-Mode     │  Acuity by Month
 *   ─────────────────────────────────────────────────────────────────
 *
 * Clickable KPI tiles drill into /metrics/<slug>.
 */
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

      {/* KPI header row — mirrors Oracle's top bar */}
      <KpiHeaderRow kpis={data.kpis} />

      {/* Row 1: Admissions by Diagnosis + Discharges by Diagnosis — sibling bars */}
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
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  angle={-20}
                  textAnchor="end"
                  interval={0}
                  height={70}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => truncate(v, 18)}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="value" fill="#0021A5" radius={[6, 6, 0, 0]} />
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
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  angle={-20}
                  textAnchor="end"
                  interval={0}
                  height={70}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => truncate(v, 18)}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="value" fill="#FA4616" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Row 2: Avg Acuity by Location donut + % Diagnosis donut */}
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
                    encounters-at-that-site (so donut size still communicates
                    the bigger sites), but the label + tooltip carry the mean
                    ESI to communicate acuity. Sites with lower mean ESI (sicker)
                    get deeper UF-blue shading.
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
                        fill={acuityTint(d.value) ?? LOCATION_COLOR[d.label] ?? getColor(i)}
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
                  className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0"
                >
                  <span className="flex items-center gap-2 text-[12px]">
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{
                        backgroundColor:
                          acuityTint(d.value) ?? LOCATION_COLOR[d.label] ?? getColor(i),
                      }}
                    />
                    <span className="font-medium text-slate-900">{d.label}</span>
                  </span>
                  <span className="font-mono text-[11.5px] flex gap-3">
                    <span className="font-semibold text-slate-900">
                      {d.value != null ? fmtDec(d.value, 2) : "—"}
                    </span>
                    <span className="text-slate-500 w-16 text-right">
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
                    <Cell key={i} fill={getColor(i)} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Row 3: Top 10 Diagnoses (full-width) */}
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
                <CartesianGrid horizontal={false} />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  width={180}
                  tickFormatter={(v) => truncate(v, 26)}
                  onClick={(e: { value?: string }) => drillToCondition(e?.value)}
                  style={{ cursor: "pointer" }}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f1f5f9" }} />
                <Bar
                  dataKey="value"
                  fill="#0021A5"
                  radius={[0, 6, 6, 0]}
                  style={{ cursor: "pointer" }}
                  onClick={(d: { label?: string }) => drillToCondition(d?.label)}
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
                <CartesianGrid horizontal={false} />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  width={140}
                  tickFormatter={(v) => truncate(v, 20)}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f1f5f9" }} />
                <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                {yearColumns(data.arrival_by_year).map((y, i) => (
                  <Bar
                    key={y}
                    dataKey={y}
                    name={y}
                    fill={i === 0 ? "#0021A5" : "#51a2ff"}
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
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="year_month"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => {
                    const [y, m] = v.split("-");
                    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                    return `${months[parseInt(m, 10) - 1]} '${y.slice(2)}`;
                  }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                {["ESI-1", "ESI-2", "ESI-3", "ESI-4", "ESI-5", "Unknown"].map((a) => (
                  <Bar
                    key={a}
                    dataKey={a}
                    stackId="a"
                    fill={ACUITY_COLOR[a] ?? "#cad5e2"}
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

/* ---------- KPI header row ---------- */

function KpiHeaderRow({ kpis }: { kpis: SummaryKpi[] }) {
  const nav = useNavigate();
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {kpis.map((k, i) => {
        const clickable = !!k.link;
        const content = (
          <div
            className={[
              "relative rounded-2xl ring-1 bg-white px-5 py-4 transition-all",
              clickable
                ? "ring-slate-200 hover:ring-uf-blue/40 hover:shadow-card-hover cursor-pointer"
                : "ring-slate-200",
            ].join(" ")}
          >
            <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-slate-500 mb-1">
              {String(i + 1).padStart(2, "0")} · {k.label}
            </div>
            <div className="font-display text-[30px] font-extrabold leading-none tracking-tighter tabular text-uf-blue">
              {fmtInt(k.value)}
            </div>
            {clickable && (
              <div className="mt-2 font-mono text-[10px] text-slate-500 group-hover:text-uf-blue">
                Drill into {k.link} →
              </div>
            )}
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
        return <div key={k.label}>{content}</div>;
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
