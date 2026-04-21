import { useParams, useNavigate, Link } from "react-router-dom";
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
  ComposedChart,
  ReferenceLine,
} from "recharts";
import clsx from "clsx";
import { Card } from "../components/Card";
import { Kpi } from "../components/Kpi";
import { ChartTooltip } from "../components/ChartTooltip";
import { LoadingDots, ErrorState, PageHeader } from "../components/States";
import { FilterBar } from "../components/FilterBar";
import {
  useMeta,
  useMetric,
  useMetricIndex,
} from "../lib/data";
import {
  useActiveSlice,
  useCompareMode,
  useCompareView,
  useCompareDimension,
} from "../lib/filters";
import type {
  MetricPayload,
  MetricMonthlyRow,
  MetricRegistryEntry,
} from "../lib/types";
import {
  fmtByUnit,
  fmtDeltaByUnit,
  fmtYearMonth,
  fmtInt,
  truncate,
} from "../lib/format";
import { LOCATION_COLOR } from "../lib/palette";

const SITES_ORDER = ["ADULT ED", "PEDS ED", "KANAPAHA ED", "SPRING ED", "ONH ED"];

export function MetricDetail() {
  const { slug = "" } = useParams();
  const meta = useMeta();
  const index = useMetricIndex();
  const { compare } = useCompareMode();
  const active = useActiveSlice();

  const singlePayload = useMetric(slug, active.kind, active.slug);

  if (index.loading || meta.loading) return <LoadingDots />;
  if (index.error) return <ErrorState error={index.error} />;
  if (meta.error) return <ErrorState error={meta.error} />;

  const registry = index.data?.metrics.find((m) => m.slug === slug);
  if (!registry) {
    return (
      <div>
        <PageHeader
          num="?"
          kicker="Unknown Metric"
          title={`No metric with slug "${slug}".`}
          subtitle="Return to the metric index to see what's available."
        />
        <Link to="/metrics" className="text-uf-blue hover:underline">
          ← All Metrics
        </Link>
      </div>
    );
  }

  return (
    <div>
      <MetricHeader metric={registry} />
      <FilterBar
        showCondition
        hint={
          compare
            ? "Compare mode — location filter is implicit while every site is shown."
            : "Slice by ED site and/or condition category. Filters update the KPI value, monthly trend, and breakdowns below."
        }
      />

      {compare ? (
        <CompareView metricSlug={slug} registry={registry} />
      ) : singlePayload.loading || !singlePayload.data ? (
        <LoadingDots />
      ) : singlePayload.error ? (
        <ErrorState error={singlePayload.error} />
      ) : (
        <SingleSliceView payload={singlePayload.data} />
      )}
    </div>
  );
}

/* ===========================================================================
   Header — metric title + category badge + "breadcrumb" style metric picker
   =========================================================================== */

