# UF Emergency Medicine — Clinical Dashboard

React SPA for the UF College of Medicine Department of Emergency Medicine.
Replaces the Oracle BI Clinical dashboard pattern with a UF-Health-tailored
data model, five-site location filtering, condition drill-downs, and a
forecast-aware LOS view.

Static-hosted on Firebase. Raw BO data (~153 MB of CSV) is pre-aggregated
offline into ~400 KB of JSON so the browser only pulls what each view needs.

---

## Pages & features

### `/summary` — enterprise / site overview

Four sub-tabs, each respecting the global location filter:

- **Volume** — encounters, admits, discharges, LWBS, transfers, expired; location donut, acuity mix, monthly trend, hour-of-day, day-of-week
- **Disposition** — Top 10 Diagnoses, disposition mix, Location × Acuity stacked bars
- **Payer** — Action Financial Class distribution
- **Clinical Ops** — the ED-operations metrics that matter:
  - Throughput: Door-to-MD median + P90, ED LOS median + P90
  - Attrition: LWBS, LBTC, AMA
  - ED Return Visits: 72-hour, 7-day, 30-day (any-cause)
  - Outcomes: Admit, Transfer, Mortality, Reached-Provider
  - Capacity Strain: % Boarding >2h, % LOS >6h

### `/conditions` — ICD-10 drill-downs

Sortable index of the **15 largest ICD-10 condition categories**. Each row shows side-by-side same-condition (CMS-style) and any-cause 30-day return rates. Click a row for the detail page.

### `/conditions/:slug` — per-condition detail

- Headline KPIs (encounters, admit rate, LWBS, median LOS)
- **Return rate comparison** — 72h / 7d / 30d windows, same-condition (blue) and any-cause (orange) shown side-by-side
- Per-ED-site breakdown table with 12 columns of return + attrition rates
- Monthly volume trend
- Acuity and disposition mix
- Recent patient list with 30-day-return flag

### `/los` — length of stay with forecasts

- Throughput KPIs (ED LOS, Door-to-MD, Door-to-Disposition, Boarding)
- **Auto-generated insight banner** — "LOS is +43m vs forecast — boarding is the driver" derived from the largest delta component
- **Actual vs Forecast chart** — bars for actuals, dashed forecast overlay. Current (partial) month rendered muted with an "In Progress" reference line and run-rate annotation so it's not artificially deflated
- **Delta table** — monthly ΔLOS, ΔDoor-to-MD, ΔBoarding colored red (over forecast) or blue (under forecast)
- Per-site detail table
- LOS by diagnosis and by acuity
- **Compare Sites mode** with sub-toggle for Small Multiples (per-site y-axis) or Overlay (5 colored lines on one chart)

### Global filter bar

Sticky segmented control on every page: *All Sites / Adult ED / Peds ED / Kanapaha ED / Spring ED / ONH ED*. URL-synced as `?loc=<slug>` — deep-linkable.

---

## Stack

- Vite 5 · React 18 · TypeScript 5 · Tailwind 3 · Recharts 2 · react-router-dom 6
- Typography: **IBM Plex Sans** body, **Anybody** display (hero + KPI numbers), **IBM Plex Mono** for labels
- Colors drawn from the UF EM template: `#0021A5` UF blue, `#FA4616` UF orange, full slate ramp
- Aggregation: Python 3.12 + pandas + numpy
- Hosting: Firebase Hosting (static SPA)

---

## Project layout

```
uf-ed-clinical-dashboard/
├── public/
│   ├── data/                        ← pre-aggregated JSON
│   │   ├── meta.json                # 1 KB — locations + condition roster
│   │   ├── summary/
│   │   │   ├── all.json, adult-ed.json, peds-ed.json …
│   │   ├── conditions/
│   │   │   └── uti.json, sepsis.json, heart-failure.json … (15 files)
│   │   └── los/
│   │       ├── all.json, adult-ed.json, peds-ed.json …
│   └── favicon.svg
├── scripts/
│   └── aggregate.py                 ← raw CSV → JSON pipeline
├── src/
│   ├── components/                  ← Shell, FilterBar, Tabs, Card, Kpi, …
│   ├── lib/                         ← data hooks, filters hook, types, palette, format
│   ├── pages/
│   │   ├── Summary.tsx
│   │   ├── ConditionsIndex.tsx
│   │   ├── ConditionDetail.tsx
│   │   └── LOS.tsx
│   └── App.tsx
├── firebase.json                    ← SPA rewrites + cache headers
├── .firebaserc                      ← edit for your Firebase project
├── vite.config.ts / tsconfig.*.json
└── package.json
```

---

## Local development

```bash
npm install
pip install pandas numpy
npm run dev          # http://localhost:5173
```

---

## Refreshing data

```bash
# Drop the new BO pull into data_raw/:
#   data_raw/BO_data_pull.csv
python3 scripts/aggregate.py \
  --encounters data_raw/BO_data_pull.csv \
  --out public/data
# Or: npm run aggregate
```

Pipeline runtime: ~4s on 127K encounters. Output: ~400 KB across
`meta.json`, 6 summary files, 15 condition files, 6 LOS files.

---

## Firebase deployment

```bash
npm install -g firebase-tools
firebase login

# One-time: edit .firebaserc with your Firebase project ID
npm run deploy       # vite build && firebase deploy --only hosting
```

Hosting config already in place:
- SPA fallback rewrites for `/summary`, `/conditions/*`, `/los`
- Immutable caching on hashed JS/CSS
- 5-min revalidation on `/data/*.json` (push new data with `npm run aggregate && npm run deploy`)
- Security headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, strict `Referrer-Policy`, locked `Permissions-Policy`

---

## Data model notes

Derived columns computed by `aggregate.py`:

| Field | Formula |
| --- | --- |
| `ed_los_min` | Exit − Arrival (capped 0–48h) |
| `door_to_md_min` | MD − Arrival |
| `door_to_disposition_min` | Disposition − Arrival |
| `boarding_min` | Exit − Disposition |

Return visits: sort by MRN + Arrival, compute gap from *this exit* to *next MRN arrival*. Flag encounters as `return_72h`, `return_7d`, `return_30d` (any-cause) and `return_72h_same`, `return_7d_same`, `return_30d_same` (where the next visit's ICD-10 Condition Category matches this one). LWBS/AMA/LBTC encounters are excluded from the return-rate denominator because they never received treatment to "return from."

Forecast: 6-month trailing baseline, daily averages grouped by site × day-of-week to capture weekly seasonality, rolled up to monthly. Current (partial) month is flagged (`is_current_month: true`) with `days_observed` and `days_in_month`; the UI shows both raw actuals and a run-rate extrapolation.

---

## Privacy & compliance

- MRN and encounter IDs appear only in recent-patient tables on condition detail pages. All enterprise-level views show only aggregate counts.
- No analytics, no cookies, no external trackers. `meta` tag is `robots: noindex,nofollow`.
- Before exposing outside the department, put Cloud Identity / IAP in front of Firebase Hosting or gate with Firebase Auth.

---

## Commands

```bash
npm run dev         # Vite dev server
npm run build       # Production build → dist/
npm run preview     # Serve dist/ locally
npm run typecheck   # TypeScript noEmit check
npm run aggregate   # Regenerate public/data from data_raw/
npm run deploy      # build + firebase deploy --only hosting
```

---

## License

Internal use — University of Florida College of Medicine, Department of Emergency Medicine. Not for redistribution.
