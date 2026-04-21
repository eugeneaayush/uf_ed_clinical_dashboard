import { useSearchParams } from "react-router-dom";
import { useCallback } from "react";

export const LOCATION_SLUGS = [
  "all",
  "adult-ed",
  "peds-ed",
  "kanapaha-ed",
  "spring-ed",
  "onh-ed",
] as const;

export type LocationSlug = (typeof LOCATION_SLUGS)[number];

export const LOCATION_LABEL: Record<LocationSlug, string> = {
  all: "All Sites",
  "adult-ed": "Adult ED",
  "peds-ed": "Peds ED",
  "kanapaha-ed": "Kanapaha ED",
  "spring-ed": "Spring ED",
  "onh-ed": "ONH ED",
};

export const LOCATION_FULL_NAME: Record<LocationSlug, string> = {
  all: "All Sites",
  "adult-ed": "ADULT ED",
  "peds-ed": "PEDS ED",
  "kanapaha-ed": "KANAPAHA ED",
  "spring-ed": "SPRING ED",
  "onh-ed": "ONH ED",
};

/**
 * Location filter — URL-synced via ?loc=<slug>.
 */
export function useLocationFilter(): {
  loc: LocationSlug;
  setLoc: (slug: LocationSlug) => void;
} {
  const [sp, setSp] = useSearchParams();
  const raw = sp.get("loc") ?? "all";
  const loc: LocationSlug = (LOCATION_SLUGS as readonly string[]).includes(raw)
    ? (raw as LocationSlug)
    : "all";
  const setLoc = useCallback(
    (slug: LocationSlug) => {
      const next = new URLSearchParams(sp);
      if (slug === "all") next.delete("loc");
      else next.set("loc", slug);
      setSp(next, { replace: true });
    },
    [sp, setSp]
  );
  return { loc, setLoc };
}

/**
 * Condition filter — URL-synced via ?condition=<slug>. Empty = all conditions.
 */
export function useConditionFilter(): {
  condition: string | null;
  setCondition: (slug: string | null) => void;
} {
  const [sp, setSp] = useSearchParams();
  const condition = sp.get("condition") || null;
  const setCondition = useCallback(
    (slug: string | null) => {
      const next = new URLSearchParams(sp);
      if (!slug) next.delete("condition");
      else next.set("condition", slug);
      setSp(next, { replace: true });
    },
    [sp, setSp]
  );
  return { condition, setCondition };
}

/**
 * Compare mode — URL-synced via ?cmp=1.
 */
export function useCompareMode(): {
  compare: boolean;
  setCompare: (v: boolean) => void;
} {
  const [sp, setSp] = useSearchParams();
  const compare = sp.get("cmp") === "1";
  const setCompare = useCallback(
    (v: boolean) => {
      const next = new URLSearchParams(sp);
      if (v) next.set("cmp", "1");
      else next.delete("cmp");
      setSp(next, { replace: true });
    },
    [sp, setSp]
  );
  return { compare, setCompare };
}

/**
 * What dimension should compare mode break down on?
 *   - "location": show per-location variants
 *   - "condition": show per-condition variants
 */
export type CompareDimension = "location" | "condition";

export function useCompareDimension(): {
  dim: CompareDimension;
  setDim: (d: CompareDimension) => void;
} {
  const [sp, setSp] = useSearchParams();
  const dim: CompareDimension =
    sp.get("cmpDim") === "condition" ? "condition" : "location";
  const setDim = useCallback(
    (d: CompareDimension) => {
      const next = new URLSearchParams(sp);
      if (d === "location") next.delete("cmpDim");
      else next.set("cmpDim", d);
      setSp(next, { replace: true });
    },
    [sp, setSp]
  );
  return { dim, setDim };
}

/**
 * Compare-mode sub-toggle: "small" (small multiples) | "overlay" (one chart, N series).
 */
export type CompareView = "small" | "overlay";

export function useCompareView(): {
  view: CompareView;
  setView: (v: CompareView) => void;
} {
  const [sp, setSp] = useSearchParams();
  const view: CompareView = sp.get("cmpView") === "overlay" ? "overlay" : "small";
  const setView = useCallback(
    (v: CompareView) => {
      const next = new URLSearchParams(sp);
      if (v === "small") next.delete("cmpView");
      else next.set("cmpView", v);
      setSp(next, { replace: true });
    },
    [sp, setSp]
  );
  return { view, setView };
}

/**
 * Derive the (sliceKind, sliceSlug) used by useMetric based on current URL state.
 * If a condition is set, the condition slice takes precedence over location.
 */
export function useActiveSlice(): {
  kind: "all" | "location" | "condition";
  slug: string;
} {
  const { loc } = useLocationFilter();
  const { condition } = useConditionFilter();
  if (condition) return { kind: "condition", slug: condition };
  if (loc !== "all") return { kind: "location", slug: loc };
  return { kind: "all", slug: "all" };
}
