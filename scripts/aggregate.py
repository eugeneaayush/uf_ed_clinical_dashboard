#!/usr/bin/env python3
"""
UF ED Clinical Dashboard — Aggregation Pipeline v5 (metric-centric)
====================================================================

The dashboard's information model: every clinical metric is a first-class
entity. Each metric has:
  - A canonical definition (the computation on a slice of encounters)
  - A monthly actual-vs-forecast series
  - A per-location breakdown (all 5 ED sites)
  - A per-condition breakdown (16 ICD-10 categories)
  - A subcomponent decomposition (for composite metrics like LOS, Boarding)

Output shape:

    public/data/
      meta.json
      summary.json                        # Oracle-style overview payload
      metrics/
        _index.json                       # registry of all metrics
        <metric-slug>/
          all.json                        # full enterprise slice
          adult-ed.json, peds-ed.json ... # per-location
          cond-sepsis.json, cond-ami.json # per-condition
      conditions/
        <condition-slug>.json             # condition drill-down (unchanged)

Each metric payload has an identical schema, so the React drill-down page
can be fully parameterized — same component renders every metric.
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import shutil
import sys
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Literal

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Static configuration
# ---------------------------------------------------------------------------

ED_LOCATIONS = ["ADULT ED", "PEDS ED", "KANAPAHA ED", "SPRING ED", "ONH ED"]
ACUITY_ORDER = ["ESI-1", "ESI-2", "ESI-3", "ESI-4", "ESI-5", "Unknown"]
ACUITY_NUMERIC = {"ESI-1": 1, "ESI-2": 2, "ESI-3": 3, "ESI-4": 4, "ESI-5": 5}
EMS_ARRIVAL_MODES = {"AMBULANCE", "HELICOPTER", "FIRE DEPARTMENT"}

LWBS_DISPOSITIONS = {"LWBS AFTER TRIAGE", "LWBS BEFORE TRIAGE"}
LBTC_DISPOSITIONS = {"LEFT DURING TREATMENT"}
AMA_DISPOSITIONS = {"AMA"}
ADMIT_DISPOSITIONS = {"ADMIT"}
# Synonyms folded into "ADMIT" at load time (see load_encounters).
ADMIT_DISPOSITION_ALIASES = {
    "PRESENTED TO ADMIT SERVICE",
    "TO PROCEDURE/INTERVENTION",
    "TO L&D",
}
TRANSFER_DISPOSITIONS = {
    "ED TRANSFER TO ADULT ED", "ED TRANSFER TO PEDS ED",
    "TRANSFER TO PSYCHIATRIC FACILITY", "TRANSFER TO ANOTHER FACILITY",
}
EXPIRED_DISPOSITIONS = {"EXPIRED"}

DATETIME_COLS = [
    "Arrival DateTime", "Triage Datetime", "Inroom Datetime", "MD Datetime",
    "Med Eval Initiated Datetime", "Disposition Datetime", "CDU Decision Datetime",
    "CDU Room Datetime", "Admit Disposition Datetime", "Decision to Admit Datetime",
    "Admit Order Written Datetime", "Bed Request Datetime", "Bed Assigned Datetime",
    "Bed Ready Datetime", "Exit Datetime",
]

TOP_N_CONDITIONS = 15
ALWAYS_INCLUDE_CONDITIONS = ["AMI", "Heart Failure", "Pneumonia"]

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("aggregate")


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or "unknown"


def safe_mean(series: pd.Series) -> float | None:
    s = series.dropna()
    return round(float(s.mean()), 2) if len(s) else None


def safe_median(series: pd.Series) -> float | None:
    s = series.dropna()
    return round(float(s.median()), 1) if len(s) else None


def safe_pct(num: int, den: int, digits: int = 2) -> float:
    return round(100.0 * num / den, digits) if den else 0.0


def percentile(series: pd.Series, p: float) -> float | None:
    s = series.dropna()
    return round(float(np.percentile(s, p)), 1) if len(s) else None


def value_counts_sorted(series: pd.Series, top: int | None = None) -> list[dict[str, Any]]:
    vc = series.value_counts()
    if top:
        vc = vc.head(top)
    return [{"label": str(k), "value": int(v)} for k, v in vc.items()]


# ---------------------------------------------------------------------------
# Metric registry
# ---------------------------------------------------------------------------
# A metric is defined by:
#   - slug, label, category
#   - unit ("min", "pct", "count", "score")
#   - direction (higher or lower is better)
#   - aggregator: (df) -> float | None   # computes the value on a df slice
#   - subcomponents (optional): ordered list of related metrics that decompose
#     into this one (e.g., LOS → Arrival-to-Triage + Triage-to-MD + ...).
# ---------------------------------------------------------------------------

@dataclass
class Metric:
    slug: str
    label: str
    category: str
    unit: Literal["min", "pct", "count", "score"]
    direction: Literal["lower", "higher"]
    description: str
    aggregator: Callable[[pd.DataFrame], float | None]
    # Subcomponent slugs (order matters — rendered as a waterfall)
    subcomponents: list[str] = field(default_factory=list)
    # If True, this metric makes sense to forecast; otherwise only actuals
    has_forecast: bool = True


# --- aggregators ------------------------------------------------------------

def _mean_col(col: str) -> Callable[[pd.DataFrame], float | None]:
    def f(df: pd.DataFrame) -> float | None:
        return safe_mean(df[col]) if col in df.columns else None
    return f


def _median_col(col: str) -> Callable[[pd.DataFrame], float | None]:
    def f(df: pd.DataFrame) -> float | None:
        return safe_median(df[col]) if col in df.columns else None
    return f


def _rate_flag(flag_col: str, denom: Callable[[pd.DataFrame], pd.Series] | None = None):
    def f(df: pd.DataFrame) -> float | None:
        if flag_col not in df.columns or len(df) == 0:
            return None
        if denom is None:
            return safe_pct(int(df[flag_col].sum()), int(len(df)))
        den_mask = denom(df)
        den_n = int(den_mask.sum())
        num_n = int((df[flag_col] & den_mask).sum())
        return safe_pct(num_n, den_n)
    return f


def _count_distinct(df: pd.DataFrame) -> float | None:
    return float(len(df)) if len(df) else None


def _avg_acuity(df: pd.DataFrame) -> float | None:
    """Average ESI (1–5) with lower = more acute."""
    acu = df["Acuity"].map(ACUITY_NUMERIC)
    return safe_mean(acu)


def _reached_provider_mask(df: pd.DataFrame) -> pd.Series:
    return df["reached_provider"]


def _ems_mask(df: pd.DataFrame) -> pd.Series:
    return df["is_ems_arrival"]


# ---------------------------------------------------------------------------
# The full metric registry — the single source of truth for what gets emitted
# ---------------------------------------------------------------------------

METRICS: list[Metric] = [
    # --- Volume & acuity ---
    Metric(
        slug="encounters", label="Distinct Encounters", category="Volume",
        unit="count", direction="higher",
        description="Number of distinct ED encounters in the slice.",
        aggregator=_count_distinct, has_forecast=True,
    ),
    Metric(
        slug="avg-acuity", label="Average Acuity", category="Volume",
        unit="score", direction="lower",
        description="Mean ESI triage score (1 = most acute, 5 = least). Lower values indicate a sicker case mix.",
        aggregator=_avg_acuity, has_forecast=True,
    ),

    # --- Length of Stay (total) and its time subcomponents ---
    Metric(
        slug="ed-los", label="ED Length of Stay", category="Throughput",
        unit="min", direction="lower",
        description="Arrival → Exit. Mean minutes per encounter.",
        aggregator=_mean_col("ed_los_min"),
        subcomponents=[
            "arrival-to-triage",
            "triage-to-inroom",
            "inroom-to-md",
            "md-to-disposition",
            "disposition-to-exit",
        ],
    ),
    Metric(
        slug="arrival-to-triage", label="Arrival → Triage", category="Throughput",
        unit="min", direction="lower",
        description="Time from ED arrival to triage start. Includes ambulance offload when EMS-arrived.",
        aggregator=_mean_col("arrival_to_triage_min"),
    ),
    Metric(
        slug="triage-to-inroom", label="Triage → In-Room", category="Throughput",
        unit="min", direction="lower",
        description="Waiting-room time after triage before bed placement.",
        aggregator=_mean_col("triage_to_inroom_min"),
    ),
    Metric(
        slug="inroom-to-md", label="In-Room → MD", category="Throughput",
        unit="min", direction="lower",
        description="Time from arriving at the bed to first MD evaluation.",
        aggregator=_mean_col("inroom_to_md_min"),
    ),
    Metric(
        slug="md-to-disposition", label="MD → Disposition", category="Throughput",
        unit="min", direction="lower",
        description="Time from first MD encounter to disposition decision.",
        aggregator=_mean_col("md_to_disposition_min"),
    ),
    Metric(
        slug="disposition-to-exit", label="Disposition → Exit", category="Throughput",
        unit="min", direction="lower",
        description="Time from disposition decision to patient leaving the ED. A.k.a. Boarding Time for admitted patients.",
        aggregator=_mean_col("boarding_min"),
    ),

    # --- Aliased throughput headlines ---
    Metric(
        slug="door-to-md", label="Door-to-MD", category="Throughput",
        unit="min", direction="lower",
        description="Arrival → first MD evaluation. Composite of Arrival→Triage + Triage→In-Room + In-Room→MD.",
        aggregator=_mean_col("door_to_md_min"),
        subcomponents=["arrival-to-triage", "triage-to-inroom", "inroom-to-md"],
    ),
    Metric(
        slug="door-to-disposition", label="Door-to-Disposition", category="Throughput",
        unit="min", direction="lower",
        description="Arrival → disposition order.",
        aggregator=_mean_col("door_to_disposition_min"),
    ),

    # --- Boarding-focused subcomponents (admit pathway) ---
    Metric(
        slug="boarding", label="Boarding Time", category="Throughput",
        unit="min", direction="lower",
        description="Disposition → Exit. The time after a disposition is placed but before the patient physically leaves. Admit-bound patients dominate this.",
        aggregator=_mean_col("boarding_min"),
        subcomponents=[
            "disposition-to-decision-to-admit",
            "decision-to-admit-to-admit-order",
            "admit-order-to-bed-request",
            "bed-request-to-bed-assigned",
            "bed-assigned-to-bed-ready",
            "bed-ready-to-exit",
        ],
    ),
    Metric(
        slug="disposition-to-decision-to-admit", label="Disposition → Decision-to-Admit", category="Throughput",
        unit="min", direction="lower",
        description="Time between the final disposition timestamp and the decision to admit.",
        aggregator=_mean_col("disp_to_decision_min"),
    ),
    Metric(
        slug="decision-to-admit-to-admit-order", label="Decision-to-Admit → Admit Order Written", category="Throughput",
        unit="min", direction="lower",
        description="Provider-side time between deciding to admit and writing the admission order.",
        aggregator=_mean_col("decision_to_order_min"),
    ),
    Metric(
        slug="admit-order-to-bed-request", label="Admit Order → Bed Request", category="Throughput",
        unit="min", direction="lower",
        description="Order written to bed-request submitted to inpatient placement.",
        aggregator=_mean_col("order_to_bedreq_min"),
    ),
    Metric(
        slug="bed-request-to-bed-assigned", label="Bed Request → Bed Assigned", category="Throughput",
        unit="min", direction="lower",
        description="Inpatient team time to assign a bed.",
        aggregator=_mean_col("bedreq_to_bedassigned_min"),
    ),
    Metric(
        slug="bed-assigned-to-bed-ready", label="Bed Assigned → Bed Ready", category="Throughput",
        unit="min", direction="lower",
        description="Room turnover time after assignment.",
        aggregator=_mean_col("bedassigned_to_bedready_min"),
    ),
    Metric(
        slug="bed-ready-to-exit", label="Bed Ready → Exit", category="Throughput",
        unit="min", direction="lower",
        description="Transport time from bed-ready notification to ED departure.",
        aggregator=_mean_col("bedready_to_exit_min"),
    ),

    # --- EMS / Ambulance Offload ---
    Metric(
        slug="offload", label="Ambulance Offload Time", category="EMS",
        unit="min", direction="lower",
        description="EMS arrival → triage. Measures how long ambulances are held before patient care is transferred. Target ≤ 20 min. Computed only on EMS transports (AMBULANCE / HELICOPTER / FIRE DEPARTMENT).",
        aggregator=_mean_col("offload_min"),
    ),
    Metric(
        slug="offload-gt-20",
        label="% Ambulance Offload > 20 min",
        category="EMS", unit="pct", direction="lower",
        description="Share of EMS transports where offload exceeded 20 min.",
        aggregator=lambda df: safe_pct(
            int((df.loc[df["is_ems_arrival"], "offload_min"] > 20).sum()),
            int(df.loc[df["is_ems_arrival"], "offload_min"].notna().sum()),
        ) if len(df) else None,
    ),

    # --- Attrition ---
    Metric(
        slug="lwbs", label="Left Without Being Seen", category="Attrition",
        unit="pct", direction="lower",
        description="LWBS rate — patients who left before being seen by a provider. Denominator is all encounters.",
        aggregator=_rate_flag("is_lwbs"),
    ),
    Metric(
        slug="lbtc", label="Left Before Treatment Complete", category="Attrition",
        unit="pct", direction="lower",
        description="LBTC rate — patients who left during treatment.",
        aggregator=_rate_flag("is_lbtc"),
    ),
    Metric(
        slug="ama", label="Against Medical Advice", category="Attrition",
        unit="pct", direction="lower",
        description="AMA departure rate.",
        aggregator=_rate_flag("is_ama"),
    ),

    # --- Return visits ---
    Metric(
        slug="return-72h", label="72-hour Return", category="Readmission",
        unit="pct", direction="lower",
        description="Any-cause ED return by same MRN within 72 hours. Denominator: encounters that reached a provider.",
        aggregator=_rate_flag("return_72h", _reached_provider_mask),
    ),
    Metric(
        slug="return-7d", label="7-day Return", category="Readmission",
        unit="pct", direction="lower",
        description="Any-cause ED return within 7 days. Denominator: encounters that reached a provider.",
        aggregator=_rate_flag("return_7d", _reached_provider_mask),
    ),
    Metric(
        slug="return-30d", label="30-day Return", category="Readmission",
        unit="pct", direction="lower",
        description="Any-cause ED return within 30 days. Denominator: encounters that reached a provider.",
        aggregator=_rate_flag("return_30d", _reached_provider_mask),
    ),

    # --- Outcomes ---
    Metric(
        slug="admit-rate", label="Admit Rate", category="Outcomes",
        unit="pct", direction="higher",
        description="Share of encounters admitted to inpatient service.",
        aggregator=_rate_flag("is_admit"),
    ),
    Metric(
        slug="transfer-rate", label="Transfer Rate", category="Outcomes",
        unit="pct", direction="lower",
        description="Share of encounters transferred to another facility or service.",
        aggregator=_rate_flag("is_transfer"),
    ),
    Metric(
        slug="mortality", label="Mortality Rate", category="Outcomes",
        unit="pct", direction="lower",
        description="ED expired rate.",
        aggregator=_rate_flag("is_expired"),
    ),
]

METRIC_BY_SLUG = {m.slug: m for m in METRICS}


# ---------------------------------------------------------------------------
# Load + normalize
# ---------------------------------------------------------------------------

def load_encounters(path: Path) -> pd.DataFrame:
    log.info("Loading encounters from %s", path)
    df = pd.read_csv(path, dtype=str, keep_default_na=False, na_values=[""])
    df.columns = [c.strip() for c in df.columns]
    for col in DATETIME_COLS:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce", format="%m/%d/%Y %H:%M")

    df["ED Location"] = df["ED Location"].fillna("Unknown").str.strip()
    df["Acuity"] = df["Acuity"].fillna("Unknown").str.strip().replace("?", "Unknown")
    df["Final ED Disposition"] = df["Final ED Disposition"].fillna("Unknown").str.strip()
    df.loc[df["Final ED Disposition"].isin(ADMIT_DISPOSITION_ALIASES), "Final ED Disposition"] = "ADMIT"
    df["ICD-10 Condition Category"] = df["ICD-10 Condition Category"].fillna("Other/Uncategorized").str.strip()
    df["Arrival Mode Type"] = df["Arrival Mode Type"].fillna("Unknown").str.strip()
    df["Action Financial Class"] = df["Action Financial Class"].fillna("Unknown").str.strip()
    df["Attending MD"] = df["Attending MD"].fillna("Unassigned").str.strip()
    df["LWBS Flag"] = df["LWBS Flag"].fillna("N").str.strip().str.upper()
    df["Work RVU"] = pd.to_numeric(df["Work RVU"], errors="coerce").fillna(0.0)

    df = df[df["ED Location"].isin(ED_LOCATIONS)].copy()

    arr = df["Arrival DateTime"]

    # ---- Base time segments (all in minutes) ---------------------------------
    df["arrival_to_triage_min"] = (df["Triage Datetime"] - arr).dt.total_seconds() / 60
    df["triage_to_inroom_min"] = (df["Inroom Datetime"] - df["Triage Datetime"]).dt.total_seconds() / 60
    df["inroom_to_md_min"] = (df["MD Datetime"] - df["Inroom Datetime"]).dt.total_seconds() / 60
    df["md_to_disposition_min"] = (df["Disposition Datetime"] - df["MD Datetime"]).dt.total_seconds() / 60

    # Admit pathway subcomponents
    df["disp_to_decision_min"] = (df["Decision to Admit Datetime"] - df["Disposition Datetime"]).dt.total_seconds() / 60
    df["decision_to_order_min"] = (df["Admit Order Written Datetime"] - df["Decision to Admit Datetime"]).dt.total_seconds() / 60
    df["order_to_bedreq_min"] = (df["Bed Request Datetime"] - df["Admit Order Written Datetime"]).dt.total_seconds() / 60
    df["bedreq_to_bedassigned_min"] = (df["Bed Assigned Datetime"] - df["Bed Request Datetime"]).dt.total_seconds() / 60
    df["bedassigned_to_bedready_min"] = (df["Bed Ready Datetime"] - df["Bed Assigned Datetime"]).dt.total_seconds() / 60
    df["bedready_to_exit_min"] = (df["Exit Datetime"] - df["Bed Ready Datetime"]).dt.total_seconds() / 60

    # Composites
    df["ed_los_min"] = (df["Exit Datetime"] - arr).dt.total_seconds() / 60
    df["door_to_md_min"] = (df["MD Datetime"] - arr).dt.total_seconds() / 60
    df["door_to_disposition_min"] = (df["Disposition Datetime"] - arr).dt.total_seconds() / 60
    df["boarding_min"] = (df["Exit Datetime"] - df["Disposition Datetime"]).dt.total_seconds() / 60

    # Ambulance offload (EMS only)
    df["is_ems_arrival"] = df["Arrival Mode Type"].isin(EMS_ARRIVAL_MODES)
    df["offload_min"] = (df["Triage Datetime"] - arr).dt.total_seconds() / 60
    df.loc[~df["is_ems_arrival"], "offload_min"] = None

    # Clamp negatives / implausible values on every minute column
    minute_cols = [
        "arrival_to_triage_min", "triage_to_inroom_min", "inroom_to_md_min",
        "md_to_disposition_min", "disp_to_decision_min", "decision_to_order_min",
        "order_to_bedreq_min", "bedreq_to_bedassigned_min",
        "bedassigned_to_bedready_min", "bedready_to_exit_min",
        "ed_los_min", "door_to_md_min", "door_to_disposition_min",
        "boarding_min", "offload_min",
    ]
    for col in minute_cols:
        df.loc[(df[col] < 0) | (df[col] > 2880), col] = None

    df["year_month"] = df["Arrival DateTime"].dt.strftime("%Y-%m")
    df["arrival_date"] = df["Arrival DateTime"].dt.date
    df["hour"] = df["Arrival DateTime"].dt.hour
    df["dow"] = df["Arrival DateTime"].dt.dayofweek

    # Fiscal-year period columns (UF FY: Jul 1 -> Jun 30).
    # Jul-Dec of year N belong to FY(N+1); Jan-Jun of year N belong to FY(N).
    dt = df["Arrival DateTime"]
    df["fiscal_year"] = (dt.dt.year + (dt.dt.month >= 7).astype(int)).astype("Int16")
    df["fy_quarter"] = (((dt.dt.month - 7) % 12) // 3 + 1).astype("Int8")

    # Disposition flags (used by multiple metrics)
    df["is_lwbs"] = df["Final ED Disposition"].isin(LWBS_DISPOSITIONS)
    df["is_lbtc"] = df["Final ED Disposition"].isin(LBTC_DISPOSITIONS)
    df["is_ama"] = df["Final ED Disposition"].isin(AMA_DISPOSITIONS)
    df["is_admit"] = df["Final ED Disposition"].isin(ADMIT_DISPOSITIONS)
    df["is_discharge"] = df["Final ED Disposition"] == "DISCHARGE"
    df["is_transfer"] = df["Final ED Disposition"].isin(TRANSFER_DISPOSITIONS)
    df["is_expired"] = df["Final ED Disposition"].isin(EXPIRED_DISPOSITIONS)

    def bucket(d: str) -> str:
        if d in ADMIT_DISPOSITIONS: return "Admit"
        if d == "DISCHARGE": return "Discharge"
        if d in LWBS_DISPOSITIONS or d in LBTC_DISPOSITIONS or d in AMA_DISPOSITIONS: return "LWBS/AMA"
        if d in TRANSFER_DISPOSITIONS: return "Transfer"
        if d in EXPIRED_DISPOSITIONS: return "Expired"
        return "Other"
    df["disposition_bucket"] = df["Final ED Disposition"].map(bucket)

    df["reached_provider"] = df["MD Datetime"].notna() & ~df["is_lwbs"]

    # Collapse multi-row encounters to one row per CSN. The master clinical_data
    # export replicates identical rows for a subset of encounters, so `keep=first`
    # is lossless. Doing this at the end of load means every downstream .sum(),
    # .mean(), .median(), value_counts(), and len(df) operates on
    # one-row-per-encounter data with no further changes throughout the pipeline.
    rows_before = len(df)
    df = df.drop_duplicates(subset=["Encounter # (CSN)"], keep="first").reset_index(drop=True)
    log.info("Loaded %d rows; %d distinct encounters after CSN dedup", rows_before, len(df))
    return df


def compute_return_visits(df: pd.DataFrame) -> pd.DataFrame:
    log.info("Computing return-visit windows")
    df = df.sort_values(["MRN (UF)", "Arrival DateTime"]).reset_index(drop=True)
    grp = df.groupby("MRN (UF)", sort=False)
    next_arrival = grp["Arrival DateTime"].shift(-1)
    next_category = grp["ICD-10 Condition Category"].shift(-1)

    this_exit = df["Exit Datetime"].fillna(df["Disposition Datetime"]).fillna(df["Arrival DateTime"])
    gap_days = (next_arrival - this_exit).dt.total_seconds() / 86400
    df["gap_days_next"] = gap_days

    same_cat = (next_category == df["ICD-10 Condition Category"]) & next_category.notna()

    df["return_72h"] = (gap_days > 0) & (gap_days <= 3)
    df["return_7d"] = (gap_days > 0) & (gap_days <= 7)
    df["return_30d"] = (gap_days > 0) & (gap_days <= 30)
    df["return_72h_same"] = df["return_72h"] & same_cat
    df["return_7d_same"] = df["return_7d"] & same_cat
    df["return_30d_same"] = df["return_30d"] & same_cat

    valid_index = df["reached_provider"] | df["is_admit"] | df["is_discharge"]
    for c in ["return_72h", "return_7d", "return_30d",
              "return_72h_same", "return_7d_same", "return_30d_same"]:
        df.loc[~valid_index, c] = False

    return df


# ---------------------------------------------------------------------------
# Forecast engine
# ---------------------------------------------------------------------------
#
# Approach: for each (slice × metric × month) we compute both actual and
# forecast. Forecast = 6-month trailing baseline with DOW seasonality (for
# time-of-day-sensitive metrics) or straight baseline mean (for rates &
# counts). Current (partial) month is flagged with days_observed/days_in_month
# so the UI can render a run-rate extrapolation.
# ---------------------------------------------------------------------------

def _monthly_aggregate(df: pd.DataFrame, metric: Metric) -> pd.DataFrame:
    """Return DataFrame with columns [year_month, value] for this metric."""
    if len(df) == 0:
        return pd.DataFrame(columns=["year_month", "value"])
    rows = []
    for ym, sub in df.groupby("year_month"):
        v = metric.aggregator(sub)
        rows.append({"year_month": ym, "value": v})
    return pd.DataFrame(rows).sort_values("year_month")


def _quarterly_aggregate(df: pd.DataFrame, metric: Metric) -> list[dict[str, Any]]:
    """Return [{fy_quarter, value, n}] for this metric.

    Required because medians/P90/unique-counts are not composable from monthly
    aggregates — the frontend Q-level view needs these pre-computed on the
    quarter slice directly.
    """
    if len(df) == 0:
        return []
    out: list[dict[str, Any]] = []
    for (fy, q), sub in df.groupby(["fiscal_year", "fy_quarter"]):
        out.append({
            "fy_quarter": f"FY{int(fy) % 100:02d}-Q{int(q)}",
            "value": metric.aggregator(sub),
            "n": int(len(sub)),
        })
    out.sort(key=lambda r: r["fy_quarter"])
    return out


def _forecast_from_trailing(monthly: pd.DataFrame, window_months: int = 6) -> pd.DataFrame:
    """
    Walk-forward forecast: for month m, use trailing `window_months` months
    (excluding m itself) as the baseline mean. For the first `window_months`
    of data we use an expanding window (all available prior months).
    """
    if len(monthly) == 0:
        monthly = monthly.copy()
        monthly["forecast"] = []
        return monthly

    monthly = monthly.sort_values("year_month").reset_index(drop=True)
    fc = []
    for i in range(len(monthly)):
        # Prior months with non-null values
        lo = max(0, i - window_months)
        prior = monthly.iloc[lo:i]["value"].dropna()
        if len(prior) == 0:
            fc.append(None)
        else:
            fc.append(round(float(prior.mean()), 2))
    monthly = monthly.copy()
    monthly["forecast"] = fc
    return monthly


def build_metric_payload(
    df_slice: pd.DataFrame,
    full_df: pd.DataFrame,
    metric: Metric,
    slice_name: str,
    slice_kind: Literal["all", "location", "condition"],
) -> dict[str, Any]:
    """Produce the canonical per-metric payload for a slice."""
    # Overall value on the slice
    overall = metric.aggregator(df_slice)

    # Monthly series + forecast
    monthly = _monthly_aggregate(df_slice, metric)
    monthly = _forecast_from_trailing(monthly)
    # Delta
    monthly["delta"] = monthly.apply(
        lambda r: None
        if (r["value"] is None or r["forecast"] is None)
        else round(float(r["value"] - r["forecast"]), 2),
        axis=1,
    )

    # Flag current month (partial)
    if len(monthly) > 0:
        max_date = full_df["Arrival DateTime"].max()
        current_ym = max_date.strftime("%Y-%m")
        monthly["is_current_month"] = monthly["year_month"] == current_ym
        # Days observed vs in-month for current month on this slice
        def _days_info(r):
            if not r["is_current_month"]:
                return (None, pd.Period(r["year_month"], freq="M").days_in_month)
            days_obs = df_slice.loc[df_slice["year_month"] == r["year_month"], "arrival_date"].nunique()
            return (int(days_obs), pd.Period(r["year_month"], freq="M").days_in_month)

        info = monthly.apply(_days_info, axis=1)
        monthly["days_observed"] = [t[0] for t in info]
        monthly["days_in_month"] = [t[1] for t in info]
    else:
        monthly["is_current_month"] = []
        monthly["days_observed"] = []
        monthly["days_in_month"] = []

    monthly_records = monthly.to_dict(orient="records")

    # Quarterly series (FY-Q1..Q4). Pre-computed on quarter subsets so
    # median/P90 metrics are correct — they are not composable from monthlies.
    quarterly_records = _quarterly_aggregate(df_slice, metric)

    # Per-location breakdown (only meaningful when slice_kind != "location")
    by_location = []
    if slice_kind != "location":
        for loc in ED_LOCATIONS:
            loc_df = df_slice[df_slice["ED Location"] == loc]
            by_location.append({
                "location": loc,
                "value": metric.aggregator(loc_df),
                "n": int(len(loc_df)),
            })

    # Per-condition breakdown (only meaningful when slice_kind != "condition")
    by_condition: list[dict[str, Any]] = []
    if slice_kind != "condition":
        # Use the top-N + always-include list
        top_cats = _top_conditions(full_df)
        for cat in top_cats:
            cat_df = df_slice[df_slice["ICD-10 Condition Category"] == cat]
            by_condition.append({
                "condition": cat,
                "slug": slugify(cat),
                "value": metric.aggregator(cat_df),
                "n": int(len(cat_df)),
            })

    # Subcomponent decomposition (if metric declares subcomponents)
    subcomponents = []
    for sub_slug in metric.subcomponents:
        sub_metric = METRIC_BY_SLUG.get(sub_slug)
        if sub_metric is None:
            continue
        subcomponents.append({
            "slug": sub_slug,
            "label": sub_metric.label,
            "unit": sub_metric.unit,
            "value": sub_metric.aggregator(df_slice),
        })

    return {
        "metric": {
            "slug": metric.slug,
            "label": metric.label,
            "category": metric.category,
            "unit": metric.unit,
            "direction": metric.direction,
            "description": metric.description,
            "subcomponent_slugs": metric.subcomponents,
        },
        "slice": {
            "kind": slice_kind,
            "name": slice_name,
        },
        "overall": overall,
        "n_encounters": int(len(df_slice)),
        "monthly": monthly_records,
        "quarterly": quarterly_records,
        "by_location": by_location,
        "by_condition": by_condition,
        "subcomponents": subcomponents,
    }


# ---------------------------------------------------------------------------
# Condition & meta helpers
# ---------------------------------------------------------------------------

def _top_conditions(df: pd.DataFrame) -> list[str]:
    cond_vc = df[df["ICD-10 Condition Category"] != "Other/Uncategorized"][
        "ICD-10 Condition Category"
    ].value_counts()
    top = cond_vc.head(TOP_N_CONDITIONS).index.tolist()
    for forced in ALWAYS_INCLUDE_CONDITIONS:
        if forced in cond_vc.index and forced not in top:
            top.append(forced)
    return sorted(top, key=lambda c: -int(cond_vc.get(c, 0)))


# ---------------------------------------------------------------------------
# Summary (Oracle-style overview) payload
# ---------------------------------------------------------------------------

def build_summary_payload(df: pd.DataFrame, top_conditions: list[str]) -> dict[str, Any]:
    """
    The Oracle-style landing view: big KPI tiles + a grid of overview charts.
    Every KPI links to a metric drill-down; every chart includes the slice
    it's visualizing. No heavy analytics here — this page is about breadth.

    Revision set (per product direction 2026-04-20):
      - "Encounters by ED Location" donut → "Average Acuity by ED Location" donut.
      - "Patients by Admission Type" → "Admissions by Diagnosis"
        (ADMIT-dispo share by ICD-10 condition category).
      - Removed: "Encounters by Type", "Discharges by Year-Month",
        "Encounters by Year-Month".
    """
    n = len(df)
    admits = int(df["is_admit"].sum())
    discharges = int(df["is_discharge"].sum())
    inpatients = admits
    ed_patients = n
    readmits_72h = int(df["return_72h"].sum())

    # Oracle-style KPI row
    kpis = [
        {"label": "Patients", "value": int(df["MRN (UF)"].nunique()), "link": None},
        {"label": "Inpatients", "value": inpatients, "link": "admit-rate"},
        {"label": "ED Patients", "value": ed_patients, "link": "encounters"},
        {"label": "72-Hr. Readmits", "value": readmits_72h, "link": "return-72h"},
        {"label": "Discharges", "value": discharges, "link": None},
    ]

    # Admissions by Diagnosis — ADMIT-dispo share by ICD-10 condition category.
    # Replaces the old "Patients by Admission Type" bar chart. We keep this as
    # a sibling to "Discharges by Diagnosis" so leaders can see whether the
    # diagnoses flowing into inpatient service match those that discharge home.
    adm_df = df[df["is_admit"]]
    adm_by_dx = (
        adm_df[adm_df["ICD-10 Condition Category"] != "Other/Uncategorized"]
        ["ICD-10 Condition Category"].value_counts().head(6)
    )
    admissions_by_diagnosis = [
        {"label": k, "value": int(v)} for k, v in adm_by_dx.items()
    ]

    # Discharges by Diagnosis (top ICD categories for discharged patients)
    dis_df = df[df["is_discharge"]]
    disc_by_dx = (
        dis_df[dis_df["ICD-10 Condition Category"] != "Other/Uncategorized"]
        ["ICD-10 Condition Category"].value_counts().head(6)
    )
    discharges_by_diagnosis = [{"label": k, "value": int(v)} for k, v in disc_by_dx.items()]

    # Average Acuity by ED Location (donut) — replaces the Encounters-by-Location donut.
    # Lower ESI = sicker. We show mean(ESI) per site alongside the encounter
    # count so the donut conveys "case-mix acuity" rather than raw volume.
    avg_acuity_by_location: list[dict[str, Any]] = []
    for loc in ED_LOCATIONS:
        loc_df = df[df["ED Location"] == loc]
        acu = loc_df["Acuity"].map(ACUITY_NUMERIC)
        avg_acuity_by_location.append({
            "label": loc,
            "value": safe_mean(acu),        # mean ESI (float)
            "encounters": int(len(loc_df)),  # for tooltip / legend context
        })

    # % of Encounters by Diagnosis
    dx_vc = df[df["ICD-10 Condition Category"] != "Other/Uncategorized"][
        "ICD-10 Condition Category"
    ].value_counts().head(6)
    dx_total = int(dx_vc.sum())
    pct_by_diagnosis = [
        {"label": k, "value": int(v), "pct": safe_pct(int(v), dx_total, 2)}
        for k, v in dx_vc.items()
    ]

    # Top 10 Diagnoses
    top10_vc = df[df["ICD-10 Condition Category"] != "Other/Uncategorized"][
        "ICD-10 Condition Category"
    ].value_counts().head(10)
    top_10_diagnoses = [{"label": k, "value": int(v)} for k, v in top10_vc.items()]

    # Arrival Mode by Year (retained)
    years = sorted(df["year_month"].dropna().str[:4].unique())
    arrival_by_year = []
    modes = [m for m in df["Arrival Mode Type"].value_counts().head(6).index if m not in {"?", "Unknown"}]
    for mode in modes:
        rec: dict[str, Any] = {"label": mode}
        for y in years:
            rec[y] = int(((df["Arrival Mode Type"] == mode) & (df["year_month"].str.startswith(y))).sum())
        arrival_by_year.append(rec)

    # Acuity by Month (retained)
    acuity_monthly = []
    for ym, sub in df.groupby("year_month"):
        vc = sub["Acuity"].value_counts()
        rec = {"year_month": ym}
        for a in ACUITY_ORDER:
            rec[a] = int(vc.get(a, 0))
        acuity_monthly.append(rec)
    acuity_monthly = sorted(acuity_monthly, key=lambda r: r["year_month"])

    return {
        "kpis": kpis,
        "admissions_by_diagnosis": admissions_by_diagnosis,
        "discharges_by_diagnosis": discharges_by_diagnosis,
        "avg_acuity_by_location": avg_acuity_by_location,
        "pct_by_diagnosis": pct_by_diagnosis,
        "top_10_diagnoses": top_10_diagnoses,
        "arrival_by_year": arrival_by_year,
        "acuity_monthly": acuity_monthly,
    }


# ---------------------------------------------------------------------------
# Condition drill-downs (kept for backward compat with /conditions route)
# ---------------------------------------------------------------------------

def build_condition_payload(df: pd.DataFrame, category: str) -> dict[str, Any]:
    sub = df[df["ICD-10 Condition Category"] == category].copy()
    n = len(sub)
    if n == 0:
        return {"category": category, "slug": slugify(category), "encounters": 0}

    reached = sub[sub["reached_provider"]]
    ems_sub = sub[sub["is_ems_arrival"]]
    ems_offload = ems_sub["offload_min"].dropna()

    kpis = {
        "encounters": n,
        "unique_patients": int(sub["MRN (UF)"].nunique()),
        "admits": int(sub["is_admit"].sum()),
        "admit_rate_pct": safe_pct(int(sub["is_admit"].sum()), n, 1),
        "lwbs_rate_pct": safe_pct(int(sub["is_lwbs"].sum()), n, 2),
        "lbtc_rate_pct": safe_pct(int(sub["is_lbtc"].sum()), n, 2),
        "median_ed_los_min": safe_median(sub["ed_los_min"]),
        "return_72h_any_pct": safe_pct(int(reached["return_72h"].sum()), len(reached), 2),
        "return_7d_any_pct": safe_pct(int(reached["return_7d"].sum()), len(reached), 2),
        "return_30d_any_pct": safe_pct(int(reached["return_30d"].sum()), len(reached), 2),
        "return_72h_same_pct": safe_pct(int(reached["return_72h_same"].sum()), len(reached), 2),
        "return_7d_same_pct": safe_pct(int(reached["return_7d_same"].sum()), len(reached), 2),
        "return_30d_same_pct": safe_pct(int(reached["return_30d_same"].sum()), len(reached), 2),
        "ems_transports": int(len(ems_sub)),
        "ems_share_pct": safe_pct(int(len(ems_sub)), n, 1),
        "offload_median_min": safe_median(ems_sub["offload_min"]),
        "offload_p90_min": percentile(ems_sub["offload_min"], 90),
        "offload_gt_20min_pct": safe_pct(
            int((ems_offload > 20).sum()), int(len(ems_offload)), 1
        ) if len(ems_offload) else 0.0,
    }

    by_location = []
    for loc in ED_LOCATIONS:
        loc_df = sub[sub["ED Location"] == loc]
        loc_reached = loc_df[loc_df["reached_provider"]]
        by_location.append({
            "location": loc,
            "encounters": int(len(loc_df)),
            "admit_rate_pct": safe_pct(int(loc_df["is_admit"].sum()), len(loc_df), 1),
            "lwbs_rate_pct": safe_pct(int(loc_df["is_lwbs"].sum()), len(loc_df), 2),
            "lbtc_rate_pct": safe_pct(int(loc_df["is_lbtc"].sum()), len(loc_df), 2),
            "return_72h_any_pct": safe_pct(int(loc_reached["return_72h"].sum()), len(loc_reached), 2),
            "return_7d_any_pct": safe_pct(int(loc_reached["return_7d"].sum()), len(loc_reached), 2),
            "return_30d_any_pct": safe_pct(int(loc_reached["return_30d"].sum()), len(loc_reached), 2),
            "return_72h_same_pct": safe_pct(int(loc_reached["return_72h_same"].sum()), len(loc_reached), 2),
            "return_7d_same_pct": safe_pct(int(loc_reached["return_7d_same"].sum()), len(loc_reached), 2),
            "return_30d_same_pct": safe_pct(int(loc_reached["return_30d_same"].sum()), len(loc_reached), 2),
            "median_ed_los_min": safe_median(loc_df["ed_los_min"]),
        })

    monthly = (
        sub.groupby("year_month")
        .agg(
            encounters=("Encounter # (CSN)", "count"),
            admits=("is_admit", "sum"),
            lwbs=("is_lwbs", "sum"),
        )
        .astype({"admits": int, "lwbs": int})
        .reset_index()
        .sort_values("year_month")
        .to_dict(orient="records")
    )

    acuity_vc = sub["Acuity"].value_counts()
    by_acuity = [
        {"label": a, "value": int(acuity_vc.get(a, 0))}
        for a in ACUITY_ORDER if acuity_vc.get(a, 0) > 0
    ]
    by_disposition = value_counts_sorted(sub["disposition_bucket"])

    recent = sub.sort_values("Arrival DateTime", ascending=False).head(50)
    patient_list = [
        {
            "encounter": r["Encounter # (CSN)"],
            "mrn": r["MRN (UF)"],
            "location": r["ED Location"],
            "acuity": r["Acuity"],
            "attending": r["Attending MD"],
            "arrival": r["Arrival DateTime"].isoformat() if pd.notnull(r["Arrival DateTime"]) else None,
            "disposition": r["Final ED Disposition"],
            "final_diagnosis": r.get("Final Diagnosis", ""),
            "ed_los_min": None if pd.isna(r["ed_los_min"]) else float(r["ed_los_min"]),
            "returned_within_30d": bool(r["return_30d"]),
        }
        for _, r in recent.iterrows()
    ]

    return {
        "category": category,
        "slug": slugify(category),
        "kpis": kpis,
        "by_location": by_location,
        "monthly_trend": monthly,
        "by_acuity": by_acuity,
        "by_disposition": by_disposition,
        "patient_list": patient_list,
    }


# ---------------------------------------------------------------------------
# Daily Activity Report — replicates the Shands-style per-location PDF
# ---------------------------------------------------------------------------
#
# This payload drives the new /daily route. Each ED location gets a full
# drillable Daily Activity Summary with the exact sections the paper report
# surfaces:
#
#   - Section headline KPIs (yesterday + 4-day trailing + rolling-month avg)
#   - 1A Overall ED Daily Volumes (4-day trailing + 31-day rolling tables,
#        plus disposition breakdown)
#   - 1B Daily Time Studies (Overall / EMS / Non-EMS, Median + P90, plus
#        Admit-only and Discharge-only sub-views with order-written/bed-ready)
#   - 1C Hold Hours tracking (rolling-month trend + comparison stats)
#   - 1D Acuity Levels (rolling-month stacked + admits-only stacked)
#   - 1E Acuity by Time Interval (single-day stacked bar, 6 slots)
#   - 1F Overcrowding (hourly activity single-day + cumulative + rolling-mth avg)
#   - MD Dispo → Admit Order Written (by admit unit AND admit service, both
#        single-day and rolling-month)
#
# Structured JSON so the React layer can re-render anything interactively,
# filter by any slice, and drill down from high-level to the supporting rows.
# ---------------------------------------------------------------------------

# Admit unit + admit service columns in BO pull (fallback-safe — pipeline
# handles absence gracefully if BO schema drifts).
ADMIT_UNIT_COL = "Admit Unit"
ADMIT_SERVICE_COL = "Admit Service"

TIME_INTERVALS_6 = [
    ("12AM - 4AM", 0, 4),
    ("4AM - 7AM", 4, 7),
    ("7AM - 11AM", 7, 11),
    ("11AM - 3PM", 11, 15),
    ("3PM - 7PM", 15, 19),
    ("7PM - 12AM", 19, 24),
]

EMS_QUARTILES = [
    ("EMS (Midnight to 6AM)", 0, 6),
    ("EMS (6AM to Noon)", 6, 12),
    ("EMS (Noon to 6PM)", 12, 18),
    ("EMS (6PM to Midnight)", 18, 24),
]


def _arrival_date_col(df: pd.DataFrame) -> pd.Series:
    """Normalized date-only column from Arrival DateTime."""
    return df["Arrival DateTime"].dt.normalize()


def _fmt_date(d: pd.Timestamp) -> str:
    return d.strftime("%Y-%m-%d")


def _daily_counts(df: pd.DataFrame, dates: list[pd.Timestamp]) -> dict[str, list[Any]]:
    """
    Compute per-day volume counters for the sub-frame. Returns column-oriented
    dict so the React layer can pivot easily.
    """
    arr_dates = _arrival_date_col(df)
    rows: dict[str, list[Any]] = {
        "date": [_fmt_date(d) for d in dates],
        "registered_visits": [],
        "admits": [],
        "discharges": [],
        "lwbs": [],
        "ldt": [],           # Left During Treatment (LBTC)
        "transfers_to_other_ed": [],
        "other": [],         # NO DISPOSITION SELECTED
        "ems_q1": [], "ems_q2": [], "ems_q3": [], "ems_q4": [],
        "transfer_to_psy": [],
        "pct_admits": [],
        "pct_admits_wo_fsed": [],
        "pct_lwbs": [],
        "transfers_from_shed": [],
        "transfers_from_ked": [],
        "total_transfers_from_fsed": [],
        "admits_due_to_transfers": [],
        "pct_transfers_admitted": [],
    }
    for d in dates:
        day = df[arr_dates == d]
        n = len(day)
        admits_n = int(day["is_admit"].sum())
        discharges_n = int(day["is_discharge"].sum())
        lwbs_n = int(day["is_lwbs"].sum())
        ldt_n = int(day["is_lbtc"].sum())
        other_n = int((day["Final ED Disposition"] == "NO DISPOSITION SELECTED").sum())
        psy_n = int((day["Final ED Disposition"] == "TRANSFER TO PSYCHIATRIC FACILITY").sum())

        # Transfers to other ED: ED TRANSFER TO LEESBURG / PEDS (outgoing)
        transfers_out = int(day["Final ED Disposition"].isin(
            {"ED TRANSFER TO LEESBURG ED", "ED TRANSFER TO PEDS ED", "ED TRANSFER TO ADULT ED"}
        ).sum())

        # EMS quartiles by arrival hour (only EMS arrivals)
        ems = day[day["is_ems_arrival"]]
        hr = ems["Arrival DateTime"].dt.hour
        ems_q1 = int(((hr >= 0) & (hr < 6)).sum())
        ems_q2 = int(((hr >= 6) & (hr < 12)).sum())
        ems_q3 = int(((hr >= 12) & (hr < 18)).sum())
        ems_q4 = int(((hr >= 18) & (hr < 24)).sum())

        # FSED transfers in — Arrival Mode Type FROM <SITE>
        amt = day["Arrival Mode Type"].fillna("").str.upper()
        from_shed = int(amt.str.contains("FROM SPRING", na=False).sum())  # Spring Hill = SHED
        from_ked = int(amt.str.contains("FROM KANAPAHA", na=False).sum())
        total_from_fsed = int(amt.str.startswith("FROM ", na=False).sum())
        admits_from_transfers = int(
            (amt.str.startswith("FROM ", na=False) & day["is_admit"]).sum()
        )
        pct_transfers_admitted = (
            safe_pct(admits_from_transfers, total_from_fsed, 1) if total_from_fsed else 0.0
        )

        # % Admits w/o FSED admits: admits excluding those arriving from another FSED
        admits_ex_fsed = int(
            (day["is_admit"] & ~amt.str.startswith("FROM ", na=False)).sum()
        )
        denom_ex_fsed = int((~amt.str.startswith("FROM ", na=False)).sum())

        rows["registered_visits"].append(n)
        rows["admits"].append(admits_n)
        rows["discharges"].append(discharges_n)
        rows["lwbs"].append(lwbs_n)
        rows["ldt"].append(ldt_n)
        rows["transfers_to_other_ed"].append(transfers_out)
        rows["other"].append(other_n)
        rows["ems_q1"].append(ems_q1)
        rows["ems_q2"].append(ems_q2)
        rows["ems_q3"].append(ems_q3)
        rows["ems_q4"].append(ems_q4)
        rows["transfer_to_psy"].append(psy_n)
        rows["pct_admits"].append(safe_pct(admits_n, n, 1))
        rows["pct_admits_wo_fsed"].append(safe_pct(admits_ex_fsed, denom_ex_fsed, 1))
        rows["pct_lwbs"].append(safe_pct(lwbs_n, n, 1))
        rows["transfers_from_shed"].append(from_shed)
        rows["transfers_from_ked"].append(from_ked)
        rows["total_transfers_from_fsed"].append(total_from_fsed)
        rows["admits_due_to_transfers"].append(admits_from_transfers)
        rows["pct_transfers_admitted"].append(pct_transfers_admitted)
    return rows


def _disposition_breakdown_daily(
    df: pd.DataFrame, dates: list[pd.Timestamp]
) -> list[dict[str, Any]]:
    """
    Section 1A page 2 — group every disposition into its parent bucket and
    emit one row per disposition with a daily series across `dates`.
    """
    buckets = [
        ("ADMIT", ["ADMIT"]),
        ("DISCHARGE", [
            "AMA", "CHEST PAIN UNIT", "DISCHARGE", "EXPIRED",
            "LEFT DURING TREATMENT",
            "TRANSFER TO ANOTHER FACILITY", "TRANSFER TO PSYCHIATRIC FACILITY",
        ]),
        ("LWBS", ["LWBS AFTER TRIAGE", "LWBS BEFORE TRIAGE"]),
        ("ED TO ED TRANSFER", [
            "ED TRANSFER TO LEESBURG ED",
            "ED TRANSFER TO PEDS ED",
            "ED TRANSFER TO ADULT ED",
        ]),
        ("OTHER", ["NO DISPOSITION SELECTED"]),
    ]
    arr_dates = _arrival_date_col(df)
    rows = []
    for bucket_label, disps in buckets:
        for disp in disps:
            counts = [
                int(((arr_dates == d) & (df["Final ED Disposition"] == disp)).sum())
                for d in dates
            ]
            if sum(counts) == 0 and disp not in {"ADMIT", "DISCHARGE"}:
                continue  # suppress zero-rows for rare dispositions
            rows.append({
                "bucket": bucket_label,
                "disposition": disp,
                "counts": counts,
                "total": int(sum(counts)),
            })
    return rows


def _time_study_daily(
    df: pd.DataFrame, dates: list[pd.Timestamp],
    mode: Literal["all", "ems", "non-ems"],
    disposition: Literal["all", "admit", "discharge"],
    stat: Literal["median", "p90"],
) -> dict[str, list[Any]]:
    """
    Compute daily time-study series. Values are in HOURS to match PDF.
    Returns series keyed by metric name + dates array.
    Admit variant adds `to_order_written` and `to_bed_ready`.
    Discharge variant adds `discharge_target` constant series = 3.5.
    """
    df = df.copy()
    if mode == "ems":
        df = df[df["is_ems_arrival"]]
    elif mode == "non-ems":
        df = df[~df["is_ems_arrival"]]
    if disposition == "admit":
        df = df[df["is_admit"]]
    elif disposition == "discharge":
        df = df[df["is_discharge"]]

    arr_dates = _arrival_date_col(df)

    series_cols = [
        ("to_triage", "arrival_to_triage_min"),
        ("to_room", "triage_to_inroom_min"),
        ("to_md", "door_to_md_min"),
        ("to_disposition", "door_to_disposition_min"),
        ("to_exit", "ed_los_min"),
    ]
    if disposition == "admit":
        # Add admit-pathway endpoints. Both measured from arrival (per PDF).
        series_cols.extend([
            ("to_order_written", "_arr_to_order_written_min"),
            ("to_bed_ready", "_arr_to_bed_ready_min"),
        ])
        arr = df["Arrival DateTime"]
        df["_arr_to_order_written_min"] = (df["Admit Order Written Datetime"] - arr).dt.total_seconds() / 60
        df["_arr_to_bed_ready_min"] = (df["Bed Ready Datetime"] - arr).dt.total_seconds() / 60
        for c in ["_arr_to_order_written_min", "_arr_to_bed_ready_min"]:
            df.loc[(df[c] < 0) | (df[c] > 4320), c] = None  # 3-day cap

    out: dict[str, list[Any]] = {"date": [_fmt_date(d) for d in dates]}
    for key, col in series_cols:
        vals: list[Any] = []
        for d in dates:
            day = df.loc[arr_dates == d, col].dropna()
            if len(day) == 0:
                vals.append(None)
            else:
                if stat == "median":
                    v = float(np.median(day)) / 60.0
                else:
                    v = float(np.percentile(day, 90)) / 60.0
                vals.append(round(v, 2))
        out[key] = vals
    return out


def _acuity_daily(
    df: pd.DataFrame, dates: list[pd.Timestamp], admits_only: bool
) -> dict[str, list[Any]]:
    """Daily per-ESI stacked bars — either all visits or admits only."""
    if admits_only:
        df = df[df["is_admit"]]
    arr_dates = _arrival_date_col(df)
    out: dict[str, list[Any]] = {"date": [_fmt_date(d) for d in dates]}
    for lvl in ACUITY_ORDER:
        out[lvl] = [int(((arr_dates == d) & (df["Acuity"] == lvl)).sum()) for d in dates]
    return out


def _acuity_by_time_interval(df: pd.DataFrame, target_date: pd.Timestamp) -> list[dict[str, Any]]:
    """Section 1E — single-day breakdown of ESI levels × 6 time slots."""
    arr_dates = _arrival_date_col(df)
    day = df[arr_dates == target_date]
    hr = day["Arrival DateTime"].dt.hour
    rows = []
    for label, lo, hi in TIME_INTERVALS_6:
        slot = day[(hr >= lo) & (hr < hi)]
        row = {"interval": label}
        for lvl in ["ESI-1", "ESI-2", "ESI-3", "ESI-4", "ESI-5"]:
            row[lvl] = int((slot["Acuity"] == lvl).sum())
        row["total"] = int(len(slot))
        rows.append(row)
    return rows


def _hourly_activity_singleday(df: pd.DataFrame, target_date: pd.Timestamp) -> list[dict[str, Any]]:
    """
    Section 1F — per-hour snapshot for a single day. Computes arrivals +
    census snapshots at each hour boundary.

    For each hour H of target_date:
      - arrivals: encounters whose Arrival DateTime is within [H, H+1)
      - total_in_ed: encounters present in the ED at H:00 (arrived <= H, exited > H)
      - total_in_waiting: present AND not yet in-room (Inroom Datetime > H or null)
      - max_hrs_waiting_rm: max (H - Arrival DateTime) among those still waiting
      - lwbs: LWBS departures whose exit (disposition) falls in [H, H+1)
      - admit_dispo_selected: patients with admit disposition but still in ED at H
      - bed_ready: patients with bed-ready time but still in ED at H
    """
    start = pd.Timestamp(target_date)
    rows = []
    # Pre-filter to encounters active that day (+/- 2 days of buffer)
    window_lo = start - pd.Timedelta(days=2)
    window_hi = start + pd.Timedelta(days=2)
    active = df[
        (df["Arrival DateTime"] >= window_lo)
        & (df["Arrival DateTime"] < window_hi)
    ].copy()
    arr = active["Arrival DateTime"]
    exit_ts = active["Exit Datetime"].fillna(active["Disposition Datetime"]).fillna(arr)
    inroom = active["Inroom Datetime"]
    admit_dispo_ts = active["Admit Disposition Datetime"].fillna(active["Disposition Datetime"])
    bed_ready_ts = active["Bed Ready Datetime"]

    for h in range(24):
        hour_start = start + pd.Timedelta(hours=h)
        hour_end = hour_start + pd.Timedelta(hours=1)
        in_hour = (arr >= hour_start) & (arr < hour_end)
        present = (arr <= hour_start) & (exit_ts > hour_start)
        waiting = present & ((inroom.isna()) | (inroom > hour_start))
        waiting_secs = (hour_start - arr[waiting]).dt.total_seconds()
        max_wait_hrs = round(float(waiting_secs.max() / 3600), 1) if len(waiting_secs) else 0.0
        lwbs_hr = in_hour & active["is_lwbs"]
        admit_selected = present & (admit_dispo_ts <= hour_start) & (admit_dispo_ts.notna())
        bed_ready_hr = present & (bed_ready_ts <= hour_start) & (bed_ready_ts.notna())

        rows.append({
            "hour": h,
            "label": _fmt_hour_label(h),
            "arrivals": int(in_hour.sum()),
            "total_in_waiting": int(waiting.sum()),
            "total_in_ed": int(present.sum()),
            "max_hrs_waiting_rm": max_wait_hrs,
            "lwbs": int(lwbs_hr.sum()),
            "admit_dispo_selected": int(admit_selected.sum()),
            "bed_ready": int(bed_ready_hr.sum()),
        })
    return rows


def _fmt_hour_label(h: int) -> str:
    if h == 0: return "12 AM"
    if h < 12: return f"{h} AM"
    if h == 12: return "12 PM"
    return f"{h - 12} PM"


def _hourly_activity_rolling_avg(df: pd.DataFrame, dates: list[pd.Timestamp]) -> list[dict[str, Any]]:
    """
    Section 1F page 20 — rolling-month averaged hourly activity profile.
    Averages arrivals + waiting + in-ED + LWBS across the 31 days.
    """
    # Accumulate per-hour counts across all dates, then divide
    day_rows = [_hourly_activity_singleday(df, d) for d in dates]
    out = []
    for h in range(24):
        agg = {
            "hour": h,
            "label": _fmt_hour_label(h),
            "arrivals": round(float(np.mean([day[h]["arrivals"] for day in day_rows])), 1),
            "total_in_waiting": round(float(np.mean([day[h]["total_in_waiting"] for day in day_rows])), 1),
            "total_in_ed": round(float(np.mean([day[h]["total_in_ed"] for day in day_rows])), 1),
            "max_hrs_waiting_rm": round(
                float(np.max([day[h]["max_hrs_waiting_rm"] for day in day_rows])), 1
            ),
            "lwbs": round(float(np.mean([day[h]["lwbs"] for day in day_rows])), 2),
        }
        out.append(agg)
    return out


def _hold_hours_daily(df: pd.DataFrame, dates: list[pd.Timestamp]) -> dict[str, list[Any]]:
    """
    Section 1C — per-day total hold hours for admitted patients.
    Hold hours = sum of (Exit − Disposition) for admit-dispo encounters on day.
    Plus encounter count and LWBS count for the overlay series.
    """
    adm = df[df["is_admit"]].copy()
    adm["_hold_hrs"] = (adm["Exit Datetime"] - adm["Disposition Datetime"]).dt.total_seconds() / 3600
    adm.loc[(adm["_hold_hrs"] < 0) | (adm["_hold_hrs"] > 240), "_hold_hrs"] = None

    arr_dates_adm = _arrival_date_col(adm)
    arr_dates = _arrival_date_col(df)

    hold = []
    encounters = []
    lwbs = []
    for d in dates:
        hold_day = adm.loc[arr_dates_adm == d, "_hold_hrs"].dropna().sum()
        hold.append(round(float(hold_day), 0) if hold_day else 0.0)
        encounters.append(int((arr_dates == d).sum()))
        lwbs.append(int(((arr_dates == d) & df["is_lwbs"]).sum()))
    return {
        "date": [_fmt_date(d) for d in dates],
        "hold_hours": hold,
        "encounters": encounters,
        "lwbs": lwbs,
    }


def _hold_hours_comparison(hold_series: list[float]) -> dict[str, Any]:
    """
    Section 1C sidebar — summary stats & deltas for hold hours.
    hold_series is the 31-day trailing series (most recent last).
    """
    arr = np.array(hold_series, dtype=float)
    yesterday = float(arr[-1]) if len(arr) else 0.0
    last_7 = arr[-7:] if len(arr) >= 7 else arr
    last_30 = arr  # already 31 days, close enough

    avg30 = float(np.mean(last_30)) if len(last_30) else 0.0
    avg7 = float(np.mean(last_7)) if len(last_7) else 0.0
    med30 = float(np.median(last_30)) if len(last_30) else 0.0
    med7 = float(np.median(last_7)) if len(last_7) else 0.0

    def _pct_dev(v: float, base: float) -> float:
        if base == 0: return 0.0
        return round(100.0 * (v - base) / base, 2)

    return {
        "total_hold_hours_yesterday": round(yesterday, 0),
        "avg_hold_hours_last_30": round(avg30, 0),
        "avg_hold_hours_last_7": round(avg7, 0),
        "median_hold_hours_last_30": round(med30, 0),
        "median_hold_hours_last_7": round(med7, 0),
        "pct_dev_last_month_avg": _pct_dev(yesterday, avg30),
        "pct_dev_last_week_avg": _pct_dev(yesterday, avg7),
        "pct_dev_last_month_median": _pct_dev(yesterday, med30),
        "pct_dev_last_week_median": _pct_dev(yesterday, med7),
    }


def _disp_to_order_written_by_group(
    df: pd.DataFrame, group_col: str, target_date: pd.Timestamp | None = None,
) -> list[dict[str, Any]]:
    """
    MD Disposition to Admit Order Written — average hours per group, plus
    admit count per group. If target_date is None, computes over the full slice
    (rolling month). Only admit-disposition encounters counted.
    """
    if group_col not in df.columns:
        return []  # BO pull didn't include this column
    adm = df[df["is_admit"]].copy()
    if target_date is not None:
        adm = adm[_arrival_date_col(adm) == target_date]
    adm["_disp_to_order"] = (
        (adm["Admit Order Written Datetime"] - adm["Disposition Datetime"]).dt.total_seconds() / 3600
    )
    adm.loc[(adm["_disp_to_order"] < 0) | (adm["_disp_to_order"] > 72), "_disp_to_order"] = None
    adm = adm[adm[group_col].notna() & (adm[group_col].astype(str).str.strip() != "")]

    rows = []
    for group, sub in adm.groupby(group_col):
        vals = sub["_disp_to_order"].dropna()
        rows.append({
            "group": str(group),
            "avg_hours": round(float(vals.mean()), 2) if len(vals) else None,
            "admits": int(len(sub)),
        })
    # Sort by avg_hours descending (longest delay at top — matches PDF)
    rows.sort(key=lambda r: (-(r["avg_hours"] or 0), -r["admits"]))
    return rows


def _top_admit_services_last_24h(df: pd.DataFrame, target_date: pd.Timestamp) -> list[dict[str, Any]]:
    """Top 2 admit services for admits exiting on target_date."""
    if ADMIT_SERVICE_COL not in df.columns:
        return []
    # Use Exit Date rather than Arrival Date (PDF's convention)
    adm = df[df["is_admit"]].copy()
    adm["_exit_date"] = adm["Exit Datetime"].dt.normalize()
    day = adm[adm["_exit_date"] == target_date]
    if len(day) == 0:
        return []
    total = len(day)
    vc = day[ADMIT_SERVICE_COL].value_counts().head(2)
    rows = []
    for rank, (svc, n) in enumerate(vc.items(), start=1):
        svc_rows = day[day[ADMIT_SERVICE_COL] == svc]
        avg_los_hr = (
            (svc_rows["Exit Datetime"] - svc_rows["Arrival DateTime"])
            .dt.total_seconds().dropna().mean() / 3600
        )
        rows.append({
            "rank": rank,
            "service": str(svc),
            "admits": int(n),
            "pct_admits": round(100.0 * int(n) / total, 2),
            "avg_ed_los_hrs": round(float(avg_los_hr), 2) if pd.notna(avg_los_hr) else None,
        })
    return rows


def build_daily_report_payload(df: pd.DataFrame, location: str) -> dict[str, Any]:
    """
    Assemble the full Shands-style daily activity summary for one ED location.
    """
    sub = df[df["ED Location"] == location].copy() if location != "ALL" else df.copy()
    if len(sub) == 0:
        return {"location": location, "empty": True}

    # Most recent arrival date in the slice is "yesterday" (report convention)
    max_date = sub["Arrival DateTime"].max().normalize()
    # 4-day trailing window ending on max_date (matches page 1 4-day table)
    four_day_dates = [max_date - pd.Timedelta(days=i) for i in range(3, -1, -1)]
    # 31-day rolling month ending on max_date
    rolling_dates = [max_date - pd.Timedelta(days=i) for i in range(30, -1, -1)]

    # --- Section 1A: Daily volumes --------------------------------------------
    four_day = _daily_counts(sub, four_day_dates)
    rolling = _daily_counts(sub, rolling_dates)
    disposition_breakdown = _disposition_breakdown_daily(sub, rolling_dates)

    # --- Headline KPI block (4-day trailing averages + rolling-month average)
    def _avg(arr: list[Any]) -> float | None:
        clean = [x for x in arr if x is not None]
        return round(float(np.mean(clean)), 1) if clean else None

    four_day_kpis = {
        k: _avg(four_day[k])
        for k in [
            "registered_visits", "admits", "discharges", "lwbs", "ldt",
            "ems_q1", "ems_q2", "ems_q3", "ems_q4",
            "pct_admits", "pct_admits_wo_fsed", "pct_lwbs",
            "transfer_to_psy", "transfers_from_shed", "transfers_from_ked",
            "total_transfers_from_fsed", "admits_due_to_transfers",
            "pct_transfers_admitted",
        ]
    }
    rolling_kpis = {
        k: _avg(rolling[k])
        for k in four_day_kpis.keys()
    }

    # --- Section 1B: Time studies --------------------------------------------
    # 3 modes × 3 disposition subsets × 2 stats = 18 series. We only emit the
    # ones the PDF actually renders: all × [all, admit, discharge] × [med, p90]
    # plus ems/non-ems × [all, admit, discharge] × [median]
    time_studies: dict[str, Any] = {}
    for mode in ["all", "ems", "non-ems"]:
        for disp in ["all", "admit", "discharge"]:
            for stat in ["median", "p90"]:
                # Skip the P90 for ems/non-ems subsets (PDF only shows the all-mode P90)
                if stat == "p90" and mode != "all":
                    continue
                key = f"{mode}__{disp}__{stat}"
                time_studies[key] = _time_study_daily(sub, rolling_dates, mode, disp, stat)

    # --- Section 1C: Hold hours ----------------------------------------------
    hold = _hold_hours_daily(sub, rolling_dates)
    hold_comparison = _hold_hours_comparison(hold["hold_hours"])

    # --- Section 1D: Acuity levels -------------------------------------------
    acuity_all = _acuity_daily(sub, rolling_dates, admits_only=False)
    acuity_admits = _acuity_daily(sub, rolling_dates, admits_only=True)

    # --- Section 1E: Acuity by time interval (single day) ---------------------
    acuity_by_interval = _acuity_by_time_interval(sub, max_date)

    # --- Section 1F: Overcrowding --------------------------------------------
    hourly_today = _hourly_activity_singleday(sub, max_date)
    # Cumulative view
    cumulative_today = []
    cum_arr = cum_admit = cum_bed = 0
    for row in hourly_today:
        cum_arr += row["arrivals"]
        cum_admit += row["admit_dispo_selected"]
        cum_bed += row["bed_ready"]
        cumulative_today.append({
            "hour": row["hour"],
            "label": row["label"],
            "cumulative_arrivals": cum_arr,
            "cumulative_admit_dispo": cum_admit,
            "cumulative_bed_ready": cum_bed,
        })
    hourly_rolling_avg = _hourly_activity_rolling_avg(sub, rolling_dates)

    # --- MD Dispo → Admit Order Written --------------------------------------
    by_unit_singleday = _disp_to_order_written_by_group(sub, ADMIT_UNIT_COL, target_date=max_date)
    by_unit_rolling = _disp_to_order_written_by_group(sub, ADMIT_UNIT_COL, target_date=None)
    by_service_singleday = _disp_to_order_written_by_group(sub, ADMIT_SERVICE_COL, target_date=max_date)
    by_service_rolling = _disp_to_order_written_by_group(sub, ADMIT_SERVICE_COL, target_date=None)

    # Top 2 admit services last 24 hours
    top_admit_services = _top_admit_services_last_24h(sub, max_date)

    return {
        "location": location,
        "slug": slugify(location),
        "report_date": _fmt_date(max_date),
        "four_day_dates": [_fmt_date(d) for d in four_day_dates],
        "rolling_dates": [_fmt_date(d) for d in rolling_dates],
        "four_day_volumes": four_day,
        "rolling_volumes": rolling,
        "disposition_breakdown": disposition_breakdown,
        "four_day_kpis": four_day_kpis,
        "rolling_kpis": rolling_kpis,
        "time_studies": time_studies,
        "hold_hours": hold,
        "hold_comparison": hold_comparison,
        "acuity_all_daily": acuity_all,
        "acuity_admits_daily": acuity_admits,
        "acuity_by_interval": acuity_by_interval,
        "hourly_today": hourly_today,
        "cumulative_today": cumulative_today,
        "hourly_rolling_avg": hourly_rolling_avg,
        "disp_to_order_by_unit_singleday": by_unit_singleday,
        "disp_to_order_by_unit_rolling": by_unit_rolling,
        "disp_to_order_by_service_singleday": by_service_singleday,
        "disp_to_order_by_service_rolling": by_service_rolling,
        "top_admit_services_24h": top_admit_services,
    }


# ---------------------------------------------------------------------------
# Meta
# ---------------------------------------------------------------------------

def build_meta(
    df: pd.DataFrame,
    top_conditions: list[str],
    fiscal_year: int | None = None,
) -> dict[str, Any]:
    arr = df["Arrival DateTime"].dropna()
    data_through = arr.max() if not arr.empty else None
    is_partial = False
    if fiscal_year is not None and data_through is not None:
        # Compare on date only — intra-day timing should not flag a complete FY
        # as partial just because the last encounter arrived before 23:59.
        fy_end_date = pd.Timestamp(year=fiscal_year, month=6, day=30).date()
        is_partial = bool(data_through.date() < fy_end_date)
    return {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "date_range": {
            "start": arr.min().strftime("%Y-%m-%d") if not arr.empty else None,
            "end": arr.max().strftime("%Y-%m-%d") if not arr.empty else None,
        },
        "fiscal_year": fiscal_year,
        "data_through": data_through.strftime("%Y-%m-%d") if data_through is not None else None,
        "is_partial": is_partial,
        "locations": [{"name": l, "slug": slugify(l)} for l in ED_LOCATIONS],
        "acuity_levels": ACUITY_ORDER,
        "total_encounters": int(len(df)),
        "unique_patients": int(df["MRN (UF)"].nunique()),
        "unique_attendings": int(df["Attending MD"].nunique()),
        "lwbs_count": int((df["LWBS Flag"] == "Y").sum()),
        "conditions": [{"name": c, "slug": slugify(c)} for c in top_conditions],
    }


def build_metric_index() -> dict[str, Any]:
    return {
        "metrics": [
            {
                "slug": m.slug,
                "label": m.label,
                "category": m.category,
                "unit": m.unit,
                "direction": m.direction,
                "description": m.description,
                "subcomponent_slugs": m.subcomponents,
                "has_forecast": m.has_forecast,
            }
            for m in METRICS
        ]
    }


# ---------------------------------------------------------------------------
# I/O
# ---------------------------------------------------------------------------

def _sanitize(obj):
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize(v) for v in obj]
    if isinstance(obj, float):
        if pd.isna(obj) or not np.isfinite(obj):
            return None
        return obj
    if isinstance(obj, np.floating):
        f = float(obj)
        return None if (pd.isna(f) or not np.isfinite(f)) else f
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.bool_):
        return bool(obj)
    return obj


def write_json(obj: Any, path: Path) -> None:
    def default(o):
        if hasattr(o, "isoformat"): return o.isoformat()
        if isinstance(o, (np.integer,)): return int(o)
        if isinstance(o, (np.floating,)):
            f = float(o)
            return None if (pd.isna(f) or not np.isfinite(f)) else f
        if isinstance(o, np.bool_): return bool(o)
        try:
            if pd.isna(o): return None
        except (TypeError, ValueError):
            pass
        raise TypeError(f"Not serializable: {type(o)}")

    path.parent.mkdir(parents=True, exist_ok=True)
    clean = _sanitize(obj)
    path.write_text(json.dumps(clean, default=default, allow_nan=False, separators=(",", ":")))


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def emit_fy_payloads(
    fy_df: pd.DataFrame,
    df_all: pd.DataFrame,
    top_conditions: list[str],
    fy_out: Path,
    fiscal_year: int,
    include_daily: bool,
) -> None:
    """Write the full per-FY payload tree (meta, summary, metrics, conditions,
    and optionally daily reports) to `fy_out`. `df_all` is the full multi-year
    dataset, used by `build_metric_payload` for the `by_condition` breakdown
    and the current-month flag (only the latest FY has a 'current month')."""
    fy_out.mkdir(parents=True, exist_ok=True)
    (fy_out / "metrics").mkdir(parents=True, exist_ok=True)
    (fy_out / "conditions").mkdir(parents=True, exist_ok=True)

    write_json(
        build_meta(fy_df, top_conditions, fiscal_year=fiscal_year),
        fy_out / "meta.json",
    )
    write_json(build_summary_payload(fy_df, top_conditions), fy_out / "summary.json")

    for m in METRICS:
        metric_dir = fy_out / "metrics" / m.slug
        metric_dir.mkdir(parents=True, exist_ok=True)
        write_json(
            build_metric_payload(fy_df, df_all, m, "All Sites", "all"),
            metric_dir / "all.json",
        )
        for loc in ED_LOCATIONS:
            sub = fy_df[fy_df["ED Location"] == loc]
            write_json(
                build_metric_payload(sub, df_all, m, loc, "location"),
                metric_dir / f"{slugify(loc)}.json",
            )
        for cat in top_conditions:
            sub = fy_df[fy_df["ICD-10 Condition Category"] == cat]
            write_json(
                build_metric_payload(sub, df_all, m, cat, "condition"),
                metric_dir / f"cond-{slugify(cat)}.json",
            )

    for cat in top_conditions:
        payload = build_condition_payload(fy_df, cat)
        write_json(payload, fy_out / "conditions" / f"{payload['slug']}.json")

    if include_daily:
        daily_dir = fy_out / "daily"
        daily_dir.mkdir(parents=True, exist_ok=True)
        write_json(build_daily_report_payload(fy_df, "ALL"), daily_dir / "all.json")
        for loc in ED_LOCATIONS:
            payload = build_daily_report_payload(fy_df, loc)
            write_json(payload, daily_dir / f"{slugify(loc)}.json")


def mirror_latest_to_top_level(src: Path, dst: Path) -> None:
    """Copy src/* onto dst/ so the pre-multi-FY flat layout still works for
    the unmodified frontend. Overwrites top-level files on every run."""
    for item in src.iterdir():
        target = dst / item.name
        if item.is_dir():
            shutil.copytree(item, target, dirs_exist_ok=True)
        else:
            shutil.copy2(item, target)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=Path("data_raw"),
                        help="Directory containing clinical_data.csv.")
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()

    out = args.out
    out.mkdir(parents=True, exist_ok=True)

    master_csv = args.data_dir / "clinical_data.csv"
    if not master_csv.exists():
        log.error("Master CSV not found: %s", master_csv)
        return 2

    df_all = load_encounters(master_csv)
    log.info("Master CSV loaded: %d distinct encounters", len(df_all))

    df_all = compute_return_visits(df_all)
    top_conditions = _top_conditions(df_all)

    available_fys = sorted(int(fy) for fy in df_all["fiscal_year"].dropna().unique())
    latest_fy = max(available_fys)

    # --- top-level stable files -------------------------------------------
    write_json(
        {
            "available_fys": available_fys,
            "current_fy": latest_fy,
            "generated_at": datetime.utcnow().isoformat() + "Z",
        },
        out / "index.json",
    )
    log.info("Wrote index.json (FYs: %s, current=FY%d)", available_fys, latest_fy)
    write_json(build_metric_index(), out / "metrics" / "_index.json")
    log.info("Wrote metrics/_index.json")

    # --- per-FY emit ------------------------------------------------------
    for fy in available_fys:
        fy_df = df_all[df_all["fiscal_year"] == fy].copy()
        fy_out = out / f"fy{fy % 100:02d}"
        log.info("Emitting FY%d -> %s (%d encounters, %d conditions)",
                 fy, fy_out.name, len(fy_df), len(top_conditions))
        emit_fy_payloads(
            fy_df, df_all, top_conditions, fy_out,
            fiscal_year=fy,
            include_daily=(fy == latest_fy),
        )

    # --- top-level backward-compat mirror of the latest FY ----------------
    mirror_latest_to_top_level(out / f"fy{latest_fy % 100:02d}", out)
    log.info("Mirrored fy%02d to top level for backward compat", latest_fy % 100)

    log.info("Pipeline complete. %d FYs emitted.", len(available_fys))
    return 0


if __name__ == "__main__":
    sys.exit(main())
