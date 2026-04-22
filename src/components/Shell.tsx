import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useMeta } from "../lib/data";
import { SidebarLayout } from "./catalyst/sidebar-layout";
import {
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarSection,
} from "./catalyst/sidebar";
import ufhLogo from "../assets/ufh-emergency-services.jpg";

// Served from `public/` at runtime — no ES import.
const GATOR_DOC_SRC = "/gator-doc.jpg";

const NAV_ITEMS = [
  { to: "/summary", num: "01", label: "Summary" },
  { to: "/metrics", num: "02", label: "Metrics" },
  { to: "/conditions", num: "03", label: "Conditions" },
  { to: "/daily", num: "04", label: "Daily Report" },
];

/** Keep ?loc / ?cmp / ?cmpView filters when switching top-level nav. */
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

function SidebarContents() {
  const loc = useLocation();
  const meta = useMeta();
  const isRoot = loc.pathname === "/" || loc.pathname === "";
  const refreshed = meta.data?.generated_at
    ? new Date(meta.data.generated_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 shadow-sm ring-1 ring-black/5">
            <img
              src={ufhLogo}
              alt="UF Health Emergency Services"
              className="h-9 w-auto"
            />
          </div>
        </div>
        {meta.data && (
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-uf-orange/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-uf-orange ring-1 ring-uf-orange/30">
              Clinical · FY26
            </span>
          </div>
        )}
      </SidebarHeader>

      <SidebarBody>
        <SidebarSection>
          {NAV_ITEMS.map((item) => {
            const active =
              loc.pathname.startsWith(item.to) ||
              (isRoot && item.to === "/summary");
            return (
              <NavLink
                key={item.to}
                to={`${item.to}${preserveFilters(loc.search)}`}
                end={false}
                className={({ isActive }) => {
                  const on = active || isActive;
                  return [
                    "flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-colors",
                    on
                      ? "bg-white/5 text-zinc-100"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100",
                  ].join(" ");
                }}
                data-current={active ? "true" : undefined}
              >
                <span
                  aria-hidden
                  className={[
                    "font-mono text-[11px]",
                    active ? "text-blue-400" : "text-zinc-500",
                  ].join(" ")}
                >
                  {item.num}
                </span>
                <span
                  aria-hidden
                  className="h-3 w-px bg-white/10"
                />
                <span className="whitespace-nowrap">{item.label}</span>
              </NavLink>
            );
          })}
        </SidebarSection>
      </SidebarBody>

      <SidebarFooter>
        <div className="flex items-start gap-3">
          <img
            src={GATOR_DOC_SRC}
            alt=""
            aria-hidden="true"
            className="h-9 w-9 rounded-md object-cover opacity-90 ring-1 ring-white/10"
          />
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-zinc-200 leading-snug">
              UF College of Medicine
            </div>
            <div className="text-[11px] text-zinc-500 leading-snug">
              Department of Emergency Medicine
            </div>
            <div className="mt-2 font-mono text-[10px] text-zinc-500">
              Refreshed {refreshed}
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function MobileBrand() {
  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex items-center rounded-md bg-white px-2 py-1 ring-1 ring-black/5">
        <img
          src={ufhLogo}
          alt="UF Health Emergency Services"
          className="h-6 w-auto"
        />
      </div>
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-400">
        Clinical
      </span>
    </div>
  );
}

export function Shell() {
  return (
    <SidebarLayout
      sidebar={<SidebarContents />}
      navbar={<MobileBrand />}
    >
      <div className="animate-fade-up">
        <Outlet />
      </div>
    </SidebarLayout>
  );
}
