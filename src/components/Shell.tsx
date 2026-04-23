import { Outlet, useLocation } from "react-router-dom";
import { useMeta } from "../lib/data";
import { fmtInt } from "../lib/format";
import { SidebarLayout } from "./catalyst/sidebar-layout";
import { Sidebar, SidebarBody, SidebarFooter, SidebarHeader, SidebarItem, SidebarLabel, SidebarSection, SidebarSpacer } from "./catalyst/sidebar";
import { Navbar, NavbarSection, NavbarSpacer } from "./catalyst/navbar";
import { HomeIcon, ChartBarIcon, ClipboardDocumentListIcon, CalendarDaysIcon, ArrowPathRoundedSquareIcon } from "@heroicons/react/20/solid";
import { Badge } from "./catalyst/badge";
import { Text } from "./catalyst/text";

const TABS = [
  { to: "/summary", icon: <HomeIcon />, label: "Summary" },
  { to: "/metrics", icon: <ChartBarIcon />, label: "Metrics" },
  { to: "/conditions", icon: <ClipboardDocumentListIcon />, label: "Conditions" },
  { to: "/daily", icon: <CalendarDaysIcon />, label: "Daily Report" },
  { to: "/split-flow", icon: <ArrowPathRoundedSquareIcon />, label: "Split Flow Backtest" },
];

/** Keep ?loc and ?cmp filters when switching top tabs. Drop ?tab (sub-tab). */
function preserveFilters(search: string): string {
  const params = new URLSearchParams(search);
  const keep = new URLSearchParams();
  for (const k of ["loc", "cmp", "cmpView"]) {
    const v = params.get(k);
    if (v) keep.set(k, v);
  }
  const s = keep.toString();
  return s ? `?${s}` : "";
}

export function Shell() {
  const meta = useMeta();
  const loc = useLocation();
  const isRoot = loc.pathname === "/" || loc.pathname === "";

  return (
    <SidebarLayout
      navbar={
        <Navbar>
          <NavbarSpacer />
          <NavbarSection>
            {/* You can add top right items here if needed */}
          </NavbarSection>
        </Navbar>
      }
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-3 py-2">
              <img
                src="/em-logo.png"
                alt="UF Emergency Medicine"
                className="h-8 w-auto"
              />
            </div>
          </SidebarHeader>
          <SidebarBody>
            <SidebarSection>
              {TABS.map((t) => {
                const active = loc.pathname.startsWith(t.to) || (isRoot && t.to === "/summary");
                return (
                  <SidebarItem key={t.to} href={`${t.to}${preserveFilters(loc.search)}`} current={active}>
                    {t.icon}
                    <SidebarLabel>{t.label}</SidebarLabel>
                  </SidebarItem>
                );
              })}
            </SidebarSection>
            
            <SidebarSpacer />
            
            {meta.data && (
              <SidebarSection>
                <div className="px-3 py-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl ring-1 ring-zinc-900/5 dark:ring-white/10 flex flex-col gap-3">
                  <div>
                    <Badge color="orange">Clinical Dashboard</Badge>
                  </div>
                  <Text className="text-[11px] font-mono opacity-80">
                    {meta.data.date_range.start} → {meta.data.date_range.end}
                  </Text>
                  
                  <div className="flex flex-col gap-2 mt-2">
                    <div className="flex justify-between items-end">
                      <Text className="text-xs">Encounters</Text>
                      <Text className="font-display font-semibold text-zinc-900 dark:text-white tabular">{fmtInt(meta.data.total_encounters)}</Text>
                    </div>
                    <div className="flex justify-between items-end">
                      <Text className="text-xs">Patients</Text>
                      <Text className="font-display font-semibold text-zinc-900 dark:text-white tabular">{fmtInt(meta.data.unique_patients)}</Text>
                    </div>
                    <div className="flex justify-between items-end">
                      <Text className="text-xs">LWBS</Text>
                      <Text className="font-display font-semibold text-zinc-900 dark:text-white tabular">{fmtInt(meta.data.lwbs_count)}</Text>
                    </div>
                  </div>
                </div>
              </SidebarSection>
            )}
          </SidebarBody>
          <SidebarFooter>
            <div className="flex items-center gap-3 px-2 py-2 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
              <img
                src="/gator-doc.jpg"
                alt=""
                className="h-8 w-8 object-contain rounded-full bg-zinc-100 ring-1 ring-zinc-200"
              />
              <div className="text-[10px] leading-tight text-zinc-500">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">UF College of Medicine</span>
                <br />
                Dept of Emergency Medicine
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>
      }
    >
      {/* Main Outlet */}
      <div className="animate-fade-up">
        <Outlet />
      </div>
    </SidebarLayout>
  );
}
