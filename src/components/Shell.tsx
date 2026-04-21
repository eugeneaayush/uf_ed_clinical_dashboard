import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useMeta } from "../lib/data";
import { fmtInt } from "../lib/format";

const TABS = [
  { to: "/summary", num: "01", label: "Summary" },
  { to: "/metrics", num: "02", label: "Metrics" },
  { to: "/conditions", num: "03", label: "Conditions" },
  { to: "/daily", num: "04", label: "Daily Report" },
];

/** Keep ?loc and ?cmp filters when switching top tabs. Drop ?tab (sub-tab). */
function preserveFilters(search: string): string {
  const params = new URLSearchParams(search);
  const keep = new URLSearchParams();
  for (const k of ["loc", "cmp", "cmpView"]) {
    const v = params.get(k);
    if (v) keep.set(k, v);
  }
  const s = keep.toString();
  return s ? `?${s}` : "";
}

export function Shell() {
  const meta = useMeta();
  const loc = useLocation();
  const isRoot = loc.pathname === "/" || loc.pathname === "";

  return (
    <div className="min-h-screen bg-white">
      {/* =====================================================================
          Masthead — mimics the template's gridded-blue hero sidebar treatment
          ===================================================================== */}
      <div className="relative overflow-hidden blue-grid-bg text-white">
        {/* Decorative gridded square on the right (template signature) */}
        <div className="absolute -top-8 right-4 hidden md:block opacity-50">
          <div className="grid grid-cols-6 gap-1.5">
            {Array.from({ length: 18 }).map((_, i) => (
              <div
                key={i}
                className="h-6 w-6 rounded-sm"
                style={{
                  backgroundColor: i % 4 === 0 ? "#3080ff" : "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                }}
              />
            ))}
          </div>
        </div>

        <div className="mx-auto max-w-[1480px] px-6 py-8 md:py-10 relative">
          <div className="flex flex-col gap-6">
            {/* Top row: wordmark + data range */}
            <div className="flex items-start justify-between gap-6">
              <div className="flex items-center gap-4">
                {/* Official UF Emergency Medicine 2-line brand lockup.
                   Rendered on a white chip so blue+orange elements stay
                   legible against the gridded-blue hero. */}
                <div className="rounded-xl bg-white px-3 py-2 shadow-pop flex items-center">
                  <img
                    src="/em-logo.png"
                    alt="UF Emergency Medicine"
                    className="h-8 md:h-9 w-auto"
                  />
                </div>
              </div>

              {meta.data && (
                <div className="hidden md:flex flex-col items-end gap-2">
                  <span className="badge-orange">
                    Clinical Dashboard · FY26
                  </span>
                  <div className="font-mono text-[11px] text-white/70">
                    {meta.data.date_range.start} → {meta.data.date_range.end}
                  </div>
                </div>
              )}
            </div>

            {/* Headline block — template hero pattern */}
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mt-2">
              <div>
                <h1 className="font-display text-[40px] md:text-[56px] lg:text-[64px] font-extrabold leading-[0.95] tracking-tighter text-white">
                  Department-wide
                  <br />
                  Clinical Signal.
                </h1>
                <p className="mt-4 max-w-xl text-[14px] text-white/80 leading-relaxed">
                  Real-time throughput, acuity, and disposition across the five
                  UF Health emergency departments — Adult, Peds, Kanapaha,
                  Spring, and ONH.
                </p>
              </div>

              {/* Hero metric strip */}
              {meta.data && (
                <div className="grid grid-cols-3 gap-0 rounded-2xl overflow-hidden bg-white/5 ring-1 ring-white/10 backdrop-blur-sm">
                  <HeroStat
                    label="Encounters"
                    value={fmtInt(meta.data.total_encounters)}
                  />
                  <HeroStat
                    label="Patients"
                    value={fmtInt(meta.data.unique_patients)}
                  />
                  <HeroStat
                    label="Attendings"
                    value={fmtInt(meta.data.unique_attendings)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          Tab navigation — mono-numbered, underline-on-active (template style)
          ===================================================================== */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 backdrop-blur-md bg-white/95">
        <div className="mx-auto max-w-[1480px] px-6">
          <nav className="tab-nav overflow-x-auto thin-scroll">
            {TABS.map((t) => {
              const active =
                loc.pathname.startsWith(t.to) ||
                (isRoot && t.to === "/summary");
              return (
                <NavLink key={t.to} to={`${t.to}${preserveFilters(loc.search)}`}>
                  <div className="tab-link" data-active={active || undefined}>
                    <span className="tab-num">{t.num}</span>
                    <span className="h-3 w-px bg-slate-200" aria-hidden />
                    <span className="whitespace-nowrap">{t.label}</span>
                  </div>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      {/* =====================================================================
          Main canvas
          ===================================================================== */}
      <main className="mx-auto max-w-[1480px] px-6 py-10 md:py-14 animate-fade-up">
        <Outlet />
      </main>

      {/* =====================================================================
          Footer
          ===================================================================== */}
      <footer className="mt-16 border-t border-slate-200">
        <div className="mx-auto max-w-[1480px] px-6 py-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Official UF EM GatorDoc mascot — departmental signature */}
            <img
              src="/gator-doc.jpg"
              alt=""
              aria-hidden="true"
              className="h-10 w-10 object-contain opacity-80"
            />
            <div className="text-[12px] text-slate-500">
              <span className="font-medium text-slate-700">
                UF College of Medicine
              </span>
              {" · "}
              Department of Emergency Medicine · Performance Optimization &amp;
              Analytics
            </div>
          </div>
          <div className="font-mono text-[11px] text-slate-500">
            Refreshed{" "}
            {meta.data?.generated_at
              ? new Date(meta.data.generated_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "—"}
          </div>
        </div>
      </footer>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-4 first:pl-6 last:pr-6 border-r border-white/10 last:border-0 min-w-[140px]">
      <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/60">
        {label}
      </div>
      <div className="mt-1 font-display text-[22px] font-extrabold text-white tabular tracking-tighter">
        {value}
      </div>
    </div>
  );
}
