/**
 * v5 contracts. Mirror scripts/aggregate.py v5. Keep in sync on changes.
 *
 * The dashboard is metric-centric: one canonical payload shape per
 * (metric × slice), rendered by a single parameterized page.
 */

// ===== Meta =====

export interface LocationRef {
  name: string;
  slug: string;
}

export interface ConditionRef {
  name: string;
  slug: string;
}

export interface Meta {
  generated_at: string;
  date_range: { start: string | null; end: string | null };
  locations: LocationRef[];
  acuity_levels: string[];
  total_encounters: number;
  unique_patients: number;
  unique_attendings: number;
  conditions: ConditionRef[];
}

// ===== Metric registry =====

export type MetricUnit = "min" | "pct" | "count" | "score";
export type MetricDirection = "lower" | "higher";

export interface MetricRegistryEntry {
  slug: string;
  label: string;
  category: string;
  unit: MetricUnit;
  direction: MetricDirection;
  description: string;
  subcomponent_slugs: string[];
  has_forecast: boolean;
}

export interface MetricIndex {
  metrics: MetricRegistryEntry[];
}

// ===== Per-metric payload (the workhorse) =====

export interface MetricMonthlyRow {
  year_month: string;
  value: number | null;
  forecast: number | null;
  delta: number | null;
  is_current_month: boolean;
  days_observed: number | null;
  days_in_month: number;
}

export interface MetricLocationRow {
  location: string;
  value: number | null;
  n: number;
}

export interface MetricConditionRow {
  condition: string;
  slug: string;
  value: number | null;
  n: number;
}

export interface MetricSubcomponent {
  slug: string;
  label: string;
  unit: MetricUnit;
  value: number | null;
}

export type SliceKind = "all" | "location" | "condition";

export interface MetricPayload {
  metric: MetricRegistryEntry;
  slice: {
    kind: SliceKind;
    name: string;
  };
  overall: number | null;
  n_encounters: number;
  monthly: MetricMonthlyRow[];
  by_location: MetricLocationRow[];
  by_condition: MetricConditionRow[];
  subcomponents: MetricSubcomponent[];
}

// ===== Oracle-style Summary payload =====

export interface SummaryKpi {
  label: string;
  value: number;
  /** If set, the KPI is clickable and routes to /metrics/<link> */
  link: string | null;
}

export interface Labeled {
  label: string;
  value: number;
}

export interface PctLabeled extends Labeled {
  pct: number;
}

export interface MonthlyCount {
  year_month: string;
  value: number;
}

export interface AcuityLocationRow {
  label: string;
  value: number | null; // mean ESI (1-5)
  encounters: number;
}

export interface SummaryPayload {
  kpis: SummaryKpi[];
  admissions_by_diagnosis: Labeled[];
  discharges_by_diagnosis: Labeled[];
  avg_acuity_by_location: AcuityLocationRow[];
  pct_by_diagnosis: PctLabeled[];
  top_10_diagnoses: Labeled[];
  arrival_by_year: Array<Record<string, string | number>>;
  acuity_monthly: Array<Record<string, string | number>>;
}

// ===== Daily Activity Report (per ED location) =====

export interface DailyVolumesCounts {
  date: string[];
  registered_visits: number[];
  admits: number[];
  discharges: number[];
  lwbs: number[];
  ldt: number[];
  transfers_to_other_ed: number[];
  other: number[];
  ems_q1: number[];
  ems_q2: number[];
  ems_q3: number[];
  ems_q4: number[];
  transfer_to_psy: number[];
  pct_admits: number[];
  pct_admits_wo_fsed: number[];
  pct_lwbs: number[];
  transfers_from_shed: number[];
  transfers_from_ked: number[];
  total_transfers_from_fsed: number[];
  admits_due_to_transfers: number[];
  pct_transfers_admitted: number[];
}

export interface DispositionBreakdownRow {
  bucket: string;
  disposition: string;
  counts: number[];
  total: number;
}

export interface TimeStudySeries {
  date: string[];
  to_triage: (number | null)[];
  to_room: (number | null)[];
  to_md: (number | null)[];
  to_disposition: (number | null)[];
  to_exit: (number | null)[];
  to_order_written?: (number | null)[];
  to_bed_ready?: (number | null)[];
}

export interface HoldHoursSeries {
  date: string[];
  hold_hours: number[];
  encounters: number[];
  lwbs: number[];
}

export interface HoldComparison {
  total_hold_hours_yesterday: number;
  avg_hold_hours_last_30: number;
  avg_hold_hours_last_7: number;
  median_hold_hours_last_30: number;
  median_hold_hours_last_7: number;
  pct_dev_last_month_avg: number;
  pct_dev_last_week_avg: number;
  pct_dev_last_month_median: number;
  pct_dev_last_week_median: number;
}

