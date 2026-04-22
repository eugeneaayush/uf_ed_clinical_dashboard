/**
 * Catalyst table adapted for dark-mode. Public API mirrors upstream
 * (Table / TableHead / TableBody / TableRow / TableHeader / TableCell) and
 * supports the same `bleed` / `dense` / `grid` / `striped` Table options.
 *
 * Row-level `href` uses an overlaid react-router-aware Link instead of
 * Headless's Data* primitive.
 */
import clsx from "clsx";
import React, { createContext, useContext, useState } from "react";
import { Link } from "./link";

const TableContext = createContext<{
  bleed: boolean;
  dense: boolean;
  grid: boolean;
  striped: boolean;
}>({ bleed: false, dense: false, grid: false, striped: false });

export function Table({
  bleed = false,
  dense = false,
  grid = false,
  striped = false,
  className,
  children,
  ...props
}: {
  bleed?: boolean;
  dense?: boolean;
  grid?: boolean;
  striped?: boolean;
} & React.ComponentPropsWithoutRef<"div">) {
  return (
    <TableContext.Provider value={{ bleed, dense, grid, striped }}>
      <div className="flow-root">
        <div
          {...props}
          className={clsx(className, "-mx-4 overflow-x-auto whitespace-nowrap")}
        >
          <div
            className={clsx(
              "inline-block min-w-full align-middle",
              !bleed && "sm:px-4"
            )}
          >
            <table className="min-w-full text-left text-sm/6 text-zinc-100">
              {children}
            </table>
          </div>
        </div>
      </div>
    </TableContext.Provider>
  );
}

export function TableHead({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"thead">) {
  return (
    <thead
      {...props}
      className={clsx(
        className,
        "font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500"
      )}
    />
  );
}

export function TableBody(props: React.ComponentPropsWithoutRef<"tbody">) {
  return <tbody {...props} />;
}

const TableRowContext = createContext<{
  href?: string;
  target?: string;
  title?: string;
}>({ href: undefined, target: undefined, title: undefined });

export function TableRow({
  href,
  target,
  title,
  className,
  ...props
}: {
  href?: string;
  target?: string;
  title?: string;
} & React.ComponentPropsWithoutRef<"tr">) {
  const { striped } = useContext(TableContext);
  return (
    <TableRowContext.Provider value={{ href, target, title }}>
      <tr
        {...props}
        className={clsx(
          className,
          striped && "even:bg-white/[0.02]",
          href && "hover:bg-white/[0.04]"
        )}
      />
    </TableRowContext.Provider>
  );
}

export function TableHeader({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"th">) {
  const { bleed, grid } = useContext(TableContext);
  return (
    <th
      {...props}
      className={clsx(
        className,
        "border-b border-white/10 px-4 py-2 font-medium",
        grid && "border-l border-white/5 first:border-l-0",
        !bleed && "sm:first:pl-1 sm:last:pr-1"
      )}
    />
  );
}

export function TableCell({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"td">) {
  const { bleed, dense, grid, striped } = useContext(TableContext);
  const { href, target, title } = useContext(TableRowContext);
  const [cellRef, setCellRef] = useState<HTMLElement | null>(null);

  return (
    <td
      ref={href ? setCellRef : undefined}
      {...props}
      className={clsx(
        className,
        "relative px-4",
        !striped && "border-b border-white/5",
        grid && "border-l border-white/5 first:border-l-0",
        dense ? "py-2.5" : "py-4",
        !bleed && "sm:first:pl-1 sm:last:pr-1"
      )}
    >
      {href && (
        <Link
          href={href}
          target={target}
          aria-label={title}
          tabIndex={cellRef?.previousElementSibling === null ? 0 : -1}
          className="absolute inset-0 focus:outline-none"
        />
      )}
      {children}
    </td>
  );
}
