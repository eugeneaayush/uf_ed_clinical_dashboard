# UF ED Clinical Dashboard

## What this is
React SPA dashboard for UF Health's five emergency departments. Pre-computed
JSON payloads from a Python/pandas aggregator drive 28 metrics × 22 slices
plus per-location Daily Activity Reports that replicate the Shands PDF.

Deployed to Firebase Hosting. Stack: Vite + React + TypeScript + Tailwind +
Recharts. Python 3.12 + pandas for the pipeline.

## Key paths
- `scripts/aggregate.py` — the aggregator. Emits `public/data/**/*.json`.
- `src/pages/Summary.tsx` — Oracle-style landing view.
- `src/pages/MetricsIndex.tsx`, `MetricDetail.tsx` — 28 metrics, parameterized.
- `src/pages/ConditionsIndex.tsx`, `ConditionDetail.tsx` — ICD-10 drill-downs.
- `src/pages/DailyReport.tsx` — Shands PDF replication, 7 sub-tabs.
- `src/lib/types.ts` — all payload interfaces.
- `src/lib/data.ts` — React hooks for loading payloads.
- `src/components/Shell.tsx` — masthead, footer, nav.

## Data
- `data_raw/BO_data_pull.csv` — 127K+ FY26 encounters, 5 ED sites.
- BO pull lacks `Admit Unit` and `Admit Service` columns — MD→Order section
  in Daily Report shows a graceful empty state until those are added.

## Commands
- `npm run dev` — dev server on :5173
- `npm run build` — production build
- `npm run aggregate` — regenerate all payloads
- `npm run deploy` — build + firebase deploy

## Style notes
- UF brand colors: `#0021A5` (blue), `#FA4616` (orange).
- Fonts: IBM Plex Sans/Mono, Anybody display font.
- Recharts animations are DISABLED in DailyReport (deterministic paint for
  screenshots + smoother tab switching). Keep it that way unless there's a
  specific reason.
- The avg-acuity-by-location donut on Summary uses ESI tinting (red = sicker,
  blue = less acute). Do not swap to location brand colors.

## Known
- ADULT ED max-wait-hours line in 1F holds at 22h+ all 24 hours of 4/15/26 —
  this is the real-time boarding crisis visualization. It's the signal to
  surface with Frank/Dr. Becker.