import { useNavigate } from "react-router-dom";
import { LoadingDots, ErrorState, PageHeader } from "../components/States";
import { useMetricIndex } from "../lib/data";
import type { MetricRegistryEntry } from "../lib/types";

const CATEGORY_ORDER = [
  "Volume",
  "Throughput",
  "EMS",
  "Attrition",
  "Readmission",
  "Outcomes",
];

const CATEGORY_COPY: Record<string, string> = {
  Volume: "Raw encounter volume and case-mix acuity.",
  Throughput:
    "Time-based metrics. ED LOS decomposes into five clinical segments; Boarding decomposes into six admit-pathway segments.",
  EMS: "Ambulance offload and EMS-only handover metrics.",
  Attrition: "Patients who leave before care is complete.",
  Readmission: "Unplanned ED return visits by the same MRN.",
  Outcomes: "Disposition-level rates across all encounters.",
};

export function MetricsIndex() {
  const { data, loading, error } = useMetricIndex();
  const nav = useNavigate();

  if (loading || !data) return <LoadingDots />;
  if (error) return <ErrorState error={error} />;

  const grouped = new Map<string, MetricRegistryEntry[]>();
  for (const m of data.metrics) {
    if (!grouped.has(m.category)) grouped.set(m.category, []);
    grouped.get(m.category)!.push(m);
  }

  return (
    <div>
      <PageHeader
        num="02"
        kicker="Metrics"
        title="Drill down by metric."
        subtitle="Every clinical metric has its own drill-down page with actual-vs-forecast trend, ED-site breakdown, ICD-10 condition breakdown, and subcomponent decomposition where applicable."
      />

      <div className="space-y-8">
        {CATEGORY_ORDER.filter((c) => grouped.has(c)).map((cat, ci) => (
          <section key={cat}>
            <div className="flex items-baseline gap-3 mb-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-uf-blue">
                {String(ci + 1).padStart(2, "0")}
              </span>
              <h2 className="font-display text-[22px] font-extrabold tracking-tight text-slate-900">
                {cat}
              </h2>
            </div>
            <p className="text-[12.5px] text-slate-500 mb-4 max-w-2xl">
              {CATEGORY_COPY[cat]}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {grouped.get(cat)!.map((m) => (
                <button
                  key={m.slug}
                  type="button"
                  onClick={() => nav(`/metrics/${m.slug}`)}
                  className="group text-left rounded-2xl ring-1 ring-slate-200 bg-white hover:ring-uf-blue/40 hover:shadow-card-hover transition-all p-4"
                >
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <span className="font-display text-[15px] font-bold text-slate-900 group-hover:text-uf-blue transition-colors">
                      {m.label}
                    </span>
                    <UnitBadge unit={m.unit} />
                  </div>
                  <p className="text-[12px] text-slate-500 leading-relaxed line-clamp-2">
                    {m.description}
                  </p>
                  {m.subcomponent_slugs.length > 0 && (
                    <div className="mt-2 font-mono text-[10.5px] text-slate-500">
                      {m.subcomponent_slugs.length} subcomponents
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function UnitBadge({ unit }: { unit: "min" | "pct" | "count" | "score" }) {
  const labels: Record<string, string> = {
    min: "minutes",
    pct: "%",
    count: "count",
    score: "score",
  };
  return (
    <span className="shrink-0 inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-slate-600">
      {labels[unit]}
    </span>
  );
}