function MetricHeader({ metric }: { metric: MetricRegistryEntry }) {
  const nav = useNavigate();
  const index = useMetricIndex();
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-2 mb-4 text-[12.5px]">
        <Link
          to="/metrics"
          className="text-slate-500 hover:text-slate-900 transition-colors"
        >
          ← All Metrics
        </Link>
        <span aria-hidden className="text-slate-300">/</span>
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-slate-600">
          {metric.category}
        </span>
        {index.data && (
          <select
            value={metric.slug}
            onChange={(e) => nav(`/metrics/${e.target.value}`)}
            className="ml-auto rounded-full bg-slate-50 ring-1 ring-slate-200 px-3 py-1 text-[12.5px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-uf-blue"
          >
            {groupByCategory(index.data.metrics).map(([cat, items]) => (
              <optgroup key={cat} label={cat}>
                {items.map((m) => (
                  <option key={m.slug} value={m.slug}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}
      </div>
      <PageHeader
        num="*"
        kicker={metric.category}
        title={`${metric.label}.`}
        subtitle={metric.description}
      />
    </div>
  );
}

function groupByCategory(
  metrics: MetricRegistryEntry[]
): [string, MetricRegistryEntry[]][] {
  const map = new Map<string, MetricRegistryEntry[]>();
  for (const m of metrics) {
    if (!map.has(m.category)) map.set(m.category, []);
    map.get(m.category)!.push(m);
  }
  const order = ["Volume", "Throughput", "EMS", "Attrition", "Readmission", "Outcomes"];
  return Array.from(map.entries()).sort(
    ([a], [b]) => order.indexOf(a) - order.indexOf(b)
  );
}

/* ===========================================================================
   Single-slice view
   =========================================================================== */

function SingleSliceView({ payload }: { payload: MetricPayload }) {
  const m = payload.metric;
  const monthly = payload.monthly;
  const latestComplete = [...monthly]
    .reverse()
    .find((r) => !r.is_current_month);
  const current = monthly.find((r) => r.is_current_month);

  // Delta tone: for lower-better metrics, positive delta is bad (orange); for
  // higher-better metrics, negative delta is bad (orange).
  const deltaIsBad = (d: number | null | undefined): boolean => {
    if (d == null) return false;
    return m.direction === "lower" ? d > 0 : d < 0;
  };

  return (
    <div className="space-y-6">
      {/* Headline KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi
          label={`Current · ${sliceLabel(payload)}`}
          value={fmtByUnit(payload.overall, m.unit)}
          hint={`${fmtInt(payload.n_encounters)} encounters`}
          tone="accent"
        />
        {latestComplete && (
          <>
            <Kpi
              label={`${fmtYearMonth(latestComplete.year_month)} Actual`}
              value={fmtByUnit(latestComplete.value, m.unit)}
            />
            <Kpi
              label={`${fmtYearMonth(latestComplete.year_month)} Forecast`}
              value={fmtByUnit(latestComplete.forecast, m.unit)}
              hint="6-month trailing baseline"
            />
            <Kpi
              label="Δ vs Forecast"
              value={fmtDeltaByUnit(latestComplete.delta, m.unit)}
              hint={
                m.direction === "lower"
                  ? "Lower is better"
                  : "Higher is better"
              }
              tone={deltaIsBad(latestComplete.delta) ? "warn" : "good"}
            />
          </>
        )}
      </div>

      {/* Actual-vs-forecast trend */}
      <Card
        num="01"
        title="Actual vs Forecast — Monthly"
        sub={
          current
            ? `Forecast = trailing 6-month baseline mean. ${fmtYearMonth(current.year_month)} is in progress (${current.days_observed ?? "?"}/${current.days_in_month} days observed).`
            : "Forecast = trailing 6-month baseline mean."
        }
      >
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={monthly.map((r) => ({
                year_month: r.year_month,
                actual: r.value,
                forecast: r.forecast,
                runrate:
                  r.is_current_month &&
                  r.value != null &&
                  r.days_observed &&
                  r.days_in_month
                    ? (r.value * r.days_in_month) / r.days_observed
                    : null,
                is_current: r.is_current_month,
              }))}
              margin={{ top: 8, right: 16, bottom: 4, left: 0 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="year_month"
                tickLine={false}
                axisLine={false}
                tickFormatter={fmtYearMonth}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => fmtByUnit(v, m.unit)}
              />
              <Tooltip
                content={
                  <ChartTooltip valueFormatter={(v) => fmtByUnit(v, m.unit)} />
                }
                labelFormatter={fmtYearMonth}
              />
              <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="actual" name="Actual" radius={[6, 6, 0, 0]}>
                {monthly.map((r, i) => (
                  <Cell
                    key={i}
                    fill={r.is_current_month ? "#cad5e2" : "#0021A5"}
                    opacity={r.is_current_month ? 0.55 : 1}
                  />
                ))}
              </Bar>
              <Line
                type="monotone"
                dataKey="forecast"
                name="Forecast"
                stroke="#FA4616"
                strokeWidth={2.5}
                strokeDasharray="5 4"
                dot={{ r: 2.5 }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="runrate"
                name="Current Month Run-Rate"
                stroke="#62748e"
                strokeWidth={2}
                strokeDasharray="2 4"
                dot={{ r: 3 }}
                connectNulls={false}
              />
              {current && (
                <ReferenceLine
                  x={current.year_month}
                  stroke="#62748e"
                  strokeDasharray="2 2"
                  label={{
                    value: "In Progress",
                    position: "top",
                    fill: "#62748e",
                    fontSize: 10,
                    fontFamily: "IBM Plex Mono",
                  }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Monthly detail table */}
      <Card num="02" title="Monthly Actual vs Forecast">
        <div className="overflow-x-auto thin-scroll">
          <table className="data-table min-w-[720px]">
            <thead>
              <tr>
                <th>Month</th>
                <th className="text-right">Actual</th>
                <th className="text-right">Forecast</th>
                <th className="text-right">Delta</th>
                <th className="text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((r) => (
                <MonthlyRow key={r.year_month} row={r} unit={m.unit} deltaIsBad={deltaIsBad} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Subcomponent breakdown if metric decomposes */}
      {payload.subcomponents.length > 0 && (
        <Card
          num="03"
          title="Subcomponent Breakdown"
          sub={`${m.label} decomposes into these time segments. Values reflect the current slice.`}
        >
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={payload.subcomponents.map((s) => ({
                  label: s.label,
                  value: s.value,
                }))}
                layout="vertical"
                margin={{ top: 4, right: 32, bottom: 4, left: 4 }}
              >
                <CartesianGrid horizontal={false} />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => fmtByUnit(v, "min")}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  width={220}
                  tickFormatter={(v) => truncate(v, 32)}
                />
                <Tooltip
                  content={<ChartTooltip valueFormatter={(v) => fmtByUnit(v, "min")} />}
                  cursor={{ fill: "#f1f5f9" }}
                />
                <Bar dataKey="value" fill="#0021A5" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 text-[11.5px] text-slate-500">
            Each subcomponent is itself a drillable metric — click a bar label to navigate.
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {payload.subcomponents.map((s) => (
              <Link
                key={s.slug}
                to={`/metrics/${s.slug}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 ring-1 ring-slate-200 px-2.5 py-1 text-[11.5px] font-medium text-slate-700 hover:bg-uf-blue/5 hover:ring-uf-blue/30 hover:text-uf-blue transition-colors"
              >
                <span>{s.label}</span>
                <span className="font-mono text-[10.5px] text-slate-500">
                  {fmtByUnit(s.value, "min")}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Per-location breakdown */}
      {payload.by_location.length > 0 && (
        <Card num="04" title="By ED Location" sub="Value at each site for this metric + slice">
          <LocationBreakdown payload={payload} deltaIsBad={deltaIsBad} />
        </Card>
      )}

      {/* Per-condition breakdown */}
      {payload.by_condition.length > 0 && (
        <Card
          num="05"
          title="By ICD-10 Condition Category"
          sub={`Value for each of the top condition categories. Click a row to pivot the view onto that condition.`}
        >
          <ConditionBreakdown payload={payload} />
        </Card>
      )}
    </div>
  );
}

function sliceLabel(payload: MetricPayload): string {
  if (payload.slice.kind === "all") return "All Sites";
  if (payload.slice.kind === "location") return payload.slice.name;
  return payload.slice.name;
}

function MonthlyRow({
  row,
  unit,
  deltaIsBad,
}: {
  row: MetricMonthlyRow;
  unit: "min" | "pct" | "count" | "score";
  deltaIsBad: (d: number | null | undefined) => boolean;
}) {
  return (
    <tr>
      <td>
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900">
            {fmtYearMonth(row.year_month)}
          </span>
          {row.is_current_month && (
            <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-600">
              In progress · {row.days_observed ?? "?"}/{row.days_in_month}d
            </span>
          )}
        </div>
      </td>
      <td className="text-right num">{fmtByUnit(row.value, unit)}</td>
      <td className="text-right num text-slate-500">
        {fmtByUnit(row.forecast, unit)}
      </td>
      <td
        className={clsx(
          "text-right num font-semibold",
          row.delta == null
            ? "text-slate-400"
            : deltaIsBad(row.delta)
              ? "text-uf-orange"
              : "text-uf-blue"
        )}
      >
        {fmtDeltaByUnit(row.delta, unit)}
      </td>
      <td className="text-right">
        {row.delta == null ? (
          <span className="text-slate-400">—</span>
        ) : deltaIsBad(row.delta) ? (
          <span className="inline-flex items-center rounded-md bg-uf-orange/10 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-uf-orange">
            Worse
          </span>
        ) : (
          <span className="inline-flex items-center rounded-md bg-uf-blue/10 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-uf-blue">
            Better
          </span>
        )}
      </td>
    </tr>
  );
}

function LocationBreakdown({
  payload,
  deltaIsBad,
}: {
  payload: MetricPayload;
  deltaIsBad: (d: number | null | undefined) => boolean;
}) {
  const rows = SITES_ORDER.map(
    (site) => payload.by_location.find((r) => r.location === site) ?? null
  ).filter((r): r is NonNullable<typeof r> => r != null);

  const chartData = rows.map((r) => ({
    site: r.location,
    value: r.value,
    n: r.n,
  }));

  const overall = payload.overall;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3 h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="site" tickLine={false} axisLine={false} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => fmtByUnit(v, payload.metric.unit)}
            />
            <Tooltip
              content={
                <ChartTooltip
                  valueFormatter={(v) => fmtByUnit(v, payload.metric.unit)}
                />
              }
              cursor={{ fill: "#f1f5f9" }}
            />
            {overall != null && (
              <ReferenceLine
                y={overall}
                stroke="#FA4616"
                strokeDasharray="4 3"
                label={{
                  value: `Overall: ${fmtByUnit(overall, payload.metric.unit)}`,
                  position: "insideTopRight",
                  fill: "#FA4616",
                  fontSize: 10,
                  fontFamily: "IBM Plex Mono",
                }}
              />
            )}
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {chartData.map((d) => (
                <Cell key={d.site} fill={LOCATION_COLOR[d.site] ?? "#cad5e2"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="lg:col-span-2">
        <table className="data-table">
          <thead>
            <tr>
              <th>Location</th>
              <th className="text-right">Value</th>
              <th className="text-right">Δ Overall</th>
              <th className="text-right">n</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const delta =
                r.value == null || overall == null
                  ? null
                  : Math.round((r.value - overall) * 100) / 100;
              return (
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
                  <td className="text-right num">{fmtByUnit(r.value, payload.metric.unit)}</td>
                  <td
                    className={clsx(
                      "text-right num",
                      delta == null
                        ? "text-slate-400"
                        : deltaIsBad(delta)
                          ? "text-uf-orange"
                          : "text-uf-blue"
                    )}
                  >
                    {fmtDeltaByUnit(delta, payload.metric.unit)}
                  </td>
                  <td className="text-right num text-slate-500">{fmtInt(r.n)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConditionBreakdown({ payload }: { payload: MetricPayload }) {
  const nav = useNavigate();
  const sorted = [...payload.by_condition]
    .filter((r) => r.n > 0 && r.value != null)
    .sort((a, b) => {
      const av = a.value ?? 0;
      const bv = b.value ?? 0;
      return payload.metric.direction === "lower" ? bv - av : av - bv;
    });

  return (
    <div className="overflow-x-auto thin-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Condition</th>
            <th className="text-right">{payload.metric.label}</th>
            <th className="text-right">n</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={r.slug}
              className="cursor-pointer"
              onClick={() => {
                const next = new URLSearchParams(window.location.search);
                next.set("condition", r.slug);
                next.delete("loc");
                nav(`/metrics/${payload.metric.slug}?${next.toString()}`);
              }}
            >
              <td className="font-medium text-slate-900">{r.condition}</td>
              <td className="text-right num font-semibold">
                {fmtByUnit(r.value, payload.metric.unit)}
              </td>
              <td className="text-right num text-slate-500">{fmtInt(r.n)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ===========================================================================
   Compare view — small multiples OR overlay across location or condition
   =========================================================================== */

function CompareView({
  metricSlug,
  registry,
}: {
  metricSlug: string;
  registry: MetricRegistryEntry;
}) {
  const { dim } = useCompareDimension();
  const { view } = useCompareView();
  const meta = useMeta();

  // Load the "all" payload (enterprise) — we read by_location or by_condition from it.
  // For monthly compare we need to load per-slice monthlies. That gets expensive
  // if there are 16 conditions, so we load on demand via useMetric hooks below.

  const sitesPayloads = SITES_ORDER.map((site) => ({
    site,
    slug: site.toLowerCase().replace(" ", "-"),
    /* eslint-disable-next-line react-hooks/rules-of-hooks */
    payload: useMetric(metricSlug, "location", site.toLowerCase().replace(" ", "-")),
  }));

  const conditionSlugs = meta.data?.conditions.slice(0, 8).map((c) => c.slug) ?? [];
  const conditionPayloads = conditionSlugs.map((slug) => ({
    slug,
    name: meta.data?.conditions.find((c) => c.slug === slug)?.name ?? slug,
    /* eslint-disable-next-line react-hooks/rules-of-hooks */
    payload: useMetric(metricSlug, "condition", slug),
  }));

  if (dim === "location") {
    return view === "overlay" ? (
      <OverlayCompare
        metric={registry}
        series={sitesPayloads.map((s) => ({
          label: s.site,
          color: LOCATION_COLOR[s.site] ?? "#94a3b8",
          monthly: s.payload.data?.monthly ?? [],
        }))}
      />
    ) : (
      <SmallMultiplesCompare
        metric={registry}
        panels={sitesPayloads.map((s) => ({
          label: s.site,
          color: LOCATION_COLOR[s.site] ?? "#94a3b8",
          monthly: s.payload.data?.monthly ?? [],
        }))}
      />
    );
  }

  // condition compare
  return view === "overlay" ? (
    <OverlayCompare
      metric={registry}
      series={conditionPayloads.map((c, i) => ({
        label: c.name,
        color: CONDITION_PALETTE[i % CONDITION_PALETTE.length],
        monthly: c.payload.data?.monthly ?? [],
      }))}
    />
  ) : (
    <SmallMultiplesCompare
      metric={registry}
      panels={conditionPayloads.map((c, i) => ({
        label: c.name,
        color: CONDITION_PALETTE[i % CONDITION_PALETTE.length],
        monthly: c.payload.data?.monthly ?? [],
      }))}
    />
  );
}

const CONDITION_PALETTE = [
  "#0021A5", "#FA4616", "#155dfc", "#1d293d", "#51a2ff",
  "#ff6900", "#62748e", "#8ec5ff",
];

interface CompareSeries {
  label: string;
  color: string;
  monthly: MetricMonthlyRow[];
}

function OverlayCompare({
  metric,
  series,
}: {
  metric: MetricRegistryEntry;
  series: CompareSeries[];
}) {
  // Pivot to one row per month with a column per series
  const allMonths = Array.from(
    new Set(series.flatMap((s) => s.monthly.map((r) => r.year_month)))
  ).sort();
  const wide = allMonths.map((ym) => {
    const rec: Record<string, string | number | null> = { year_month: ym };
    for (const s of series) {
      const row = s.monthly.find((r) => r.year_month === ym);
      rec[s.label] = row?.value ?? null;
    }
    return rec;
  });

  return (
    <Card
      num="01"
      title={`${metric.label} — Overlay`}
      sub="One chart, one colored series per slice. Actuals only; forecast overlay suppressed to keep the view legible."
    >
      <div className="h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={wide} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="year_month"
              tickLine={false}
              axisLine={false}
              tickFormatter={fmtYearMonth}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => fmtByUnit(v, metric.unit)}
            />
            <Tooltip
              content={<ChartTooltip valueFormatter={(v) => fmtByUnit(v, metric.unit)} />}
              labelFormatter={fmtYearMonth}
            />
            <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            {series.map((s) => (
              <Line
                key={s.label}
                type="monotone"
                dataKey={s.label}
                name={s.label}
                stroke={s.color}
                strokeWidth={2.5}
                dot={{ r: 2 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function SmallMultiplesCompare({
  metric,
  panels,
}: {
  metric: MetricRegistryEntry;
  panels: CompareSeries[];
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {panels.map((panel) => {
        const complete = panel.monthly.filter((r) => !r.is_current_month);
        const latest = complete[complete.length - 1];
        const delta = latest?.delta;
        return (
          <Card key={panel.label} num="" title={panel.label} sub={deltaSub(delta, latest?.year_month, metric.unit)}>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={panel.monthly} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="year_month"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={fmtYearMonth}
                    interval="preserveStartEnd"
                    minTickGap={20}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => fmtByUnit(v, metric.unit)}
                    width={48}
                  />
                  <Tooltip
                    content={<ChartTooltip valueFormatter={(v) => fmtByUnit(v, metric.unit)} />}
                    labelFormatter={fmtYearMonth}
                  />
                  <Bar dataKey="value" name="Actual" radius={[4, 4, 0, 0]}>
                    {panel.monthly.map((r, i) => (
                      <Cell
                        key={i}
                        fill={panel.color}
                        opacity={r.is_current_month ? 0.35 : 1}
                      />
                    ))}
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    name="Forecast"
                    stroke="#FA4616"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    dot={{ r: 1.5 }}
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function deltaSub(
  delta: number | null | undefined,
  ym: string | undefined,
  unit: "min" | "pct" | "count" | "score"
): string {
  if (delta == null || !ym) return "No completed month data";
  return `${fmtYearMonth(ym)}: ${fmtDeltaByUnit(delta, unit)} vs forecast`;
}
