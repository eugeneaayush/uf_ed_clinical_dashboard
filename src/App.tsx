import { Routes, Route, Navigate } from "react-router-dom";
import { Shell } from "./components/Shell";
import { Summary } from "./pages/Summary";
import { MetricsIndex } from "./pages/MetricsIndex";
import { MetricDetail } from "./pages/MetricDetail";
import { ConditionsIndex } from "./pages/ConditionsIndex";
import { ConditionDetail } from "./pages/ConditionDetail";
import { DailyReport } from "./pages/DailyReport";

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Navigate to="/summary" replace />} />
        <Route path="/summary" element={<Summary />} />
        <Route path="/metrics" element={<MetricsIndex />} />
        <Route path="/metrics/:slug" element={<MetricDetail />} />
        <Route path="/conditions" element={<ConditionsIndex />} />
        <Route path="/conditions/:slug" element={<ConditionDetail />} />
        <Route path="/daily" element={<DailyReport />} />
        {/* Legacy paths → new homes */}
        <Route path="/los" element={<Navigate to="/metrics/ed-los" replace />} />
        <Route path="/stroke" element={<Navigate to="/conditions/stroke-cva" replace />} />
        <Route path="*" element={<Navigate to="/summary" replace />} />
      </Route>
    </Routes>
  );
}
