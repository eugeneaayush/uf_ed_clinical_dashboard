/**
 * Catalyst `SidebarLayout`, adapted for UF ED dashboard dark-mode.
 *
 * Instead of depending on Headless UI's `Dialog`, we implement a simple
 * custom mobile overlay with a backdrop + panel that slides in. The panel
 * closes on backdrop click, escape key, or explicit close call.
 */
import React, { useEffect, useState } from "react";

function OpenMenuIcon() {
  return (
    <svg
      data-slot="icon"
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="size-5"
    >
      <path
        fill="currentColor"
        d="M2 6.75C2 6.33579 2.33579 6 2.75 6H17.25C17.6642 6 18 6.33579 18 6.75C18 7.16421 17.6642 7.5 17.25 7.5H2.75C2.33579 7.5 2 7.16421 2 6.75ZM2 13.25C2 12.8358 2.33579 12.5 2.75 12.5H17.25C17.6642 12.5 18 12.8358 18 13.25C18 13.6642 17.6642 14 17.25 14H2.75C2.33579 14 2 13.6642 2 13.25Z"
      />
    </svg>
  );
}

function CloseMenuIcon() {
  return (
    <svg
      data-slot="icon"
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="size-5"
    >
      <path
        fill="currentColor"
        d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"
      />
    </svg>
  );
}

function MobileSidebar({
  open,
  close,
  children,
}: React.PropsWithChildren<{ open: boolean; close: () => void }>) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = original;
    };
  }, [open, close]);

  if (!open) return null;

  return (
    <div className="lg:hidden" role="dialog" aria-modal="true">
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={close}
        aria-hidden="true"
      />
      <div className="fixed inset-y-0 left-0 z-50 w-full max-w-80 p-2">
        <div className="flex h-full flex-col rounded-lg bg-zinc-900 shadow-xl ring-1 ring-white/10">
          <div className="-mb-3 flex px-4 pt-3">
            <button
              type="button"
              onClick={close}
              aria-label="Close navigation"
              className="flex items-center justify-center rounded-lg p-2 text-zinc-300 hover:bg-white/5 hover:text-zinc-100"
            >
              <CloseMenuIcon />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function SidebarLayout({
  navbar,
  sidebar,
  children,
}: React.PropsWithChildren<{
  navbar?: React.ReactNode;
  sidebar: React.ReactNode;
}>) {
  const [showSidebar, setShowSidebar] = useState(false);

  return (
    <div className="relative isolate flex min-h-svh w-full bg-zinc-950 text-zinc-100 max-lg:flex-col">
      {/* Sidebar on desktop */}
      <div className="fixed inset-y-0 left-0 w-64 border-r border-white/5 bg-zinc-950 max-lg:hidden">
        {sidebar}
      </div>

      {/* Sidebar on mobile (collapsible overlay) */}
      <MobileSidebar
        open={showSidebar}
        close={() => setShowSidebar(false)}
      >
        {sidebar}
      </MobileSidebar>

      {/* Top bar on mobile */}
      <header className="flex items-center border-b border-white/5 bg-zinc-950 px-4 lg:hidden">
        <div className="py-2.5">
          <button
            type="button"
            onClick={() => setShowSidebar(true)}
            aria-label="Open navigation"
            className="flex items-center justify-center rounded-lg p-2 text-zinc-300 hover:bg-white/5 hover:text-zinc-100"
          >
            <OpenMenuIcon />
          </button>
        </div>
        <div className="min-w-0 flex-1">{navbar}</div>
      </header>

      {/* Content canvas */}
      <main className="flex flex-1 flex-col lg:min-w-0 lg:pl-64">
        <div className="grow px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto max-w-[1600px]">{children}</div>
        </div>
      </main>
    </div>
  );
}
