import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
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
  ComposedChart,
  ReferenceLine,
  Legend,
} from "recharts";
import clsx from "clsx";
import { Card } from "../components/Card";
import { Kpi } from "../components/Kpi";
import { ChartTooltip } from "../components/ChartTooltip";
import { LoadingDots, ErrorState, PageHeader } from "../components/States";
import { useDailyReport, useMeta } from "../lib/data";
import { useLocationFilter } from "../lib/filters";
import type {
  DailyReportPayload,
  DispToOrderRow,
  HourlyActivityRow,
  HourlyRollingRow,
  CumulativeHourRow,
  TimeStudySeries,
  AcuityIntervalRow,
} from "../lib/types";
import { fmtInt, fmtDec, truncate } from "../lib/format";
import { ACUITY_COLOR } from "../lib/palette";

/**
 * /daily — Replicates the Shands UF Emergency Department Daily Activity
 * Summary PDF for every ED location. All six PDF sections plus the MD
 * Disposition → Admit Order Written analysis are rendered as interactive
 * charts with sub-tab navigation.
 *
 * Location slug is taken from ?loc=; defaults to "all" (enterprise view).
 */

type SubTab = "1A" | "1B" | "1C" | "1D" | "1E" | "1F" | "MD";

const SUB_TABS: Array<{ id: SubTab; label: string; description: string }> = [
  { id: "1A", label: "Daily Volumes", description: "Registered visits, admits, discharges, LWBS, transfers" },
  { id: "1B", label: "Time Studies", description: "Door-to-Triage/Room/MD/Disposition/Exit (median + P90)" },
  { id: "1C", label: "Hold Hours", description: "Total admitted-patient hold-hours (30-day trending)" },
  { id: "1D", label: "Acuity Levels", description: "ESI distribution by day — all visits and admits-only" },
  { id: "1E", label: "Acuity × Time", description: "Yesterday's ESI mix by 4-hour arrival window" },
  { id: "1F", label: "Overcrowding", description: "Hourly arrivals / waiting / in-ED / bed-ready snapshots" },
  { id: "MD", label: "MD → Order", description: "MD Disposition → Admit Order Written by unit & service" },
];

// Dark-mode chart tokens shared across every Recharts instance on this page.
const GRID_STROKE = "#27272a"; // zinc-800
const TICK_FILL = "#71717a"; // zinc-500
const CURSOR_FILL = "rgba(63, 63, 70, 0.35)"; // zinc-700 @ 35%
const TICK_STYLE = { fill: TICK_FILL, fontSize: 10 } as const;

// Brand + accent palette for line/bar series on dark surfaces.
const COLOR = {
  ufBlue: "#0021A5",
  ufOrange: "#FA4616",
  cyan: "#67e8f9", // cyan-300
  violet: "#a78bfa", // violet-400
  emerald: "#34d399", // emerald-400
  amber: "#f59e0b", // amber-500
  pink: "#f472b6", // pink-400
  rose: "#fb7185", // rose-400
  zinc300: "#d4d4d8",
} as const;

