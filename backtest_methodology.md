# UF Adult ED Split-Flow Back Test — Methodology

## Dataset
- Source: Split Flow Back Test.xlsx
- Scope: ADULT ED only (per `ED Location` column)
- Period: 2025-07-01 → 2026-04-19 (293 days, 15,424 distinct encounters, 52.6/day avg)
- Deduplication: First row per `Encounter # (CSN)` (multiple rows/encounter are attribute variants, not distinct visits)

## Split-Flow Model (from UF reference document)
- **Operating window:** 08:00–01:00 local time (17 hr/day)
- **Lanes:**
  - **Red / Bypass → Main ED:** time-sensitive, immediate bedding
  - **Discharge from Intake:** low-risk, treat-and-release post-MSE
  - **Super Track (Vertical):** ESI 4–5 + select ESI-3, chair/recliner based
  - **Main ED after Intake:** bed-dependent ESI 2–3 and admits
- **Initial targets:** Door-to-Clinician ≤15/45 (median/P90) min; LWBS ≤3.0%; Discharged LOS ≤4.5/7.0 hr; Ambulance offload ≤20/45 min

## Lane Assignment Rules (applied to each ADULT ED encounter)
| Condition | Lane |
|---|---|
| Arrival hour outside 08:00–01:00 | **Off-Window** (no change) |
| ESI-1 (in-window) | **Red/Bypass** |
| ESI-2 (in-window) | **Main ED after Intake** |
| ESI-3 (in-window), admit/transfer outcome | **Main ED after Intake** |
| ESI-3 (in-window), discharge/LWBS | **Super Track** (vertical-eligible) |
| ESI-4/5 (in-window) | **Super Track** |
| Acuity missing (in-window) | **Main ED after Intake** (conservative) |

## Simulation Rules (explicit, so reviewers can reproduce)
1. **Off-Window encounters:** simulated = actual (no Split-Flow staffing off-hours in the current design).
2. **Arrival-to-MD (door-to-clinician) — in-window encounters:**
   - Attending intake starts MSE within 15 min of arrival.
   - Apply: `sim_arr_to_md = min(actual, 15)` for non-LWBS.
   - For LWBS patients retained by Split Flow (see rule 3), set sim_arr_to_md = 15 min (they *would have* been seen at intake).
3. **LWBS Reduction — in-window encounters:**
   - LWBS is driven primarily by delayed clinical contact. Patients now seen by intake attending within 15 min are unlikely to LWBS after MSE.
   - Apply by lane:
     - **Super Track candidates** (ESI 3–5, LWBS in-window): 85% retention → LWBS rate floors at steady-state-ish level. Rationale: published split-flow implementations typically reduce LWBS 50–80%; we use 85% capture = 15% residual.
     - **Main ED after Intake (ESI-2)**: 70% retention (some still leave due to boarding).
     - **Red/Bypass (ESI-1)**: 100% retention (always bedded immediately).
     - **Off-window LWBS**: unchanged.
   - Retained LWBS patients are re-classified by what their disposition would likely have been based on the non-LWBS distribution within their acuity tier.
4. **ED LOS for Discharged Super-Track Patients:**
   - Under vertical care with orders initiated at intake, LOS compresses via (a) earlier MD contact and (b) parallel workup.
   - Approach: decompose LOS = arrival-to-MD + MD-to-disposition + disposition-to-exit.
     - `sim_arr_to_MD` per rule 2 (cap 15 min median).
     - `sim_MD_to_disp` = actual × 0.75 (25% reduction — reflects order sets, early labs, vertical reassessment cadence). This is a conservative benchmark; published data support 20–35%.
     - `sim_disp_to_exit` = actual (minimal change — already short for discharges).
5. **ED LOS for Discharged Main-ED Patients (ESI-2 in-window):**
   - `sim_arr_to_MD` cap 15.
   - `sim_MD_to_disp` = actual × 0.90 (10% reduction — modest benefit from early orders at intake; still need main ED beds/workup).
   - `sim_disp_to_exit` = actual.
6. **ED LOS for Admitted Patients:**
   - Disposition-to-exit = boarding time — driven by hospital bed availability, not ED operations. **Unchanged.**
   - `sim_arr_to_MD` cap 15 (in-window).
   - `sim_MD_to_disp` = actual × 0.90 (modest reduction — earlier order initiation reduces decision time).
   - Admit LOS barely improves because boarding dominates.
7. **Ambulance Offload:** not directly simulated (no offload field); flagged as a related secondary benefit.

## Metrics Reported
- Door-to-Clinician median & P90 (actual vs simulated, all + by lane)
- LWBS rate (actual vs simulated, overall + by acuity)
- Discharged LOS median & P90 (actual vs simulated)
- Admitted LOS median & P90 (actual vs simulated)
- Volume redirected to Super Track
- Safety balancing check: count of ESI-3 patients routed to Super Track whose actual disposition was ADMIT (false-streaming risk)

## Key Assumptions & Limitations
- **No staffing queue model:** assumes Split Flow has sufficient capacity (2–4 intake bays, 12–18 Super Track chairs) to meet peak demand. Average in-window volume ~44/day; peak hour ~4.4 patients — within a 2-bay, 15-min cycle intake design.
- **Boarding is exogenous:** downstream hospital bed availability is not modified by Split Flow; admit LOS tail is largely unchanged.
- **LWBS reallocation** assumes the disposition mix of retained LWBS patients matches their acuity-peers (most would discharge from Super Track).
- **Off-window window not modeled:** 01:00–08:00 (15.2% of arrivals) retains actual operations.
- **Deterministic estimates:** we report point estimates; a range/sensitivity analysis is included for the three main levers (MD cap, LWBS capture %, MD-to-disposition compression).
