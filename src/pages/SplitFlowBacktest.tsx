import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card } from "../components/Card";
import { Kpi } from "../components/Kpi";
import { splitFlowData } from "../lib/split-flow-data";

export function SplitFlowBacktest() {
  return (
    <div className="space-y-10 animate-fade-up">
      <div>
        <h2 className="font-display text-[32px] font-extrabold tracking-tight text-slate-900">
          Split Flow Backtest Results
        </h2>
        <p className="mt-2 text-[15px] text-slate-600 max-w-3xl">
          Based on the simulation dataset of 15,424 distinct ADULT ED encounters
          from 07/01/2025 to 04/19/2026. This data models the expected throughput
          if the proposed Split Flow model had been fully implemented.
        </p>
      </div>

      <section>
        <h3 className="font-display text-[18px] font-bold text-slate-900 mb-4">
          Headline KPIs (Simulated vs Actual)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi
            label="Door-to-MD Median"
            value={`${splitFlowData.kpis.doorToMdMedian.sim.toFixed(0)} min`}
            hint={`Actual: ${splitFlowData.kpis.doorToMdMedian.actual.toFixed(0)} min`}
            tone={splitFlowData.kpis.doorToMdMedian.sim <= 15 ? "good" : "warn"}
          />
          <Kpi
            label="LWBS Rate"
            value={`${splitFlowData.kpis.lwbsRate.sim.toFixed(2)}%`}
            hint={`Actual: ${splitFlowData.kpis.lwbsRate.actual.toFixed(2)}%`}
            tone={splitFlowData.kpis.lwbsRate.sim <= 3.0 ? "good" : "warn"}
          />
          <Kpi
            label="Discharged LOS Median"
            value={`${splitFlowData.kpis.dischargedLosMedian.sim.toFixed(2)} hr`}
            hint={`Actual: ${splitFlowData.kpis.dischargedLosMedian.actual.toFixed(2)} hr`}
            tone={splitFlowData.kpis.dischargedLosMedian.sim <= 4.5 ? "good" : "warn"}
          />
          <Kpi
            label="LWBS Retained"
            value={splitFlowData.kpis.lwbsCount.delta.toString().replace("-", "")}
            hint="Total encounters retained by simulation"
            tone="accent"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Door-to-Clinician Median by Lane" sub="Simulated vs Actual (minutes)">
          <div className="h-[300px] mt-4 w-full text-[12px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={splitFlowData.byLane} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="lane" axisLine={false} tickLine={false} tick={{ fill: "#64748b" }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b" }} />
                <Tooltip
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                />
                <Legend wrapperStyle={{ paddingTop: "20px" }} />
                <Bar dataKey="actualDoorMedian" name="Actual (min)" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="simDoorMedian" name="Simulated (min)" fill="#3080ff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="LWBS % by Lane" sub="Simulated vs Actual">
          <div className="h-[300px] mt-4 w-full text-[12px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={splitFlowData.byLane} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="lane" axisLine={false} tickLine={false} tick={{ fill: "#64748b" }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b" }} />
                <Tooltip
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                />
                <Legend wrapperStyle={{ paddingTop: "20px" }} />
                <Bar dataKey="actualLwbsPct" name="Actual %" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="simLwbsPct" name="Simulated %" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="LWBS Retained by Acuity" sub="Number of LWBS encounters retained by Split Flow" className="lg:col-span-2">
          <div className="h-[300px] mt-4 w-full text-[12px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={splitFlowData.acuityLwbs} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="acuity" axisLine={false} tickLine={false} tick={{ fill: "#64748b" }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b" }} />
                <Tooltip
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                />
                <Legend wrapperStyle={{ paddingTop: "20px" }} />
                <Bar dataKey="retained" name="Retained Encounters" fill="#0284c7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <section className="pt-6">
        <h3 className="font-display text-[24px] font-bold text-slate-900 mb-6">
          Understanding the Simulation
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="How the Results Were Derived" sub="Simulation Methodology & Rules">
            <div className="prose prose-sm prose-slate max-w-none">
              <p>
                The backtest simulates actual ED encounters through a proposed Split Flow model operating between <strong>08:00 and 01:00</strong>. Encounters outside this window retain their actual metrics.
              </p>
              <h4>Lane Assignments</h4>
              <ul>
                <li><strong>Red / Bypass:</strong> ESI-1 patients (always bedded immediately).</li>
                <li><strong>Main ED after Intake:</strong> ESI-2 patients, ESI-3 patients routed to Main ED (probabilistic 35% split), and unclassified acuities.</li>
                <li><strong>Super Track:</strong> ESI-4/5 patients, and ESI-3 patients routed to Super Track (probabilistic 65% split, eliminating lookahead bias).</li>
              </ul>
              <h4>Simulation Rules</h4>
              <ul>
                <li><strong>Door-to-Clinician:</strong> Normal hours are modeled around 15 minutes. During surge hours (top 20% arrival volume), Door-to-MD is modeled around 25 minutes to account for intake bottlenecks.</li>
                <li><strong>LWBS Reduction:</strong> Assumes rapid MD contact retains patients. Super Track eligible LWBS patients are retained at an 75% rate; ESI-2 Main ED patients at 60%; and ESI-1 at 100%.</li>
                <li><strong>ED Length of Stay (LOS):</strong> For discharged patients, time from MD to Disposition is compressed by a flat 45 minutes for Super Track and a flat 20 minutes for Main ED.</li>
              </ul>
            </div>
          </Card>

          <Card title="Implications & Limitations" sub="What this means for operations">
            <div className="prose prose-sm prose-slate max-w-none">
              <p>
                This simulation reveals the significant upside of implementing an Intake/Super Track model, but also highlights where Split Flow cannot solve systemic issues.
              </p>
              <h4>Key Implications</h4>
              <ul>
                <li><strong>Massive LWBS Reduction:</strong> The model projects retaining roughly 570 patients who otherwise would have left. This represents a massive capture of lost revenue and a major improvement in clinical safety, modeled conservatively without over-promising 80%+ capture rates.</li>
                <li><strong>Drastic Initial Wait Time Drop:</strong> Median wait times drop from 41 minutes to roughly 17 minutes. The inclusion of surge penalties means that while performance drastically improves, it acknowledges times of peak congestion.</li>
                <li><strong>Discharge LOS Bottleneck:</strong> Despite earlier provider contact, Discharged LOS still falls short of the ideal 4.5-hour target (hitting ~6.1 hours). This implies that while front-end flow improves, diagnostic turnaround or backend discharge processes still throttle the overall visit length.</li>
              </ul>
              <h4>Limitations to Consider</h4>
              <ul>
                <li><strong>Boarding is Exogenous:</strong> Admitted patient LOS barely improves (14.47 hr to 13.08 hr) because Split Flow does not create inpatient hospital beds. Boarding times remain mostly unchanged.</li>
                <li><strong>Capacity Assumptions:</strong> The simulation assumes there are always enough Intake bays and Super Track chairs to meet demand. It does not model physical queue limits during extreme surges.</li>
              </ul>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
