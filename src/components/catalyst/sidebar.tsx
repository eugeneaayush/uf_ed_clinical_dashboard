/**
 * Catalyst sidebar primitives adapted for the UF ED Dashboard.
 *
 * Upstream Catalyst uses Headless UI for data attribute hooks and Framer Motion
 * for the sliding "current" indicator. We use plain hover/focus variants and
 * render the current-item accent as a static bar so no new deps are needed.
 *
 * Exported primitives keep the same names as upstream so the page-worker
 * branches (and future Catalyst upgrades) can drop back in with minimal diff.
 */
import clsx from "clsx";
import React, { forwardRef } from "react";
import { Link } from "./link";

export function Sidebar({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"nav">) {
  return (
    <nav
      {...props}
      className={clsx(className, "flex h-full min-h-0 flex-col")}
    />
  );
}

export function SidebarHeader({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...props}
      className={clsx(
        className,
        "flex flex-col border-b border-white/5 p-4 [&>[data-slot=section]+[data-slot=section]]:mt-2.5"
      )}
    />
  );
}

export function SidebarBody({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...props}
      className={clsx(
        className,
        "flex flex-1 flex-col overflow-y-auto p-4 [&>[data-slot=section]+[data-slot=section]]:mt-8"
      )}
    />
  );
}

export function SidebarFooter({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...props}
      className={clsx(
        className,
        "flex flex-col border-t border-white/5 p-4 [&>[data-slot=section]+[data-slot=section]]:mt-2.5"
      )}
    />
  );
}

export function SidebarSection({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...props}
      data-slot="section"
      className={clsx(className, "flex flex-col gap-0.5")}
    />
  );
}

export function SidebarDivider({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"hr">) {
  return (
    <hr
      {...props}
      className={clsx(className, "my-4 border-t border-white/5 lg:-mx-4")}
    />
  );
}

export function SidebarSpacer({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      aria-hidden="true"
      {...props}
      className={clsx(className, "mt-8 flex-1")}
    />
  );
}

export function SidebarHeading({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"h3">) {
  return (
    <h3
      {...props}
      className={clsx(
        className,
        "mb-1 px-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500"
      )}
    />
  );
}

type SidebarItemBaseProps = {
  current?: boolean;
  className?: string;
  children: React.ReactNode;
};

type SidebarItemAsButton = SidebarItemBaseProps & {
  href?: never;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

type SidebarItemAsLink = SidebarItemBaseProps & {
  href: string;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">;

export const SidebarItem = forwardRef<
  HTMLAnchorElement | HTMLButtonElement,
  SidebarItemAsButton | SidebarItemAsLink
>(function SidebarItem({ current, className, children, ...props }, ref) {
  const classes = clsx(
    // Base
    "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm/5 font-medium transition-colors",
    "text-zinc-300",
    // Leading icons
    "*:data-[slot=icon]:size-5 *:data-[slot=icon]:shrink-0 *:data-[slot=icon]:fill-zinc-400",
    // Hover
    "hover:bg-white/5 hover:text-zinc-100 hover:*:data-[slot=icon]:fill-zinc-100",
    // Current
    "data-[current=true]:bg-white/5 data-[current=true]:text-zinc-100",
    "data-[current=true]:*:data-[slot=icon]:fill-zinc-100",
    // Focus
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uf-blue"
  );

  if (typeof (props as { href?: string }).href === "string") {
    const { href, ...rest } = props as SidebarItemAsLink;
    return (
      <span className={clsx(className, "relative")}>
        {current && (
          <span
            aria-hidden="true"
            className="absolute inset-y-2 -left-4 w-0.5 rounded-full bg-uf-blue"
          />
        )}
        <Link
          href={href}
          {...rest}
          className={classes}
          data-current={current ? "true" : undefined}
          ref={ref as React.ForwardedRef<HTMLAnchorElement>}
        >
          {children}
        </Link>
      </span>
    );
  }

  return (
    <span className={clsx(className, "relative")}>
      {current && (
        <span
          aria-hidden="true"
          className="absolute inset-y-2 -left-4 w-0.5 rounded-full bg-uf-blue"
        />
      )}
      <button
        {...(props as SidebarItemAsButton)}
        ref={ref as React.ForwardedRef<HTMLButtonElement>}
        className={classes}
        data-current={current ? "true" : undefined}
      >
        {children}
      </button>
    </span>
  );
});

export function SidebarLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"span">) {
  return <span {...props} className={clsx(className, "truncate")} />;
}
