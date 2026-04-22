/**
 * Minimal dropdown adapted for the UF ED dashboard.
 *
 * Upstream Catalyst relies on Headless UI's `Menu` for accessibility and
 * transitions. Since Headless UI isn't a dep here, we provide a thin context
 * + hook that handles open/close, escape, and click-outside. Public primitives
 * (`Dropdown`, `DropdownButton`, `DropdownMenu`, `DropdownItem`,
 * `DropdownDivider`, `DropdownLabel`) keep the same names so consumers can
 * drop back onto the Catalyst implementation later.
 */
import clsx from "clsx";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "./link";

type Ctx = {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  rootRef: React.RefObject<HTMLDivElement>;
};

const DropdownCtx = createContext<Ctx | null>(null);

function useDropdown(): Ctx {
  const ctx = useContext(DropdownCtx);
  if (!ctx) {
    throw new Error("Dropdown primitives must be used inside <Dropdown>");
  }
  return ctx;
}

export function Dropdown({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const value = useMemo(() => ({ open, setOpen, toggle, rootRef }), [open, toggle]);

  return (
    <DropdownCtx.Provider value={value}>
      <div ref={rootRef} className="relative inline-block">
        {children}
      </div>
    </DropdownCtx.Provider>
  );
}

export function DropdownButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { toggle, open } = useDropdown();
  return (
    <button
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={toggle}
      {...props}
      className={clsx(
        className,
        "inline-flex items-center gap-x-2 rounded-lg border border-white/15 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-100 hover:bg-zinc-800"
      )}
    >
      {children}
    </button>
  );
}

export function DropdownMenu({
  anchor = "bottom start",
  className,
  children,
}: {
  anchor?: "bottom" | "bottom start" | "bottom end" | "top" | "top start" | "top end";
  className?: string;
  children: React.ReactNode;
}) {
  const { open } = useDropdown();
  if (!open) return null;
  const anchorClasses = clsx(
    "absolute z-40 mt-2 min-w-[14rem]",
    anchor.includes("end") ? "right-0" : "left-0",
    anchor.startsWith("top") && "bottom-full mb-2 mt-0"
  );
  return (
    <div
      role="menu"
      className={clsx(
        anchorClasses,
        "rounded-xl p-1",
        "bg-zinc-900/95 backdrop-blur-md ring-1 ring-white/10 shadow-lg",
        className
      )}
    >
      {children}
    </div>
  );
}

type DropdownItemBase = { className?: string; children: React.ReactNode };
type DropdownItemAsButton = DropdownItemBase & {
  href?: never;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;
type DropdownItemAsLink = DropdownItemBase & {
  href: string;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">;

export function DropdownItem(props: DropdownItemAsButton | DropdownItemAsLink) {
  const { setOpen } = useDropdown();
  const classes = clsx(
    "block w-full rounded-lg px-3 py-1.5 text-left text-sm text-zinc-200",
    "hover:bg-white/5 hover:text-zinc-100",
    "focus-visible:bg-white/10 focus-visible:outline-none",
    props.className
  );
  if (typeof (props as DropdownItemAsLink).href === "string") {
    const { href, className: _omit, ...rest } = props as DropdownItemAsLink;
    void _omit;
    return (
      <Link
        href={href}
        {...rest}
        className={classes}
        role="menuitem"
        onClick={(e) => {
          rest.onClick?.(e);
          setOpen(false);
        }}
      />
    );
  }
  const { className: _omit, onClick, ...btn } = props as DropdownItemAsButton;
  void _omit;
  return (
    <button
      type="button"
      role="menuitem"
      {...btn}
      className={classes}
      onClick={(e) => {
        onClick?.(e);
        setOpen(false);
      }}
    />
  );
}

export function DropdownDivider({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"hr">) {
  return (
    <hr
      role="presentation"
      {...props}
      className={clsx(className, "mx-3 my-1 border-t border-white/10")}
    />
  );
}

export function DropdownLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...props}
      data-slot="label"
      className={clsx(className, "px-3 pb-1 pt-2 text-xs font-medium text-zinc-500")}
    />
  );
}
