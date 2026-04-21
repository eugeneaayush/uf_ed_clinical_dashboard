/**
 * Chart palette — all values drawn from the template's compiled CSS so
 * charts visually lock into the same blue/orange/slate system as the rest
 * of the UI.
 */

export const CHART_COLORS = [
  "#0021A5", // UF blue (primary)
  "#FA4616", // UF orange
  "#155dfc", // electric blue
  "#1d293d", // slate 800
  "#3080ff", // sky 400
  "#c73611", // orange deep
  "#62748e", // slate 500
  "#90c5ff", // sky 300
];

export const LOCATION_COLOR: Record<string, string> = {
  "ADULT ED": "#0021A5",
  "PEDS ED": "#FA4616",
  "KANAPAHA ED": "#155dfc",
  "SPRING ED": "#1d293d",
  "ONH ED": "#3080ff",
};

export const ACUITY_COLOR: Record<string, string> = {
  "ESI-1": "#c73611", // most severe
  "ESI-2": "#FA4616",
  "ESI-3": "#0021A5",
  "ESI-4": "#155dfc",
  "ESI-5": "#90c5ff",
  Unknown: "#cad5e2",
};

export const DISPOSITION_COLOR: Record<string, string> = {
  Discharge: "#0021A5",
  Admit: "#1d293d",
  "LWBS/AMA": "#FA4616",
  Transfer: "#155dfc",
  Expired: "#62748e",
  Other: "#cad5e2",
};

export const getColor = (i: number): string =>
  CHART_COLORS[i % CHART_COLORS.length];
