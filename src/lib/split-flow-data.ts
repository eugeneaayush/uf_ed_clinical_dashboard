export const splitFlowData = {
  kpis: {
    doorToMdMedian: { actual: 41.0, sim: 17.2, delta: -23.8 },
    doorToMdP90: { actual: 260.0, sim: 31.1, delta: -228.9 },
    lwbsCount: { actual: 913, sim: 341, delta: -572 },
    lwbsRate: { actual: 5.92, sim: 2.21, delta: -3.71 },
    dischargedLosMedian: { actual: 8.03, sim: 6.12, delta: -1.91 },
    dischargedLosP90: { actual: 18.59, sim: 16.43, delta: -2.16 },
    admittedLosMedian: { actual: 14.47, sim: 13.28, delta: -1.18 },
    admittedLosP90: { actual: 30.40, sim: 28.90, delta: -1.50 },
  },
  byLane: [
    { lane: "Super Track", encounters: 4956, actualLwbsPct: 9.71, simLwbsPct: 2.42, actualDoorMedian: 58.0, simDoorMedian: 17.56, actualLos: 528.0, simLos: 392.45 },
    { lane: "Main ED", encounters: 7551, actualLwbsPct: 4.66, simLwbsPct: 1.87, actualDoorMedian: 42.0, simDoorMedian: 16.52, actualLos: 645.0, simLos: 549.33 },
    { lane: "Off-Window", encounters: 2347, actualLwbsPct: 3.41, simLwbsPct: 3.41, actualDoorMedian: 30.0, simDoorMedian: 30.0, actualLos: 544.0, simLos: 544.00 },
    { lane: "Red/Bypass", encounters: 570, actualLwbsPct: 0.00, simLwbsPct: 0.00, actualDoorMedian: 16.0, simDoorMedian: 13.06, actualLos: 372.5, simLos: 361.55 },
  ],
  acuityLwbs: [
    { acuity: "ESI-1", actual: 0, sim: 0, retained: 0 },
    { acuity: "ESI-2", actual: 160, sim: 70, retained: 90 },
    { acuity: "ESI-3", actual: 575, sim: 200, retained: 375 },
    { acuity: "ESI-4", actual: 124, sim: 47, retained: 77 },
    { acuity: "ESI-5", actual: 13, sim: 7, retained: 6 },
    { acuity: "Unknown", actual: 41, sim: 17, retained: 24 },
  ],
};
