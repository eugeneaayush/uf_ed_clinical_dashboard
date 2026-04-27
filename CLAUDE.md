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
- `data_raw/dashboard_data.csv` — single master clinical feed, FY17 → present
  (~958 MB, 1.37M rows, 1.32M distinct `Encounter`). Rows are 1:1 with
  encounters after a thin `drop_duplicates(["Encounter"])` pass (~3.9% pure
  replication). FY26 (partial) ≈ 124K distinct encounters.
- `data_raw/BO_billing_FY26.csv` + `BO_billing_FY17_FY25.csv` — encounter-billing
  data (shared schema). Reserved for Phase 4 (charge/collection/RVU roll-ups).
- `icd10/icd10cm_codes_2026.txt` + `icd10cm_order_2026.txt` — CMS reference
  used as a sanity check on the prefix patterns in `ICD10_CATEGORIES`.

### Schema notes
- New feed renames several columns; `load_encounters` applies `COLUMN_RENAMES`
  immediately after `pd.read_csv` so the rest of the aggregator keeps using
  canonical names (`Encounter #`, `MRN (UF)`, `ED Location`, `Acuity`,
  `Arrival Mode Type`).
- `ICD-10 Condition Category` is no longer pre-computed in the source. It's
  derived in `classify_icd10` by prefix-matching the 5 `Final ED Impression
  Dx*` decimal-code columns against `ICD10_CATEGORIES` (47 CCS-style buckets).
  The first matching category wins for the back-compat string column;
  `_cond_<slug>` boolean columns capture the full multi-label set.
- New demographic columns surfaced on Summary: `sex` (MALE/FEMALE → `sex_norm`),
  `age` (numeric, clamped 0-130 → `age_numeric`), `ped/adult` (A/P → `is_adult`
  / `is_pediatric`).
- Other new columns loaded but not yet rendered: ZIP Code, hospital service,
  Minor Care Flag, CDU Flag/timestamps, Triage Start/End, ER Acknowledgement
  timestamps, Fellow MD, Resident MD, NP, PA, RN, clinical comments.

### Fiscal year
UF fiscal year runs Jul 1 → Jun 30 (e.g. FY26 = Jul 1 2025 → Jun 30 2026).
`load_encounters` derives `fiscal_year` and `fy_quarter` columns from Arrival
DateTime.

### Counting semantics
`Encounters` = `df["Encounter #"].nunique()` after dedup.
`LWBS` = encounters with `LWBS Flag == "Y"` (after dedup).
Admits = encounters with `Final ED Disposition ∈ {"ADMIT", "PRESENTED TO ADMIT SERVICE"}`
(`PRESENTED TO ADMIT SERVICE` is folded into `ADMIT` at load time via
`ADMIT_DISPOSITION_ALIASES`).
Discharges = encounters with `Final ED Disposition == "DISCHARGE"`.

### Known gaps
- BO pull lacks `Admit Unit` and `Admit Service` columns — MD→Order section
  in Daily Report shows a graceful empty state until those are added.
- `Final Diagnosis`, `Action Financial Class`, `Work RVU`,
  `Service/Billing Provider Type` columns were removed in the new feed.
  Loader guards them with `if col in df.columns`.

## Payload layout
The aggregator emits per-FY payload directories and mirrors the latest FY to
the top level for backward compatibility:
- `public/data/index.json` — `{ available_fys, current_fy, generated_at }`.
- `public/data/fy{17..26}/` — one directory per fiscal year containing
  `meta.json`, `summary.json`, `metrics/<slug>/*.json`, `conditions/<slug>.json`.
  Only the latest FY additionally carries `daily/*.json`.
- `public/data/{meta,summary}.json`, `public/data/{metrics,conditions,daily}/` —
  byte-identical copies of the latest FY's payloads. Hooks in `src/lib/data.ts`
  still point here; swap them when Phase 2 lands the FY picker.
- Metric payloads include a `quarterly` array (in addition to `monthly`)
  because medians/P90 don't compose from monthly aggregates.

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