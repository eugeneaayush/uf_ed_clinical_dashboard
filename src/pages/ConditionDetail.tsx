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
  LineChart,
  Line,
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
        <Link to="/conditions" className="text-slate-500 hover:text-slate-900 transition-colors">
          ← All Conditions
        </Link>
        <span aria-hidden className="text-slate-300">/</span>
        {meta.data && (
          <select
            value={slug}
            onChange={(e) => nav(`/conditions/${e.target.value}`)}
            className="rounded-full bg-slate-50 ring-1 ring-slate-200 px-3 py-1 text-[12.5px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-uf-blue"
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
          num="01"
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
        num="02"
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
        num="03"
        title="By ED Location"
        sub="Per-site volume and readmission + attrition rates for this condition"
        className="mt-6"
      >
        <div className="overflow-x-auto thin-scroll">
          <table className="data-table min-w-[1000px]">
            <thead>
              <tr>
                <th>Location</th>
                <th className="text-right">Encounters</th>
                <th className="text-right">Admit %</th>
                <th className="text-right">Median LOS</th>
                <th className="text-right">LWBS %</th>
                <th className="text-right">LBTC %</th>
                <th className="text-right">72h Any</th>
                <th className="text-right">72h Same</th>
                <th className="text-right">7d Any</th>
                <th className="text-right">7d Same</th>
                <th className="text-right">30d Any</th>
                <th className="text-right">30d Same</th>
              </tr>
            </thead>
            <tbody>
              {data.by_location
                .filter((r) => r.encounters > 0)
                .map((r) => (
                  <tr key={r.location}>
                    <td>
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-sm"
                          style={{ backgroundColor: LOCATION_COLOR[r.location] ?? "#cad5e2" }}
                        />
                        <span className="font-medium text-slate-900">{r.location}</span>
                      </span>
                    </td>
                    <td className="text-right num">{fmtInt(r.encounters)}</td>
                    <td className="text-right num">{fmtPct(r.admit_rate_pct)}</td>
                    <td className="text-right num">{fmtMinutes(r.median_ed_los_min)}</td>
                    <td className="text-right num">{fmtPct(r.lwbs_rate_pct)}</td>
                    <td className="text-right num">{fmtPct(r.lbtc_rate_pct)}</td>
                    <td className="text-right num text-uf-orange">{fmtPct(r.return_72h_any_pct)}</td>
                    <td className="text-right num text-uf-blue">{fmtPct(r.return_72h_same_pct)}</td>
                    <td className="text-right num text-uf-orange">{fmtPct(r.return_7d_any_pct)}</td>
                    <td className="text-right num text-uf-blue">{fmtPct(r.return_7d_same_pct)}</td>
                    <td className="text-right num text-uf-orange font-semibold">{fmtPct(r.return_30d_any_pct)}</td>
                    <td className="text-right num text-uf-blue font-semibold">{fmtPct(r.return_30d_same_pct)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Trend */}
      <Card num="04" title="Monthly Volume Trend" sub={`${data.category} encounters & admits per month`} className="mt-6">
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.monthly_trend} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="year_month" tickLine={false} axisLine={false} tickFormatter={fmtYearMonth} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} labelFormatter={fmtYearMonth} />
              <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="encounters" name="Encounters" stroke="#0021A5" strokeWidth={2.5} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="admits" name="Admits" stroke="#1d293d" strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="lwbs" name="LWBS" stroke="#FA4616" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Acuity + disposition */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card num="05" title="Acuity Mix" sub="ESI triage distribution for this condition">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.by_acuity} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {data.by_acuity.map((d) => (
                    <Cell key={d.label} fill={ACUITY_COLOR[d.label] ?? "#cad5e2"} />
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
            <thead>
              <tr>
                <th>Encounter</th>
                <th>MRN</th>
                <th>Location</th>
                <th>Acuity</th>
                <th>Attending</th>
                <th>Arrival</th>
                <th>Disposition</th>
                <th>Diagnosis</th>
                <th className="text-right">ED LOS</th>
                <th className="text-right">30d Return</th>
              </tr>
            </thead>
            <tbody>
              {data.patient_list.map((p) => (
                <tr key={p.encounter}>
                  <td className="num text-slate-500 text-[11px]">{p.encounter}</td>
                  <td className="num text-slate-500 text-[11px]">{p.mrn}</td>
                  <td>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: LOCATION_COLOR[p.location] ?? "#cad5e2" }} />
                      <span className="text-slate-900">{p.location}</span>
                    </span>
                  </td>
                  <td>
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-slate-700">
                      {p.acuity}
                    </span>
                  </td>
                  <td className="text-slate-700">{p.attending}</td>
                  <td className="num text-slate-500">
                    {p.arrival
                      ? new Date(p.arrival).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="text-slate-700">{p.disposition}</td>
                  <td className="text-slate-700 max-w-[240px] truncate">{p.final_diagnosis || "—"}</td>
                  <td className="text-right num">{fmtMinutes(p.ed_los_min)}</td>
                  <td className="text-right">
                    {p.returned_within_30d ? (
                      <span className="inline-flex items-center rounded-md bg-uf-orange/10 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-uf-orange">
                        Returned
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
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
    <div className="rounded-xl ring-1 ring-slate-200 bg-slate-50 p-4">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-slate-500 mb-3">
        {window} Return Rate
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-white ring-1 ring-uf-blue/20 p-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-uf-blue mb-1">
            Same Condition
          </div>
          <div className="font-display text-[22px] font-extrabold text-uf-blue leading-none tracking-tighter tabular">
            {fmtPct(same_pct)}
          </div>
        </div>
        <div className="rounded-lg bg-white ring-1 ring-uf-orange/20 p-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-uf-orange mb-1">
            Any Cause
          </div>
          <div className="font-display text-[22px] font-extrabold text-uf-orange leading-none tracking-tighter tabular">
            {fmtPct(any_pct)}
          </div>
        </div>
      </div>
    </div>
  );
}
