import clsx from "clsx";
import {
  useLocationFilter,
  useCompareMode,
  useCompareView,
  useCompareDimension,
  useConditionFilter,
  LOCATION_SLUGS,
  LOCATION_LABEL,
  type LocationSlug,
  type CompareView,
  type CompareDimension,
} from "../lib/filters";
import { useMeta } from "../lib/data";

interface FilterBarProps {
  /** Show the compare toggle? */
  showCompare?: boolean;
  /** Show the condition filter dropdown? */
  showCondition?: boolean;
  /** Disable the location picker (e.g. when compare is on) */
  lockLocation?: boolean;
  /** Page-specific helper text */
  hint?: string;
}

export function FilterBar({
  showCompare = true,
  showCondition = false,
  lockLocation = false,
  hint,
}: FilterBarProps) {
  const { loc, setLoc } = useLocationFilter();
  const { condition, setCondition } = useConditionFilter();
  const { compare, setCompare } = useCompareMode();
  const { view, setView } = useCompareView();
  const { dim, setDim } = useCompareDimension();
  const meta = useMeta();

  const locDisabled = lockLocation || compare;

  return (
    <div className="sticky top-[56px] z-10 -mx-6 mb-6 px-6 py-3 bg-white/90 backdrop-blur-md border-b border-slate-200">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-slate-500 pr-2">
          ED Site
        </span>
        <div
          className={clsx(
            "inline-flex rounded-full ring-1 ring-slate-200 bg-slate-50 p-0.5",
            locDisabled && "opacity-50 pointer-events-none"
          )}
        >
          {LOCATION_SLUGS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setLoc(s as LocationSlug)}
              data-active={loc === s ? "true" : undefined}
              className={clsx(
                "px-3.5 py-1.5 rounded-full text-[12.5px] font-medium transition-colors",
                "text-slate-600 hover:text-slate-900",
                "data-[active=true]:bg-white data-[active=true]:text-uf-blue",
                "data-[active=true]:ring-1 data-[active=true]:ring-uf-blue/20",
                "data-[active=true]:shadow-sm"
              )}
            >
              {LOCATION_LABEL[s as LocationSlug]}
            </button>
          ))}
        </div>

        {showCondition && (
          <>
            <span aria-hidden className="h-5 w-px bg-slate-200 mx-1" />
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-slate-500">
              Condition
            </span>
            <select
              value={condition ?? ""}
              onChange={(e) => setCondition(e.target.value || null)}
              className="rounded-full bg-slate-50 ring-1 ring-slate-200 px-3 py-1.5 text-[12.5px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-uf-blue min-w-[180px]"
            >
              <option value="">All Conditions</option>
              {meta.data?.conditions.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </>
        )}

        {showCompare && (
          <>
            <span aria-hidden className="h-5 w-px bg-slate-200 mx-1" />
            <button
              type="button"
              onClick={() => setCompare(!compare)}
              data-active={compare ? "true" : undefined}
              className={clsx(
                "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
                "ring-1 ring-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900",
                "data-[active=true]:bg-uf-blue data-[active=true]:text-white data-[active=true]:ring-uf-blue"
              )}
            >
              <svg
                viewBox="0 0 16 16"
                className="h-3.5 w-3.5"
                fill="currentColor"
                aria-hidden
              >
                <rect x="2" y="3" width="4" height="10" rx="1" opacity="0.5" />
                <rect x="7" y="5" width="4" height="8" rx="1" opacity="0.75" />
                <rect x="12" y="7" width="2" height="6" rx="0.5" />
              </svg>
              Compare
            </button>

            {compare && (
              <>
                <div className="inline-flex rounded-full ring-1 ring-slate-200 bg-slate-50 p-0.5">
                  {(["location", "condition"] as CompareDimension[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDim(d)}
                      data-active={dim === d ? "true" : undefined}
                      className={clsx(
                        "px-3 py-1 rounded-full text-[11.5px] font-medium transition-colors",
                        "text-slate-600 hover:text-slate-900",
                        "data-[active=true]:bg-white data-[active=true]:text-slate-900",
                        "data-[active=true]:ring-1 data-[active=true]:ring-slate-300"
                      )}
                    >
                      by {d === "location" ? "Site" : "Condition"}
                    </button>
                  ))}
                </div>

                <div className="inline-flex rounded-full ring-1 ring-slate-200 bg-slate-50 p-0.5">
                  {(["small", "overlay"] as CompareView[]).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setView(v)}
                      data-active={view === v ? "true" : undefined}
                      className={clsx(
                        "px-3 py-1 rounded-full text-[11.5px] font-medium transition-colors",
                        "text-slate-600 hover:text-slate-900",
                        "data-[active=true]:bg-white data-[active=true]:text-slate-900",
                        "data-[active=true]:ring-1 data-[active=true]:ring-slate-300"
                      )}
                    >
                      {v === "small" ? "Small Multiples" : "Overlay"}
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
      {hint && <p className="mt-2 text-[11.5px] text-slate-500">{hint}</p>}
    </div>
  );
}
