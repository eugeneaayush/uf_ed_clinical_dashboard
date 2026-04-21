import { useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { useCallback } from "react";

export interface TabDef {
  id: string;
  label: string;
  num: string;
  hint?: string;
}

interface TabsProps {
  tabs: TabDef[];
  paramName?: string;
  defaultId?: string;
}

export function Tabs({ tabs, paramName = "tab", defaultId }: TabsProps) {
  const [sp, setSp] = useSearchParams();
  const active = sp.get(paramName) ?? defaultId ?? tabs[0]?.id;

  const setActive = useCallback(
    (id: string) => {
      const next = new URLSearchParams(sp);
      if (id === (defaultId ?? tabs[0]?.id)) next.delete(paramName);
      else next.set(paramName, id);
      setSp(next, { replace: true });
    },
    [sp, setSp, paramName, defaultId, tabs]
  );

  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-0 border-b border-slate-200">
        {tabs.map((t) => {
          const isActive = t.id === current?.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className={clsx(
                "flex items-center gap-3 px-4 py-3 text-[13px] font-medium transition-colors border-b-2",
                isActive
                  ? "text-slate-900 border-uf-blue"
                  : "text-slate-500 border-transparent hover:text-slate-900"
              )}
            >
              <span
                className={clsx(
                  "font-mono text-[11px]",
                  isActive ? "text-uf-blue" : "text-slate-400"
                )}
              >
                {t.num}
              </span>
              <span className="whitespace-nowrap">{t.label}</span>
            </button>
          );
        })}
      </div>
      {current?.hint && (
        <p className="mt-3 text-[12px] text-slate-500">{current.hint}</p>
      )}
    </div>
  );
}

/** Read the active tab id from the URL without rendering. */
export function useActiveTab(
  tabs: TabDef[],
  paramName = "tab",
  defaultId?: string
): string {
  const [sp] = useSearchParams();
  const raw = sp.get(paramName);
  if (raw && tabs.some((t) => t.id === raw)) return raw;
  return defaultId ?? tabs[0]?.id ?? "";
}