export function DailyReport() {
  const { loc, setLoc } = useLocationFilter();
  const slug = loc; // uses "all" or a location slug
  const { data, loading, error } = useDailyReport(slug);
  const meta = useMeta();
  const [tab, setTab] = useState<SubTab>("1A");

  if (loading || !data) return <LoadingDots />;
  if (error) return <ErrorState error={error} />;

  const siteOptions: Array<{ slug: string; label: string }> = [
    { slug: "all", label: "All Sites" },
    ...(meta.data?.locations ?? []).map((l) => ({ slug: l.slug, label: l.name })),
  ];

  return (
    <div>
      <PageHeader
        num="04"
        kicker="Daily Activity Report"
        title={`${data.location} — daily activity summary.`}
        subtitle={`Replicates the Shands UF ED Daily Activity PDF. Reporting date: ${data.report_date}. Rolling-month window: ${data.rolling_dates[0]} → ${data.rolling_dates[data.rolling_dates.length - 1]}.`}
      />

      {/* Location picker — reuses the global filter */}
      <div className="sticky top-[56px] z-10 -mx-6 mb-6 px-6 py-3 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-500 pr-2">
            ED Site
          </span>
          <div className="inline-flex rounded-full ring-1 ring-zinc-800 bg-zinc-900 p-0.5">
            {siteOptions.map((opt) => (
              <button
                key={opt.slug}
                type="button"
                onClick={() => setLoc(opt.slug as typeof loc)}
                data-active={loc === opt.slug ? "true" : undefined}
                className={clsx(
                  "px-3.5 py-1.5 rounded-full text-[12.5px] font-medium transition-colors",
                  "text-zinc-400 hover:text-zinc-200",
                  "data-[active=true]:bg-uf-blue data-[active=true]:text-white",
                  "data-[active=true]:ring-1 data-[active=true]:ring-uf-blue/40 data-[active=true]:shadow-sm"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Headline KPI block — mirrors PDF page 1's right-side table */}
      <HeadlineKpis payload={data} />

      {/* Sub-tab nav for the PDF sections */}
      <div className="mt-6 mb-4">
        <nav className="inline-flex flex-wrap gap-1 rounded-full bg-zinc-900 ring-1 ring-zinc-800 p-1">
          {SUB_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              data-active={tab === t.id ? "true" : undefined}
              className={clsx(
                "px-3.5 py-1.5 rounded-full whitespace-nowrap transition-colors",
                "text-[13px] font-medium text-zinc-400 hover:text-zinc-200",
                "data-[active=true]:bg-uf-blue/15 data-[active=true]:text-uf-blue",
                "data-[active=true]:ring-1 data-[active=true]:ring-uf-blue/30"
              )}
            >
              <span className="font-mono text-[10.5px] text-zinc-500 mr-1.5 data-[active=true]:text-uf-blue/80">
                {t.id}
              </span>
              {t.label}
            </button>
          ))}
        </nav>
        <p className="mt-3 text-[11.5px] text-zinc-500">
          {SUB_TABS.find((t) => t.id === tab)?.description}
        </p>
      </div>

      {/* Sub-tab content */}
      {tab === "1A" && <Section1A payload={data} />}
      {tab === "1B" && <Section1B payload={data} />}
      {tab === "1C" && <Section1C payload={data} />}
      {tab === "1D" && <Section1D payload={data} />}
      {tab === "1E" && <Section1E payload={data} />}
      {tab === "1F" && <Section1F payload={data} />}
      {tab === "MD" && <SectionMD payload={data} />}
    </div>
  );
}

/* ===========================================================================
   Headline KPIs — PDF page 1 right-side table condensed
   =========================================================================== */

function HeadlineKpis({ payload }: { payload: DailyReportPayload }) {
  const roll = payload.rolling_kpis;
  return (
    <div className="space-y-4">
      {/* 4-tile top row — the volume headliners */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          label="Registered Visits · Avg/Day"
          value={roll.registered_visits != null ? fmtDec(roll.registered_visits, 1) : "—"}
          hint="Rolling 31-day mean"
          tone="accent"
        />
        <Kpi
          label="Admits · Avg/Day"
          value={roll.admits != null ? fmtDec(roll.admits, 1) : "—"}
          hint={`${roll.pct_admits != null ? fmtDec(roll.pct_admits, 1) : "—"}% admit rate`}
        />
        <Kpi
          label="Discharges · Avg/Day"
          value={roll.discharges != null ? fmtDec(roll.discharges, 1) : "—"}
        />
        <Kpi
          label="LWBS · Avg/Day"
          value={roll.lwbs != null ? fmtDec(roll.lwbs, 1) : "—"}
          hint={`${roll.pct_lwbs != null ? fmtDec(roll.pct_lwbs, 1) : "—"}% LWBS rate`}
          tone={roll.pct_lwbs != null && roll.pct_lwbs > 5 ? "warn" : "good"}
        />
      </div>

      {/* EMS quartiles + transfer KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          label="EMS · 12a–6a"
          value={roll.ems_q1 != null ? fmtDec(roll.ems_q1, 1) : "—"}
        />
        <Kpi
          label="EMS · 6a–12p"
          value={roll.ems_q2 != null ? fmtDec(roll.ems_q2, 1) : "—"}
        />
        <Kpi
          label="EMS · 12p–6p"
          value={roll.ems_q3 != null ? fmtDec(roll.ems_q3, 1) : "—"}
        />
        <Kpi
          label="EMS · 6p–12a"
          value={roll.ems_q4 != null ? fmtDec(roll.ems_q4, 1) : "—"}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          label="Transfers from SHED"
          value={roll.transfers_from_shed != null ? fmtDec(roll.transfers_from_shed, 1) : "—"}
        />
        <Kpi
          label="Transfers from KED"
          value={roll.transfers_from_ked != null ? fmtDec(roll.transfers_from_ked, 1) : "—"}
        />
        <Kpi
          label="Admits from Transfers"
          value={roll.admits_due_to_transfers != null ? fmtDec(roll.admits_due_to_transfers, 1) : "—"}
        />
        <Kpi
          label="% Transfers Admitted"
          value={roll.pct_transfers_admitted != null ? `${fmtDec(roll.pct_transfers_admitted, 1)}%` : "—"}
        />
      </div>
    </div>
  );
}

/* ===========================================================================
   Section 1A — Daily Volumes
   =========================================================================== */

const BUCKET_ORDER = ["ADMIT", "DISCHARGE", "LWBS", "ED TO ED TRANSFER", "OTHER"] as const;
const BUCKET_ACCENT: Record<string, string> = {
  ADMIT: "border-l-2 border-uf-blue",
  DISCHARGE: "border-l-2 border-emerald-400",
};

function Section1A({ payload }: { payload: DailyReportPayload }) {
  const volTrend = payload.rolling_dates.map((d, i) => ({
    date: d.slice(5), // "MM-DD"
    encounters: payload.rolling_volumes.registered_visits[i],
    admits: payload.rolling_volumes.admits[i],
    discharges: payload.rolling_volumes.discharges[i],
    lwbs: payload.rolling_volumes.lwbs[i],
    transfers: payload.rolling_volumes.transfers_to_other_ed[i],
  }));

  // Roll up every disposition row into its parent bucket for the breakdown table
  const bucketTotals = useMemo(() => {
    const totals = new Map<string, number>(BUCKET_ORDER.map((b) => [b, 0]));
    for (const row of payload.disposition_breakdown) {
      totals.set(row.bucket, (totals.get(row.bucket) ?? 0) + row.total);
    }
    return BUCKET_ORDER.map((bucket) => ({ bucket, total: totals.get(bucket) ?? 0 }));
  }, [payload.disposition_breakdown]);
  const grandTotal = bucketTotals.reduce((s, r) => s + r.total, 0);

  return (
    <div className="space-y-6">
      <Card
        num="01"
        title="Rolling-Month Daily Volume Trend"
        sub="31 days of encounters with admits, discharges, LWBS, and transfers overlaid"
      >
        <div className="h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={volTrend} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID_STROKE} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tick={TICK_STYLE} interval="preserveStartEnd" minTickGap={20} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: TICK_FILL }} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: CURSOR_FILL }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: TICK_FILL }} />
              <Line isAnimationActive={false} type="monotone" dataKey="encounters" name="Encounters" stroke={COLOR.ufBlue} strokeWidth={2.5} dot={{ r: 2 }} />
              <Line isAnimationActive={false} type="monotone" dataKey="admits" name="Admits" stroke={COLOR.ufOrange} strokeWidth={2} dot={{ r: 2 }} />
              <Line isAnimationActive={false} type="monotone" dataKey="discharges" name="Discharges" stroke={COLOR.cyan} strokeWidth={2} dot={{ r: 2 }} />
              <Line isAnimationActive={false} type="monotone" dataKey="lwbs" name="LWBS" stroke={COLOR.violet} strokeWidth={1.5} dot={{ r: 2 }} />
              <Line isAnimationActive={false} type="monotone" dataKey="transfers" name="Transfers" stroke={COLOR.emerald} strokeWidth={1.5} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card
        num="02"
        title="Trailing 4-Day Volume Detail"
        sub="Most recent 4 days with every KPI from the daily summary"
      >
        <div className="overflow-x-auto thin-scroll">
          <table className="w-full min-w-[640px] text-[12.5px]">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500 font-medium text-left px-3 py-2.5">Visit Type</th>
                {payload.four_day_dates.map((d) => (
                  <th key={d} className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500 font-medium text-right px-3 py-2.5">
                    {d.slice(5)}
                  </th>
                ))}
                <th className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500 font-medium text-right px-3 py-2.5">Avg</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["Registered Visits", "registered_visits"],
                  ["Admits", "admits"],
                  ["Discharges", "discharges"],
                  ["LWBS", "lwbs"],
                  ["LDT", "ldt"],
                  ["Other", "other"],
                  ["EMS (Mid–6A)", "ems_q1"],
                  ["EMS (6A–Noon)", "ems_q2"],
                  ["EMS (Noon–6P)", "ems_q3"],
                  ["EMS (6P–Mid)", "ems_q4"],
                  ["% Admits", "pct_admits"],
                  ["% Admits w/o FSED", "pct_admits_wo_fsed"],
                  ["% LWBS", "pct_lwbs"],
                  ["Transfers → Psy", "transfer_to_psy"],
                  ["Transfers from SHED", "transfers_from_shed"],
                  ["Transfers from KED", "transfers_from_ked"],
                  ["Total FSED Transfers", "total_transfers_from_fsed"],
                  ["Admits from Transfers", "admits_due_to_transfers"],
                  ["% Transfers Admitted", "pct_transfers_admitted"],
                ] as Array<[string, keyof DailyReportPayload["four_day_volumes"]]>
              ).map(([label, key]) => {
                const vals = payload.four_day_volumes[key] as number[];
                const avg = (payload.four_day_kpis as unknown as Record<string, number | null>)[key as string];
                const isPct = (key as string).startsWith("pct_");
                const fmt = (v: number) => (isPct ? `${fmtDec(v, 1)}%` : fmtInt(v));
                return (
                  <tr key={key} className="border-b border-zinc-900 hover:bg-zinc-900/60">
                    <td className="px-3 py-2.5 font-medium text-zinc-400">{label}</td>
                    {vals.map((v, i) => (
                      <td key={i} className="px-3 py-2.5 text-right font-mono tabular-nums text-zinc-200">
                        {fmt(v)}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold text-zinc-100">
                      {avg != null ? fmt(avg) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        num="03"
        title="Disposition Breakdown (Rolling Month)"
        sub="Rolling 31-day totals for each disposition bucket, as a share of all encounters."
      >
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500 font-medium text-left px-3 py-2.5">Disposition Bucket</th>
              <th className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500 font-medium text-right px-3 py-2.5">31-day Total</th>
              <th className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500 font-medium text-right px-3 py-2.5">Avg / Day</th>
              <th className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500 font-medium text-right px-3 py-2.5">% of Total</th>
            </tr>
          </thead>
          <tbody>
            {bucketTotals.map((r) => (
              <tr key={r.bucket} className={clsx("border-b border-zinc-900 hover:bg-zinc-900/60", BUCKET_ACCENT[r.bucket])}>
                <td className="px-3 py-2.5 font-medium text-zinc-100">{r.bucket}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-zinc-200">{fmtInt(r.total)}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-zinc-400">
                  {fmtDec(r.total / 31, 1)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-zinc-400">
                  {grandTotal > 0 ? ((100 * r.total) / grandTotal).toFixed(1) : "0.0"}%
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-zinc-700">
              <td className="px-3 py-2.5 font-semibold text-zinc-100">TOTAL</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold text-zinc-100">{fmtInt(grandTotal)}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold text-zinc-400">
                {fmtDec(grandTotal / 31, 1)}
              </td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold text-zinc-400">100.0%</td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ===========================================================================
   Section 1B — Time Studies
   =========================================================================== */

function Section1B({ payload }: { payload: DailyReportPayload }) {
  // User can toggle mode (all/ems/non-ems), disposition subset (all/admit/discharge), stat (median/p90)
  const [mode, setMode] = useState<"all" | "ems" | "non-ems">("all");
  const [disp, setDisp] = useState<"all" | "admit" | "discharge">("all");
  const [stat, setStat] = useState<"median" | "p90">("median");

  // P90 only exists for mode=all (per pipeline)
  const effectiveStat = mode === "all" ? stat : "median";
  const key = `${mode}__${disp}__${effectiveStat}`;
  const series: TimeStudySeries | undefined = payload.time_studies[key];

  const chartData = useMemo(() => {
    if (!series) return [];
    return series.date.map((d, i) => ({
      date: d.slice(5),
      to_triage: series.to_triage[i],
      to_room: series.to_room[i],
      to_md: series.to_md[i],
      to_disposition: series.to_disposition[i],
      to_exit: series.to_exit[i],
      to_order_written: series.to_order_written?.[i] ?? null,
      to_bed_ready: series.to_bed_ready?.[i] ?? null,
    }));
  }, [series]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-xl ring-1 ring-zinc-800 bg-zinc-900/60 p-3">
        <ToggleGroup
          label="Mode"
          options={[
            { id: "all", label: "Overall" },
            { id: "ems", label: "EMS" },
            { id: "non-ems", label: "Non-EMS" },
          ]}
          value={mode}
          onChange={(v) => setMode(v as typeof mode)}
        />
        <ToggleGroup
          label="Disposition"
          options={[
            { id: "all", label: "All" },
            { id: "admit", label: "Admit" },
            { id: "discharge", label: "Discharge" },
          ]}
          value={disp}
          onChange={(v) => setDisp(v as typeof disp)}
        />
        <ToggleGroup
          label="Statistic"
          options={[
            { id: "median", label: "Median" },
            { id: "p90", label: "P90", disabled: mode !== "all" },
          ]}
          value={effectiveStat}
          onChange={(v) => setStat(v as typeof stat)}
        />
      </div>

      <Card
        num="01"
        title={`Daily Time Study — ${labelFor(mode)} · ${labelFor(disp)} · ${effectiveStat === "median" ? "Median" : "90th Percentile"}`}
        sub="All durations measured from Arrival to the named event, in hours. 31-day rolling window."
      >
        <div className="h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID_STROKE} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tick={TICK_STYLE} interval="preserveStartEnd" minTickGap={20} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: TICK_FILL }}
                tickFormatter={(v: number) => `${v}h`}
              />
              <Tooltip
                cursor={{ fill: CURSOR_FILL }}
                content={
                  <ChartTooltip
                    valueFormatter={(v) =>
                      typeof v === "number" ? `${fmtDec(v, 2)}h` : String(v)
                    }
                  />
                }
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: TICK_FILL }} />
              {/* 3.5h discharge target when showing discharge subset */}
              {disp === "discharge" && (
                <ReferenceLine
                  y={3.5}
                  stroke={COLOR.ufOrange}
                  strokeDasharray="4 3"
                  label={{
                    value: "3.5h Discharge Target",
                    position: "insideTopRight",
                    fill: COLOR.ufOrange,
                    fontSize: 10,
                    fontFamily: "IBM Plex Mono",
                  }}
                />
              )}
              <Line isAnimationActive={false} type="monotone" dataKey="to_triage" name="To Triage" stroke={COLOR.cyan} strokeWidth={1.5} dot={{ r: 1.5 }} connectNulls />
              <Line isAnimationActive={false} type="monotone" dataKey="to_room" name="To Room" stroke={COLOR.violet} strokeWidth={1.5} dot={{ r: 1.5 }} connectNulls />
              <Line isAnimationActive={false} type="monotone" dataKey="to_md" name="To MD" stroke={COLOR.emerald} strokeWidth={1.5} dot={{ r: 1.5 }} connectNulls />
              <Line isAnimationActive={false} type="monotone" dataKey="to_disposition" name="To Disposition" stroke={COLOR.ufBlue} strokeWidth={2} dot={{ r: 2 }} connectNulls />
              {disp === "admit" && (
                <>
                  <Line isAnimationActive={false} type="monotone" dataKey="to_order_written" name="To Order Written" stroke={COLOR.amber} strokeWidth={2} dot={{ r: 2 }} connectNulls />
                  <Line isAnimationActive={false} type="monotone" dataKey="to_bed_ready" name="To Bed Ready" stroke={COLOR.pink} strokeWidth={2} dot={{ r: 2 }} connectNulls />
                </>
              )}
              <Line isAnimationActive={false} type="monotone" dataKey="to_exit" name="To Exit" stroke={COLOR.ufOrange} strokeWidth={2.5} dot={{ r: 2 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card
        num="02"
        title="Summary Table"
        sub="Median per column across the 31-day window"
      >
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500 font-medium text-left px-3 py-2.5">Series</th>
              <th className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500 font-medium text-right px-3 py-2.5">
                31-Day {effectiveStat === "median" ? "Median" : "P90"} (hrs)
              </th>
              <th className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500 font-medium text-right px-3 py-2.5">Min</th>
              <th className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500 font-medium text-right px-3 py-2.5">Max</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ["To Triage", "to_triage"],
                ["To Room", "to_room"],
                ["To MD", "to_md"],
                ["To Disposition", "to_disposition"],
                ...(disp === "admit"
                  ? ([
                      ["To Order Written", "to_order_written"],
                      ["To Bed Ready", "to_bed_ready"],
                    ] as Array<[string, keyof TimeStudySeries]>)
                  : []),
                ["To Exit", "to_exit"],
              ] as Array<[string, keyof TimeStudySeries]>
            ).map(([label, field]) => {
              const vals = ((series?.[field] ?? []) as (number | null)[]).filter(
                (v): v is number => v != null
              );
              if (!vals.length) return null;
              const median = [...vals].sort((a, b) => a - b)[Math.floor(vals.length / 2)];
              return (
                <tr key={field} className="border-b border-zinc-900 hover:bg-zinc-900/60">
                  <td className="px-3 py-2.5 font-medium text-zinc-400">{label}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold text-zinc-100">{fmtDec(median, 2)}h</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-zinc-500">{fmtDec(Math.min(...vals), 2)}h</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-zinc-500">{fmtDec(Math.max(...vals), 2)}h</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ===========================================================================
   Section 1C — Hold Hours
   =========================================================================== */

function Section1C({ payload }: { payload: DailyReportPayload }) {
  const chartData = payload.hold_hours.date.map((d, i) => ({
    date: d.slice(5),
    hold_hours: payload.hold_hours.hold_hours[i],
    encounters: payload.hold_hours.encounters[i],
    lwbs: payload.hold_hours.lwbs[i],
  }));
  const cmp = payload.hold_comparison;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Yesterday" value={fmtInt(cmp.total_hold_hours_yesterday)} hint="Total hold hrs" tone="accent" />
        <Kpi label="Avg Last 30d" value={fmtInt(cmp.avg_hold_hours_last_30)} />
        <Kpi label="Avg Last 7d" value={fmtInt(cmp.avg_hold_hours_last_7)} />
        <Kpi label="Median Last 30d" value={fmtInt(cmp.median_hold_hours_last_30)} />
        <Kpi label="Median Last 7d" value={fmtInt(cmp.median_hold_hours_last_7)} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          label="% Dev vs Month Avg"
          value={`${cmp.pct_dev_last_month_avg > 0 ? "+" : ""}${fmtDec(cmp.pct_dev_last_month_avg, 1)}%`}
          tone={cmp.pct_dev_last_month_avg > 0 ? "warn" : "good"}
        />
        <Kpi
          label="% Dev vs Week Avg"
          value={`${cmp.pct_dev_last_week_avg > 0 ? "+" : ""}${fmtDec(cmp.pct_dev_last_week_avg, 1)}%`}
          tone={cmp.pct_dev_last_week_avg > 0 ? "warn" : "good"}
        />
        <Kpi
          label="% Dev vs Month Median"
          value={`${cmp.pct_dev_last_month_median > 0 ? "+" : ""}${fmtDec(cmp.pct_dev_last_month_median, 1)}%`}
          tone={cmp.pct_dev_last_month_median > 0 ? "warn" : "good"}
        />
        <Kpi
          label="% Dev vs Week Median"
          value={`${cmp.pct_dev_last_week_median > 0 ? "+" : ""}${fmtDec(cmp.pct_dev_last_week_median, 1)}%`}
          tone={cmp.pct_dev_last_week_median > 0 ? "warn" : "good"}
        />
      </div>

      <Card
        num="01"
        title="Total Hold Hours (Admitted Patients) — Rolling Month"
        sub="Hold hours = sum of (Exit − Disposition) time for every admit on each day. Encounter + LWBS overlays show demand context."
      >
        <div className="h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID_STROKE} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tick={TICK_STYLE} interval="preserveStartEnd" minTickGap={20} />
              <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fill: TICK_FILL }} />
              <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fill: TICK_FILL }} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: CURSOR_FILL }} />
              <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11, color: TICK_FILL }} />
              <Bar
                isAnimationActive={false}
                yAxisId="left"
                dataKey="hold_hours"
                name="Hold Hours"
                fill={COLOR.ufOrange}
                radius={[4, 4, 0, 0]}
              />
              <Line
                isAnimationActive={false}
                yAxisId="right"
                type="monotone"
                dataKey="encounters"
                name="Encounters"
                stroke={COLOR.ufBlue}
                strokeWidth={2}
                dot={{ r: 1.5 }}
              />
              <Line
                isAnimationActive={false}
                yAxisId="right"
                type="monotone"
                dataKey="lwbs"
                name="LWBS"
                stroke={COLOR.violet}
                strokeWidth={1.5}
                dot={{ r: 1.5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

/* ===========================================================================
   Section 1D — Acuity Levels
   =========================================================================== */

function Section1D({ payload }: { payload: DailyReportPayload }) {
  const [subset, setSubset] = useState<"all" | "admits">("all");
  const source = subset === "all" ? payload.acuity_all_daily : payload.acuity_admits_daily;
  const chartData = source.date.map((d, i) => ({
    date: d.slice(5),
    "ESI-1": source["ESI-1"][i],
    "ESI-2": source["ESI-2"][i],
    "ESI-3": source["ESI-3"][i],
    "ESI-4": source["ESI-4"][i],
    "ESI-5": source["ESI-5"][i],
    Unknown: source.Unknown[i],
  }));
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 rounded-xl ring-1 ring-zinc-800 bg-zinc-900/60 p-3">
        <ToggleGroup
          label="Include"
          options={[
            { id: "all", label: "All Visit Types" },
            { id: "admits", label: "Admits Only" },
          ]}
          value={subset}
          onChange={(v) => setSubset(v as typeof subset)}
        />
      </div>
      <Card
        num="01"
        title={`Daily Acuity — ${subset === "all" ? "All Visit Types" : "Admits Only"}`}
        sub="Stacked ESI triage levels across the 31-day rolling month"
      >
        <div className="h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID_STROKE} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tick={TICK_STYLE} interval="preserveStartEnd" minTickGap={20} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: TICK_FILL }} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: CURSOR_FILL }} />
              <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11, color: TICK_FILL }} />
              {(["ESI-1", "ESI-2", "ESI-3", "ESI-4", "ESI-5", "Unknown"] as const).map((a) => (
                <Bar isAnimationActive={false} key={a} dataKey={a} stackId="a" fill={ACUITY_COLOR[a] ?? "#3f3f46"} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

/* ===========================================================================
   Section 1E — Acuity by Time Interval (single day)
   =========================================================================== */

function Section1E({ payload }: { payload: DailyReportPayload }) {
  const rows: AcuityIntervalRow[] = payload.acuity_by_interval;
  return (
    <Card
      num="01"
      title={`Acuity Volumes by Time Interval — ${payload.report_date}`}
      sub="ESI mix across 4-hour arrival windows on the most recent complete day"
    >
      <div className="h-[340px] mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="interval" tickLine={false} axisLine={false} tick={{ fill: TICK_FILL, fontSize: 11 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: TICK_FILL }} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: CURSOR_FILL }} />
            <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11, color: TICK_FILL }} />
            {(["ESI-1", "ESI-2", "ESI-3", "ESI-4", "ESI-5"] as const).map((a) => (
              <Bar isAnimationActive={false} key={a} dataKey={a} stackId="a" fill={ACUITY_COLOR[a]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500 font-medium text-left px-3 py-2.5">Interval</th>
            <th className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500 font-medium text-right px-3 py-2.5">ESI-1</th>
            <th className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500 font-medium text-right px-3 py-2.5">ESI-2</th>
            <th className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500 font-medium text-right px-3 py-2.5">ESI-3</th>
            <th className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500 font-medium text-right px-3 py-2.5">ESI-4</th>
            <th className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500 font-medium text-right px-3 py-2.5">ESI-5</th>
            <th className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500 font-medium text-right px-3 py-2.5">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.interval} className="border-b border-zinc-900 hover:bg-zinc-900/60">
              <td className="px-3 py-2.5 font-medium text-zinc-200">{r.interval}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums text-zinc-200">{r["ESI-1"]}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums text-zinc-200">{r["ESI-2"]}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums text-zinc-200">{r["ESI-3"]}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums text-zinc-200">{r["ESI-4"]}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums text-zinc-200">{r["ESI-5"]}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold text-zinc-100">{r.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/* ===========================================================================
   Section 1F — Overcrowding (hourly)
   =========================================================================== */

function Section1F({ payload }: { payload: DailyReportPayload }) {
  const [view, setView] = useState<"today" | "cumulative" | "rolling">("today");
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 rounded-xl ring-1 ring-zinc-800 bg-zinc-900/60 p-3">
        <ToggleGroup
          label="View"
          options={[
            { id: "today", label: `Today (${payload.report_date})` },
            { id: "cumulative", label: "Cumulative Today" },
            { id: "rolling", label: "Rolling-Month Avg" },
          ]}
          value={view}
          onChange={(v) => setView(v as typeof view)}
        />
      </div>
      {view === "today" && <HourlyToday rows={payload.hourly_today} />}
      {view === "cumulative" && <HourlyCumulative rows={payload.cumulative_today} />}
      {view === "rolling" && <HourlyRolling rows={payload.hourly_rolling_avg} />}
    </div>
  );
}

function HourlyToday({ rows }: { rows: HourlyActivityRow[] }) {
  return (
    <Card
      num="01"
      title="Hourly Activity — Arrivals vs Census vs Wait"
      sub="Arrivals bars plus total-in-ED, total-in-waiting, and max-wait-hours line overlays. The orange max-wait line is the boarding-crisis signal."
    >
      <div className="h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" tick={{ fill: TICK_FILL, fontSize: 10 }} />
            <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fill: TICK_FILL }} />
            <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fill: TICK_FILL }} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: CURSOR_FILL }} />
            <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11, color: TICK_FILL }} />
            <Bar isAnimationActive={false} yAxisId="left" dataKey="arrivals" name="Arrivals" fill={COLOR.ufBlue} radius={[3, 3, 0, 0]} />
            <Line isAnimationActive={false} yAxisId="right" type="monotone" dataKey="total_in_ed" name="Total in ED" stroke={COLOR.cyan} strokeWidth={2} dot={{ r: 1.5 }} />
            <Line isAnimationActive={false} yAxisId="right" type="monotone" dataKey="total_in_waiting" name="Total in Waiting" stroke={COLOR.ufOrange} strokeWidth={2} dot={{ r: 1.5 }} />
            <Line
              isAnimationActive={false}
              yAxisId="right"
              type="monotone"
              dataKey="max_hrs_waiting_rm"
              name="Max Wait (hrs)"
              stroke={COLOR.ufOrange}
              strokeWidth={3}
              dot={{ r: 2, fill: COLOR.ufOrange }}
              style={{ filter: "drop-shadow(0 0 6px rgba(250,70,22,0.6))" }}
            />
            <Line isAnimationActive={false} yAxisId="right" type="monotone" dataKey="lwbs" name="LWBS" stroke={COLOR.violet} strokeWidth={1.5} dot={{ r: 1.5 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function HourlyCumulative({ rows }: { rows: CumulativeHourRow[] }) {
  return (
    <Card
      num="01"
      title="Cumulative Arrivals / Admit-Dispo / Bed-Ready"
      sub="Running totals throughout the day — tracks how ED volume accumulates"
    >
      <div className="h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" tick={{ fill: TICK_FILL, fontSize: 10 }} />
            <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fill: TICK_FILL }} />
            <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fill: TICK_FILL }} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: CURSOR_FILL }} />
            <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11, color: TICK_FILL }} />
            <Bar isAnimationActive={false} yAxisId="left" dataKey="cumulative_arrivals" name="Cum Arrivals" fill={COLOR.ufBlue} radius={[3, 3, 0, 0]} />
            <Line isAnimationActive={false} yAxisId="right" type="monotone" dataKey="cumulative_admit_dispo" name="Cum Admit Dispo" stroke={COLOR.cyan} strokeWidth={2.5} dot={{ r: 2 }} />
            <Line isAnimationActive={false} yAxisId="right" type="monotone" dataKey="cumulative_bed_ready" name="Cum Bed Ready" stroke={COLOR.ufOrange} strokeWidth={2.5} dot={{ r: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function HourlyRolling({ rows }: { rows: HourlyRollingRow[] }) {
  return (
    <Card
      num="01"
      title="Rolling-Month Average Hourly Profile"
      sub="Averages across all 31 days — reveals the time-of-day demand pattern"
    >
      <div className="h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" tick={{ fill: TICK_FILL, fontSize: 10 }} />
            <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fill: TICK_FILL }} />
            <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fill: TICK_FILL }} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: CURSOR_FILL }} />
            <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11, color: TICK_FILL }} />
            <Bar isAnimationActive={false} yAxisId="left" dataKey="arrivals" name="Avg Arrivals" fill={COLOR.ufBlue} radius={[3, 3, 0, 0]} />
            <Line isAnimationActive={false} yAxisId="right" type="monotone" dataKey="total_in_ed" name="Avg in ED" stroke={COLOR.cyan} strokeWidth={2} dot={{ r: 1.5 }} />
            <Line isAnimationActive={false} yAxisId="right" type="monotone" dataKey="total_in_waiting" name="Avg in Waiting" stroke={COLOR.ufOrange} strokeWidth={2} dot={{ r: 1.5 }} />
            <Line isAnimationActive={false} yAxisId="right" type="monotone" dataKey="lwbs" name="Avg LWBS" stroke={COLOR.violet} strokeWidth={1.5} dot={{ r: 1.5 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* ===========================================================================
   MD Dispo → Admit Order Written
   =========================================================================== */

function SectionMD({ payload }: { payload: DailyReportPayload }) {
  const [grouping, setGrouping] = useState<"unit" | "service">("service");
  const [window, setWindow] = useState<"rolling" | "singleday">("rolling");

  const rows: DispToOrderRow[] =
    grouping === "unit"
      ? window === "rolling"
        ? payload.disp_to_order_by_unit_rolling
        : payload.disp_to_order_by_unit_singleday
      : window === "rolling"
        ? payload.disp_to_order_by_service_rolling
        : payload.disp_to_order_by_service_singleday;

  if (rows.length === 0) {
    return (
      <Card num="01" title="MD Disposition → Admit Order Written" sub="Admit unit and admit service analysis">
        <div className="p-8 text-center">
          <p className="text-[14px] text-zinc-300 mb-2">
            Admit Unit and Admit Service data not available in the current BO pull.
          </p>
          <p className="text-[12px] text-zinc-500">
            To enable this section, include{" "}
            <code className="font-mono bg-zinc-800 text-zinc-200 px-1.5 py-0.5 rounded">Admit Unit</code>{" "}
            and <code className="font-mono bg-zinc-800 text-zinc-200 px-1.5 py-0.5 rounded">Admit Service</code>{" "}
            columns in the BO data export. Once present, re-run the aggregator (
            <code className="font-mono bg-zinc-800 text-zinc-200 px-1.5 py-0.5 rounded">npm run aggregate</code>
            ) and this section will populate automatically.
          </p>
        </div>
      </Card>
    );
  }

  const capped = rows.slice(0, Math.min(20, rows.length));
  const maxAdmits = Math.max(...capped.map((r) => r.admits));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-xl ring-1 ring-zinc-800 bg-zinc-900/60 p-3">
        <ToggleGroup
          label="Group By"
          options={[
            { id: "service", label: "Admit Service" },
            { id: "unit", label: "Admit Unit" },
          ]}
          value={grouping}
          onChange={(v) => setGrouping(v as typeof grouping)}
        />
        <ToggleGroup
          label="Window"
          options={[
            { id: "rolling", label: "Rolling Month" },
            { id: "singleday", label: `Yesterday (${payload.report_date})` },
          ]}
          value={window}
          onChange={(v) => setWindow(v as typeof window)}
        />
      </div>

      <Card
        num="01"
        title={`MD Dispo → Order Written by Admit ${grouping === "unit" ? "Unit" : "Service"}`}
        sub={`${window === "rolling" ? "Rolling-month" : "Single-day"} average hours from Disposition to Admit Order Written. Orange line = 1-hour goal. Admits count (blue) overlaid.`}
      >
        <div className="h-[480px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={capped}
              layout="vertical"
              margin={{ top: 4, right: 24, bottom: 4, left: 4 }}
            >
              <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tick={{ fill: TICK_FILL }}
                tickFormatter={(v: number) => `${v}h`}
                domain={[0, "auto"]}
              />
              <YAxis
                type="category"
                dataKey="group"
                tickLine={false}
                axisLine={false}
                width={200}
                tick={{ fill: TICK_FILL, fontSize: 11 }}
                tickFormatter={(v) => truncate(v, 28)}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    valueFormatter={(v) =>
                      typeof v === "number" ? `${fmtDec(v, 2)}h` : String(v)
                    }
                  />
                }
                cursor={{ fill: CURSOR_FILL }}
              />
              <ReferenceLine x={1} stroke={COLOR.ufOrange} strokeDasharray="3 3" />
              <Bar isAnimationActive={false} dataKey="avg_hours" name="Avg Hours" fill={COLOR.ufBlue} radius={[0, 4, 4, 0]}>
                {capped.map((_, i) => (
                  <Cell
                    key={i}
                    fill={(capped[i].avg_hours ?? 0) > 1 ? COLOR.ufOrange : COLOR.ufBlue}
                  />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card num="02" title="Full Table" sub="Every group with non-zero admits, sorted by longest delay first">
        <div className="overflow-x-auto thin-scroll">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500 font-medium text-left px-3 py-2.5">
                  {grouping === "unit" ? "Admit Unit" : "Admit Service"}
                </th>
                <th className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500 font-medium text-right px-3 py-2.5">Avg Hrs Dispo → Order</th>
                <th className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500 font-medium text-right px-3 py-2.5"># Admits</th>
                <th className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500 font-medium text-right px-3 py-2.5">% of Total Admits</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pct = maxAdmits > 0 ? (100 * r.admits) / maxAdmits : 0;
                const overGoal = (r.avg_hours ?? 0) > 1;
                return (
                  <tr key={r.group} className="border-b border-zinc-900 hover:bg-zinc-900/60">
                    <td className="px-3 py-2.5 font-medium text-zinc-100">{r.group}</td>
                    <td className={clsx("px-3 py-2.5 text-right font-mono tabular-nums", overGoal ? "text-uf-orange font-semibold" : "text-zinc-200")}>
                      {r.avg_hours != null ? `${fmtDec(r.avg_hours, 2)}h` : "—"}
                      {overGoal && (
                        <span className="ml-1.5 inline-flex items-center rounded-md bg-uf-orange/10 px-1 py-0.5 font-mono text-[9.5px] font-semibold text-uf-orange ring-1 ring-uf-orange/30">
                          &gt; 1h
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-zinc-200">{fmtInt(r.admits)}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-zinc-500">{pct.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {payload.top_admit_services_24h.length > 0 && (
        <Card
          num="03"
          title={`Top 2 Admit Services — Last 24 Hours (by ED Exit Date = ${payload.report_date})`}
          sub="Replicates the PDF's top-2 admit service panel"
        >
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500 font-medium text-right px-3 py-2.5">Rank</th>
                <th className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500 font-medium text-left px-3 py-2.5">Admit Service</th>
                <th className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500 font-medium text-right px-3 py-2.5"># Admits</th>
                <th className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500 font-medium text-right px-3 py-2.5">% Admits</th>
                <th className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500 font-medium text-right px-3 py-2.5">Avg ED LOS</th>
              </tr>
            </thead>
            <tbody>
              {payload.top_admit_services_24h.map((r) => (
                <tr key={r.rank + r.service} className="border-b border-zinc-900 hover:bg-zinc-900/60">
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold text-zinc-100">{r.rank}</td>
                  <td className="px-3 py-2.5 font-medium text-zinc-100">{r.service}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-zinc-200">{fmtInt(r.admits)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-zinc-200">{fmtDec(r.pct_admits, 2)}%</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-zinc-200">{r.avg_ed_los_hrs != null ? `${fmtDec(r.avg_ed_los_hrs, 2)}h` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

/* ===========================================================================
   Shared tiny building blocks
   =========================================================================== */

function ToggleGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ id: T; label: string; disabled?: boolean }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-zinc-500">{label}</span>
      <div className="inline-flex rounded-full ring-1 ring-zinc-800 bg-zinc-950 p-0.5">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            disabled={o.disabled}
            onClick={() => !o.disabled && onChange(o.id)}
            data-active={value === o.id ? "true" : undefined}
            className={clsx(
              "px-3 py-1 rounded-full text-[11.5px] font-medium transition-colors",
              o.disabled
                ? "text-zinc-600 cursor-not-allowed"
                : "text-zinc-400 hover:text-zinc-200",
              "data-[active=true]:bg-uf-blue data-[active=true]:text-white"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function labelFor(v: string): string {
  return {
    all: "All",
    ems: "EMS Only",
    "non-ems": "Non-EMS",
    admit: "Admit",
    discharge: "Discharge",
  }[v] ?? v;
}

// Unused helper deliberately exported so tree-shake doesn't complain if ever unused later.
export const _DailyReportLink = Link;
