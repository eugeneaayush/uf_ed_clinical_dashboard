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

type ThroughputSub = {
  key: string;
  label: string;
  description: string;
  slugs: string[];
};

const THROUGHPUT_SUBS: ThroughputSub[] = [
  {
    key: "front-end",
    label: "Front-end times",
    description: "Arrival through first provider contact.",
    slugs: ["arrival-to-triage", "triage-to-inroom", "inroom-to-md"],
  },
  {
    key: "composite",
    label: "Composite flow",
    description: "Headline throughput aggregates.",
    slugs: ["ed-los", "door-to-md", "door-to-disposition", "boarding"],
  },
  {
    key: "admit",
    label: "Admit pathway",
    description: "From MD disposition through bed-ready to exit.",
    slugs: [
      "md-to-disposition",
      "disposition-to-exit",
      "disposition-to-decision-to-admit",
      "decision-to-admit-to-admit-order",
      "admit-order-to-bed-request",
      "bed-request-to-bed-assigned",
      "bed-assigned-to-bed-ready",
      "bed-ready-to-exit",
    ],
  },
];

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

      <div className="space-y-10">
        {CATEGORY_ORDER.filter((c) => grouped.has(c)).map((cat, ci) => {
          const catNum = String(ci + 1).padStart(2, "0");
          const entries = grouped.get(cat)!;

          return (
            <section key={cat}>
              <div className="flex items-baseline gap-3 mb-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-uf-blue">
                  {catNum}
                </span>
                <h2 className="font-display text-[22px] font-extrabold tracking-tight text-zinc-100">
                  {cat}
                </h2>
              </div>
              <p className="text-[12.5px] text-zinc-400 mb-5 max-w-2xl">
                {CATEGORY_COPY[cat]}
              </p>

              {cat === "Throughput" ? (
                <ThroughputGroups
                  entries={entries}
                  catNum={catNum}
                  onSelect={(slug) => nav(`/metrics/${slug}`)}
                />
              ) : (
                <MetricGrid
                  entries={entries}
                  onSelect={(slug) => nav(`/metrics/${slug}`)}
                />
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ThroughputGroups({
  entries,
  catNum,
  onSelect,
}: {
  entries: MetricRegistryEntry[];
  catNum: string;
  onSelect: (slug: string) => void;
}) {
  const bySlug = new Map(entries.map((m) => [m.slug, m]));

  return (
    <div className="space-y-8">
      {THROUGHPUT_SUBS.map((sub, si) => {
        const subMetrics = sub.slugs
          .map((slug) => bySlug.get(slug))
          .filter((m): m is MetricRegistryEntry => Boolean(m));
        if (subMetrics.length === 0) return null;
        const subNum = `${catNum}${String.fromCharCode(97 + si)}`;
        return (
          <div key={sub.key}>
            <div className="border-t border-zinc-800 pt-4 mb-3 flex items-baseline gap-3 flex-wrap">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-zinc-500">
                {subNum}
              </span>
              <h3 className="font-mono text-[11.5px] uppercase tracking-[0.16em] text-zinc-300">
                {sub.label}
              </h3>
              <span className="font-mono text-[11px] text-zinc-500 normal-case tracking-normal">
                {sub.description}
              </span>
            </div>
            <MetricGrid entries={subMetrics} onSelect={onSelect} />
          </div>
        );
      })}
    </div>
  );
}

function MetricGrid({
  entries,
  onSelect,
}: {
  entries: MetricRegistryEntry[];
  onSelect: (slug: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {entries.map((m) => (
        <MetricCard key={m.slug} metric={m} onSelect={onSelect} />
      ))}
    </div>
  );
}

function MetricCard({
  metric,
  onSelect,
}: {
  metric: MetricRegistryEntry;
  onSelect: (slug: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(metric.slug)}
      className="group text-left rounded-2xl ring-1 ring-zinc-800 bg-zinc-900/60 hover:ring-zinc-700 hover:bg-zinc-900/80 transition-all p-4"
    >
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <span className="font-display text-[15px] font-bold text-zinc-100 group-hover:text-blue-400 transition-colors">
          {metric.label}
        </span>
        <UnitBadge unit={metric.unit} />
      </div>
      <p className="text-[12px] text-zinc-400 leading-relaxed line-clamp-2">
        {metric.description}
      </p>
      {metric.subcomponent_slugs.length > 0 && (
        <div className="mt-2 font-mono text-[10.5px] text-zinc-500">
          {metric.subcomponent_slugs.length} subcomponents
        </div>
      )}
    </button>
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
    <span className="shrink-0 inline-flex items-center rounded-md bg-zinc-800/80 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-zinc-300 ring-1 ring-zinc-700">
      {labels[unit]}
    </span>
  );
}
