import { useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  LineChart,
  Legend,
  PieChart,
  Pie,
} from "recharts";
import { Card } from "../components/Card";
import { Kpi } from "../components/Kpi";
import { ChartTooltip } from "../components/ChartTooltip";
import { LoadingDots, ErrorState, PageHeader } from "../components/States";
import { useCondition, useMeta } from "../lib/data";
import { fmtInt, fmtPct, fmtMinutes, fmtYearMonth } from "../lib/format";
import { LOCATION_COLOR, ACUITY_COLOR, DISPOSITION_COLOR, getColor } from "../lib/palette";

export function ConditionDetail() {
  const { slug = "" } = useParams();
  const nav = useNavigate();
  const { data, loading, error } = useCondition(slug);
  const meta = useMeta();

  if (loading || !data) return <LoadingDots />;
  if (error) return <ErrorState error={error} />;

  const k = data.kpis;

  return (
    <div>
      {/* Breadcrumb + condition picker */}
      <div className="flex flex-wrap items-center gap-2 mb-4 text-[12.5px]">
        <Link to="/conditions" className="text-zinc-400 hover:text-zinc-100 transition-colors">
          ← All Conditions
        </Link>
        <span aria-hidden className="text-zinc-700">/</span>
        {meta.data && (
          <select
            value={slug}
            onChange={(e) => nav(`/conditions/${e.target.value}`)}
            className="rounded-full bg-zinc-900 ring-1 ring-zinc-800 px-3 py-1 text-[12.5px] font-medium text-zinc-100 hover:ring-zinc-700 focus:outline-none focus:ring-2 focus:ring-uf-blue"
          >
            {meta.data.conditions.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <PageHeader
        num="02"
        kicker={data.category}
        title={`${data.category} — readmission & attrition drill-down.`}
        subtitle={`${fmtInt(k.encounters)} encounters · ${fmtInt(k.unique_patients)} unique patients. Same-condition return rates use strict CMS-style matching on ICD-10 Condition Category; any-cause return rates count any ED revisit by the same MRN.`}
      />

      {/* Trend — top-of-page per brief: UF blue area-gradient line */}
      <Card num="01" title="Monthly Volume Trend" sub={`${data.category} encounters & admits per month`} className="mb-6">
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.monthly_trend} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <defs>
                <linearGradient id="condTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0021A5" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#0021A5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#27272a" />
              <XAxis dataKey="year_month" tickLine={false} axisLine={false} tick={{ fill: "#71717a" }} tickFormatter={fmtYearMonth} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: "#71717a" }} />
              <Tooltip content={<ChartTooltip />} labelFormatter={fmtYearMonth} cursor={{ stroke: "#3f3f46" }} />
              <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Area
                type="monotone"
                dataKey="encounters"
                name="Encounters"
                stroke="#0021A5"
                strokeWidth={2.5}
                fill="url(#condTrendFill)"
                dot={{ r: 2, fill: "#0021A5" }}
                activeDot={{ r: 4, fill: "#0021A5" }}
              />
              <Line type="monotone" dataKey="admits" name="Admits" stroke="#60a5fa" strokeWidth={2} dot={{ r: 2, fill: "#60a5fa" }} />
              <Line type="monotone" dataKey="lwbs" name="LWBS" stroke="#FA4616" strokeWidth={2} dot={{ r: 2, fill: "#FA4616" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Headline KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Kpi label="Encounters" value={fmtInt(k.encounters)} tone="accent" />
        <Kpi label="Admit Rate" value={fmtPct(k.admit_rate_pct)} hint={`${fmtInt(k.admits)} admits`} tone="good" />
        <Kpi label="LWBS Rate" value={fmtPct(k.lwbs_rate_pct)} tone="warn" />
        <Kpi label="Median LOS" value={fmtMinutes(k.median_ed_los_min)} />
      </div>

      {/* Ambulance block — critical for time-sensitive conditions */}
      {k.ems_transports > 0 && (
        <Card
          num="02"
          title="Ambulance Arrival & Offload"
          sub={`EMS transports for ${data.category.toLowerCase()} patients. Offload = Arrival → Triage, industry target ≤20 min.`}
          className="mb-6"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi
              label="EMS Transports"
              value={fmtInt(k.ems_transports)}
              hint={`${fmtPct(k.ems_share_pct)} of ${data.category.toLowerCase()} arrivals`}
              tone="accent"
            />
            <Kpi
              label="Offload · median"
              value={fmtMinutes(k.offload_median_min)}
              tone={
                k.offload_median_min != null && k.offload_median_min > 20
                  ? "warn"
                  : "good"
              }
            />
            <Kpi
              label="Offload · P90"
              value={fmtMinutes(k.offload_p90_min)}
              hint="Target ≤ 20m"
              tone={
                k.offload_p90_min != null && k.offload_p90_min > 20
                  ? "warn"
                  : "good"
              }
            />
            <Kpi
              label=">20 min offload"
              value={fmtPct(k.offload_gt_20min_pct)}
              tone={k.offload_gt_20min_pct > 15 ? "warn" : "default"}
            />
          </div>
        </Card>
      )}

      {/* Return visit comparison — side-by-side as requested */}
      <Card
        num="03"
        title="Return Visit Rates"
        sub="Same-condition returns (blue) vs. any-cause returns (orange). Same-condition is the CMS-style clinical-quality metric; any-cause captures operational capacity pressure."
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ReturnRatePair
            window="72-hour"
            any_pct={k.return_72h_any_pct}
            same_pct={k.return_72h_same_pct}
          />
          <ReturnRatePair
            window="7-day"
            any_pct={k.return_7d_any_pct}
            same_pct={k.return_7d_same_pct}
          />
          <ReturnRatePair
            window="30-day"
            any_pct={k.return_30d_any_pct}
            same_pct={k.return_30d_same_pct}
          />
        </div>
      </Card>

      {/* Per-location breakdown */}
      <Card
        num="04"
        title="By ED Location"
        sub="Per-site volume and readmission + attrition rates for this condition"
        className="mt-6"
      >
        <LocationTable
          rows={data.by_location}
          monthlyTrend={data.monthly_trend}
        />
      </Card>

      {/* Acuity + disposition */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card num="05" title="Acuity Mix" sub="ESI triage distribution for this condition">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.by_acuity} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid vertical={false} stroke="#27272a" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#71717a" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "#71717a" }} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "#27272a" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {data.by_acuity.map((d) => (
                    <Cell key={d.label} fill={ACUITY_COLOR[d.label] ?? "#52525b"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card num="06" title="Disposition Mix" sub="How encounters for this condition resolve">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.by_disposition}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={1.5}
                  stroke="none"
                >
                  {data.by_disposition.map((d, i) => (
                    <Cell key={d.label} fill={DISPOSITION_COLOR[d.label] ?? getColor(i)} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Recent patients */}
      <Card num="07" title="Recent Encounters" sub={`${data.patient_list.length} most recent ${data.category.toLowerCase()} patients`} className="mt-6">
        <div className="overflow-x-auto thin-scroll">
          <table className="data-table min-w-[900px]">
            <thead className="sticky top-0 bg-zinc-950">
              <tr className="border-b border-zinc-800">
                <th className="text-zinc-400">Encounter</th>
                <th className="text-zinc-400">MRN</th>
                <th className="text-zinc-400">Location</th>
                <th className="text-zinc-400">Acuity</th>
                <th className="text-zinc-400">Attending</th>
                <th className="text-zinc-400">Arrival</th>
                <th className="text-zinc-400">Disposition</th>
                <th className="text-zinc-400">Diagnosis</th>
                <th className="text-right text-zinc-400">ED LOS</th>
                <th className="text-right text-zinc-400">30d Return</th>
              </tr>
            </thead>
            <tbody>
              {data.patient_list.map((p) => (
                <tr key={p.encounter} className="bg-zinc-900/40 hover:bg-zinc-800/60 transition-colors">
                  <td className="num font-mono text-zinc-500 text-[11px]">{p.encounter}</td>
                  <td className="num font-mono text-zinc-500 text-[11px]">{p.mrn}</td>
                  <td>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: LOCATION_COLOR[p.location] ?? "#52525b" }} />
                      <span className="text-zinc-100">{p.location}</span>
                    </span>
                  </td>
                  <td>
                    <span className="inline-flex items-center rounded-md bg-zinc-800 px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-zinc-300">
                      {p.acuity}
                    </span>
                  </td>
                  <td className="text-zinc-300">{p.attending}</td>
                  <td className="num font-mono text-zinc-500">
                    {p.arrival
                      ? new Date(p.arrival).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="text-zinc-300">{p.disposition}</td>
                  <td className="text-zinc-300 max-w-[240px] truncate">{p.final_diagnosis || "—"}</td>
                  <td className="text-right num font-mono text-zinc-300">{fmtMinutes(p.ed_los_min)}</td>
                  <td className="text-right">
                    {p.returned_within_30d ? (
                      <span className="inline-flex items-center rounded-md bg-uf-orange/15 ring-1 ring-uf-orange/30 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-orange-400">
                        Returned
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ReturnRatePair({
  window,
  any_pct,
  same_pct,
}: {
  window: string;
  any_pct: number;
  same_pct: number;
}) {
  return (
    <div className="rounded-xl ring-1 ring-zinc-800 bg-zinc-900 p-4">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-zinc-500 mb-3">
        {window} Return Rate
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-zinc-950 ring-1 ring-uf-blue/30 p-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-blue-400 mb-1">
            Same Condition
          </div>
          <div className="font-display text-[22px] font-extrabold text-blue-400 leading-none tracking-tighter tabular">
            {fmtPct(same_pct)}
          </div>
        </div>
        <div className="rounded-lg bg-zinc-950 ring-1 ring-uf-orange/30 p-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-orange-400 mb-1">
            Any Cause
          </div>
          <div className="font-display text-[22px] font-extrabold text-orange-400 leading-none tracking-tighter tabular">
            {fmtPct(any_pct)}
          </div>
        </div>
      </div>
    </div>
  );
}

type LocationRow = {
  location: string;
  encounters: number;
  admit_rate_pct: number;
  lwbs_rate_pct: number;
  lbtc_rate_pct: number;
  return_72h_any_pct: number;
  return_7d_any_pct: number;
  return_30d_any_pct: number;
  return_72h_same_pct: number;
  return_7d_same_pct: number;
  return_30d_same_pct: number;
  median_ed_los_min: number | null;
};

function LocationTable({
  rows,
  monthlyTrend,
}: {
  rows: LocationRow[];
  monthlyTrend: Array<{ year_month: string; encounters: number }>;
}) {
  // Trend sparkline uses the condition-wide monthly series as shared context —
  // per-location monthly history is not in the payload.
  const sparkData = useMemo(
    () => monthlyTrend.map((m) => ({ v: m.encounters })),
    [monthlyTrend]
  );

  return (
    <div className="overflow-x-auto thin-scroll">
      <table className="data-table min-w-[1100px]">
        <thead className="sticky top-0 bg-zinc-950">
          <tr className="border-b border-zinc-800">
            <th className="text-zinc-400">Location</th>
            <th className="text-zinc-400">Trend</th>
            <th className="text-right text-zinc-400">Encounters</th>
            <th className="text-right text-zinc-400">Admit %</th>
            <th className="text-right text-zinc-400">Median LOS</th>
            <th className="text-right text-zinc-400">LWBS %</th>
            <th className="text-right text-zinc-400">LBTC %</th>
            <th className="text-right text-zinc-400">72h Any</th>
            <th className="text-right text-zinc-400">72h Same</th>
            <th className="text-right text-zinc-400">7d Any</th>
            <th className="text-right text-zinc-400">7d Same</th>
            <th className="text-right text-zinc-400">30d Any</th>
            <th className="text-right text-zinc-400">30d Same</th>
          </tr>
        </thead>
        <tbody>
          {rows
            .filter((r) => r.encounters > 0)
            .map((r) => (
              <tr key={r.location} className="bg-zinc-900/40 hover:bg-zinc-800/60 transition-colors">
                <td>
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-sm"
                      style={{ backgroundColor: LOCATION_COLOR[r.location] ?? "#52525b" }}
                    />
                    <span className="font-medium text-zinc-100">{r.location}</span>
                  </span>
                </td>
                <td>
                  <div className="h-6 w-24">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sparkData} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
                        <Line
                          type="monotone"
                          dataKey="v"
                          stroke={LOCATION_COLOR[r.location] ?? "#60a5fa"}
                          strokeWidth={1.5}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </td>
                <td className="text-right num font-mono text-zinc-300">{fmtInt(r.encounters)}</td>
                <td className="text-right num font-mono text-zinc-300">{fmtPct(r.admit_rate_pct)}</td>
                <td className="text-right num font-mono text-zinc-300">{fmtMinutes(r.median_ed_los_min)}</td>
                <td className="text-right num font-mono text-zinc-300">{fmtPct(r.lwbs_rate_pct)}</td>
                <td className="text-right num font-mono text-zinc-300">{fmtPct(r.lbtc_rate_pct)}</td>
                <td className="text-right num font-mono text-orange-400">{fmtPct(r.return_72h_any_pct)}</td>
                <td className="text-right num font-mono text-blue-400">{fmtPct(r.return_72h_same_pct)}</td>
                <td className="text-right num font-mono text-orange-400">{fmtPct(r.return_7d_any_pct)}</td>
                <td className="text-right num font-mono text-blue-400">{fmtPct(r.return_7d_same_pct)}</td>
                <td className="text-right num font-mono font-semibold text-orange-400">{fmtPct(r.return_30d_any_pct)}</td>
                <td className="text-right num font-mono font-semibold text-blue-400">{fmtPct(r.return_30d_same_pct)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
