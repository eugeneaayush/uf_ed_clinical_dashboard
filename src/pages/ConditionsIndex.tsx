import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/Card";
import { LoadingDots, ErrorState, PageHeader } from "../components/States";
import { useMeta, useJson } from "../lib/data";
import { fmtInt, fmtPct, fmtMinutes } from "../lib/format";
import type { ConditionPayload } from "../lib/types";
import clsx from "clsx";

/** How the index row shows each condition's headline numbers. */
interface ConditionRow {
  slug: string;
  name: string;
  encounters: number;
  admit_rate_pct: number;
  lwbs_rate_pct: number;
  lbtc_rate_pct: number;
  return_30d_any_pct: number;
  return_30d_same_pct: number;
  median_ed_los_min: number | null;
}

type SortKey =
  | "name"
  | "encounters"
  | "admit_rate_pct"
  | "lwbs_rate_pct"
  | "lbtc_rate_pct"
  | "return_30d_any_pct"
  | "return_30d_same_pct"
  | "median_ed_los_min";

export function ConditionsIndex() {
  const meta = useMeta();
  const [sortKey, setSortKey] = useState<SortKey>("encounters");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  if (meta.loading || !meta.data) return <LoadingDots />;
  if (meta.error) return <ErrorState error={meta.error} />;

  return (
    <div>
      <PageHeader
        num="02"
        kicker="Conditions"
        title="Drill down by ICD-10 condition category."
        subtitle="Readmission, LWBS, and LBTC rates for the top 15 condition categories plus AMI (always included as a time-sensitive diagnosis). Click any row to see the site-by-site breakdown and recent patient list."
      />

      <Card
        num="01"
        title={`${meta.data.conditions.length} Condition Categories`}
        sub="Both same-condition (CMS-style) and any-cause return rates are shown. Click a column header to sort."
      >
        <ConditionsTable
          conditions={meta.data.conditions}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={(k) => {
            if (k === sortKey) {
              setSortDir((d) => (d === "asc" ? "desc" : "asc"));
            } else {
              setSortKey(k);
              setSortDir("desc");
            }
          }}
        />
      </Card>
    </div>
  );
}

function ConditionsTable({
  conditions,
  sortKey,
  sortDir,
  onSort,
}: {
  conditions: { name: string; slug: string }[];
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
}) {
  // Load each condition payload (15 parallel fetches, cached)
  const loaded = conditions.map((c) => ({
    ref: c,
    payload: useJson<ConditionPayload>(`/data/conditions/${c.slug}.json`),
  }));

  const rows: ConditionRow[] = loaded
    .filter((l) => l.payload.data)
    .map((l) => {
      const d = l.payload.data!;
      return {
        slug: l.ref.slug,
        name: l.ref.name,
        encounters: d.kpis.encounters,
        admit_rate_pct: d.kpis.admit_rate_pct,
        lwbs_rate_pct: d.kpis.lwbs_rate_pct,
        lbtc_rate_pct: d.kpis.lbtc_rate_pct,
        return_30d_any_pct: d.kpis.return_30d_any_pct,
        return_30d_same_pct: d.kpis.return_30d_same_pct,
        median_ed_los_min: d.kpis.median_ed_los_min,
      };
    });

  const allLoading = loaded.some((l) => l.payload.loading);
  if (allLoading && rows.length === 0) return <LoadingDots />;

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    // null values always last
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "string" && typeof bv === "string") {
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    const na = av as number;
    const nb = bv as number;
    return sortDir === "asc" ? na - nb : nb - na;
  });

  return (
    <div className="overflow-x-auto thin-scroll">
      <table className="data-table min-w-[1000px]">
        <thead>
          <tr>
            <SortTh k="name" label="Condition" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortTh k="encounters" label="Encounters" sortKey={sortKey} sortDir={sortDir} onSort={onSort} right />
            <SortTh k="admit_rate_pct" label="Admit %" sortKey={sortKey} sortDir={sortDir} onSort={onSort} right />
            <SortTh k="median_ed_los_min" label="Median LOS" sortKey={sortKey} sortDir={sortDir} onSort={onSort} right />
            <SortTh k="lwbs_rate_pct" label="LWBS %" sortKey={sortKey} sortDir={sortDir} onSort={onSort} right />
            <SortTh k="lbtc_rate_pct" label="LBTC %" sortKey={sortKey} sortDir={sortDir} onSort={onSort} right />
            <SortTh k="return_30d_any_pct" label="30-day Return (any)" sortKey={sortKey} sortDir={sortDir} onSort={onSort} right />
            <SortTh k="return_30d_same_pct" label="30-day Return (same Dx)" sortKey={sortKey} sortDir={sortDir} onSort={onSort} right />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <ConditionRowView key={r.slug} row={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortTh({
  k,
  label,
  sortKey,
  sortDir,
  onSort,
  right,
}: {
  k: SortKey;
  label: string;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  right?: boolean;
}) {
  const active = k === sortKey;
  return (
    <th className={clsx(right && "text-right")}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={clsx(
          "inline-flex items-center gap-1 hover:text-slate-900 transition-colors",
          active && "text-uf-blue"
        )}
      >
        {label}
        {active && (
          <span aria-hidden className="font-mono text-[9px]">
            {sortDir === "asc" ? "↑" : "↓"}
          </span>
        )}
      </button>
    </th>
  );
}

function ConditionRowView({ row }: { row: ConditionRow }) {
  const nav = useNavigate();
  return (
    <tr
      className="cursor-pointer"
      onClick={() => nav(`/conditions/${row.slug}`)}
    >
      <td>
        <span className="font-medium text-slate-900">{row.name}</span>
      </td>
      <td className="text-right num">{fmtInt(row.encounters)}</td>
      <td className="text-right num">{fmtPct(row.admit_rate_pct)}</td>
      <td className="text-right num">{fmtMinutes(row.median_ed_los_min)}</td>
      <td className="text-right num">{fmtPct(row.lwbs_rate_pct)}</td>
      <td className="text-right num">{fmtPct(row.lbtc_rate_pct)}</td>
      <td className="text-right num font-semibold text-uf-orange">
        {fmtPct(row.return_30d_any_pct)}
      </td>
      <td className="text-right num font-semibold text-uf-blue">
        {fmtPct(row.return_30d_same_pct)}
      </td>
    </tr>
  );
}