export interface AcuityDailySeries {
  date: string[];
  "ESI-1": number[];
  "ESI-2": number[];
  "ESI-3": number[];
  "ESI-4": number[];
  "ESI-5": number[];
  Unknown: number[];
}

export interface AcuityIntervalRow {
  interval: string;
  "ESI-1": number;
  "ESI-2": number;
  "ESI-3": number;
  "ESI-4": number;
  "ESI-5": number;
  total: number;
}

export interface HourlyActivityRow {
  hour: number;
  label: string;
  arrivals: number;
  total_in_waiting: number;
  total_in_ed: number;
  max_hrs_waiting_rm: number;
  lwbs: number;
  admit_dispo_selected: number;
  bed_ready: number;
}

export interface CumulativeHourRow {
  hour: number;
  label: string;
  cumulative_arrivals: number;
  cumulative_admit_dispo: number;
  cumulative_bed_ready: number;
}

export interface HourlyRollingRow {
  hour: number;
  label: string;
  arrivals: number;
  total_in_waiting: number;
  total_in_ed: number;
  max_hrs_waiting_rm: number;
  lwbs: number;
}

export interface DispToOrderRow {
  group: string;
  avg_hours: number | null;
  admits: number;
}

export interface TopAdmitServiceRow {
  rank: number;
  service: string;
  admits: number;
  pct_admits: number;
  avg_ed_los_hrs: number | null;
}

export interface DailyReportKpis {
  registered_visits: number | null;
  admits: number | null;
  discharges: number | null;
  lwbs: number | null;
  ldt: number | null;
  ems_q1: number | null;
  ems_q2: number | null;
  ems_q3: number | null;
  ems_q4: number | null;
  pct_admits: number | null;
  pct_admits_wo_fsed: number | null;
  pct_lwbs: number | null;
  transfer_to_psy: number | null;
  transfers_from_shed: number | null;
  transfers_from_ked: number | null;
  total_transfers_from_fsed: number | null;
  admits_due_to_transfers: number | null;
  pct_transfers_admitted: number | null;
}

export interface DailyReportPayload {
  location: string;
  slug: string;
  report_date: string;
  four_day_dates: string[];
  rolling_dates: string[];
  four_day_volumes: DailyVolumesCounts;
  rolling_volumes: DailyVolumesCounts;
  disposition_breakdown: DispositionBreakdownRow[];
  four_day_kpis: DailyReportKpis;
  rolling_kpis: DailyReportKpis;
  time_studies: Record<string, TimeStudySeries>;
  hold_hours: HoldHoursSeries;
  hold_comparison: HoldComparison;
  acuity_all_daily: AcuityDailySeries;
  acuity_admits_daily: AcuityDailySeries;
  acuity_by_interval: AcuityIntervalRow[];
  hourly_today: HourlyActivityRow[];
  cumulative_today: CumulativeHourRow[];
  hourly_rolling_avg: HourlyRollingRow[];
  disp_to_order_by_unit_singleday: DispToOrderRow[];
  disp_to_order_by_unit_rolling: DispToOrderRow[];
  disp_to_order_by_service_singleday: DispToOrderRow[];
  disp_to_order_by_service_rolling: DispToOrderRow[];
  top_admit_services_24h: TopAdmitServiceRow[];
}

// ===== Condition drill-down (unchanged, served from /conditions/<slug>) =====

export interface ConditionKpis {
  encounters: number;
  unique_patients: number;
  admits: number;
  admit_rate_pct: number;
  lwbs_rate_pct: number;
  lbtc_rate_pct: number;
  median_ed_los_min: number | null;
  return_72h_any_pct: number;
  return_7d_any_pct: number;
  return_30d_any_pct: number;
  return_72h_same_pct: number;
  return_7d_same_pct: number;
  return_30d_same_pct: number;
  ems_transports: number;
  ems_share_pct: number;
  offload_median_min: number | null;
  offload_p90_min: number | null;
  offload_gt_20min_pct: number;
}

export interface ConditionLocationRow {
  location: string;
  encounters: number;
  admit_rate_pct: number;
  lwbs_rate_pct: number;
  lbtc_rate_pct: number;
  return_72h_any_pct: number;
  return_7d_any_pct: number;
  return_30d_any_pct: number;
  return_72h_same_pct: number;
  return_7d_same_pct: number;
  return_30d_same_pct: number;
  median_ed_los_min: number | null;
}

export interface ConditionPayload {
  category: string;
  slug: string;
  kpis: ConditionKpis;
  by_location: ConditionLocationRow[];
  monthly_trend: Array<{
    year_month: string;
    encounters: number;
    admits: number;
    lwbs: number;
  }>;
  by_acuity: Labeled[];
  by_disposition: Labeled[];
  patient_list: Array<{
    encounter: string;
    mrn: string;
    location: string;
    acuity: string;
    attending: string;
    arrival: string | null;
    disposition: string;
    final_diagnosis: string;
    ed_los_min: number | null;
    returned_within_30d: boolean;
  }>;
}
