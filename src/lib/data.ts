import { useEffect, useState } from "react";
import type {
  Meta,
  MetricIndex,
  MetricPayload,
  SummaryPayload,
  ConditionPayload,
  SliceKind,
} from "./types";

type JsonCache = Record<string, unknown>;
const cache: JsonCache = {};

async function fetchJson<T>(path: string): Promise<T> {
  if (cache[path]) return cache[path] as T;
  const res = await fetch(path, { credentials: "omit" });
  if (!res.ok) {
    throw new Error(`Failed to load ${path}: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as T;
  cache[path] = data;
  return data;
}

export interface Loadable<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function useJson<T>(path: string | null): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>(() => ({
    data: path ? ((cache[path] as T) ?? null) : null,
    loading: !!path && !cache[path],
    error: null,
  }));
  useEffect(() => {
    if (!path) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: !cache[path], error: null }));
    fetchJson<T>(path)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ data: null, loading: false, error });
      });
    return () => {
      cancelled = true;
    };
  }, [path]);
  return state;
}

export const useMeta = () => useJson<Meta>("/data/meta.json");
export const useMetricIndex = () =>
  useJson<MetricIndex>("/data/metrics/_index.json");
export const useSummary = () => useJson<SummaryPayload>("/data/summary.json");

/**
 * Fetch the payload for a specific metric + slice combination.
 *
 * - sliceKind='all': /data/metrics/<slug>/all.json
 * - sliceKind='location': /data/metrics/<slug>/<locSlug>.json
 * - sliceKind='condition': /data/metrics/<slug>/cond-<condSlug>.json
 */
export function useMetric(
  metricSlug: string | null,
  sliceKind: SliceKind,
  sliceSlug: string
): Loadable<MetricPayload> {
  let path: string | null = null;
  if (metricSlug) {
    if (sliceKind === "all") {
      path = `/data/metrics/${metricSlug}/all.json`;
    } else if (sliceKind === "location") {
      path = `/data/metrics/${metricSlug}/${sliceSlug}.json`;
    } else {
      path = `/data/metrics/${metricSlug}/cond-${sliceSlug}.json`;
    }
  }
  return useJson<MetricPayload>(path);
}

export const useCondition = (slug: string) =>
  useJson<ConditionPayload>(`/data/conditions/${slug}.json`);

/**
 * Per-location Daily Activity Report — replicates the Shands daily PDF.
 * slug: "all" | location slug (e.g., "adult-ed")
 */
export const useDailyReport = (slug: string) => {
  return useJson<import("./types").DailyReportPayload>(`/data/daily/${slug}.json`);
};
