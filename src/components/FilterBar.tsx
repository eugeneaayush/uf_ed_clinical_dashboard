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
    <div className="sticky top-0 z-10 -mx-4 md:-mx-8 mb-6 px-4 md:px-8 py-3 bg-zinc-950/90 backdrop-blur-md border-b border-white/5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-500 pr-2">
          ED Site
        </span>
        <div
          className={clsx(
            "inline-flex rounded-full ring-1 ring-white/10 bg-zinc-900 p-0.5",
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
                "text-zinc-400 hover:text-zinc-100",
                "data-[active=true]:bg-zinc-800 data-[active=true]:text-zinc-100",
                "data-[active=true]:ring-1 data-[active=true]:ring-uf-blue/40",
                "data-[active=true]:shadow-sm"
              )}
            >
              {LOCATION_LABEL[s as LocationSlug]}
            </button>
          ))}
        </div>

        {showCondition && (
          <>
            <span aria-hidden className="h-5 w-px bg-white/10 mx-1" />
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-500">
              Condition
            </span>
            <select
              value={condition ?? ""}
              onChange={(e) => setCondition(e.target.value || null)}
              className="rounded-full bg-zinc-900 ring-1 ring-white/10 px-3 py-1.5 text-[12.5px] font-medium text-zinc-100 focus:outline-none focus:ring-2 focus:ring-uf-blue min-w-[180px]"
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
            <span aria-hidden className="h-5 w-px bg-white/10 mx-1" />
            <button
              type="button"
              onClick={() => setCompare(!compare)}
              data-active={compare ? "true" : undefined}
              className={clsx(
                "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
                "ring-1 ring-white/10 bg-zinc-900 text-zinc-400 hover:text-zinc-100",
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
                <div className="inline-flex rounded-full ring-1 ring-white/10 bg-zinc-900 p-0.5">
                  {(["location", "condition"] as CompareDimension[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDim(d)}
                      data-active={dim === d ? "true" : undefined}
                      className={clsx(
                        "px-3 py-1 rounded-full text-[11.5px] font-medium transition-colors",
                        "text-zinc-400 hover:text-zinc-100",
                        "data-[active=true]:bg-zinc-800 data-[active=true]:text-zinc-100",
                        "data-[active=true]:ring-1 data-[active=true]:ring-white/20"
                      )}
                    >
                      by {d === "location" ? "Site" : "Condition"}
                    </button>
                  ))}
                </div>

                <div className="inline-flex rounded-full ring-1 ring-white/10 bg-zinc-900 p-0.5">
                  {(["small", "overlay"] as CompareView[]).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setView(v)}
                      data-active={view === v ? "true" : undefined}
                      className={clsx(
                        "px-3 py-1 rounded-full text-[11.5px] font-medium transition-colors",
                        "text-zinc-400 hover:text-zinc-100",
                        "data-[active=true]:bg-zinc-800 data-[active=true]:text-zinc-100",
                        "data-[active=true]:ring-1 data-[active=true]:ring-white/20"
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
      {hint && <p className="mt-2 text-[11.5px] text-zinc-500">{hint}</p>}
    </div>
  );
}
