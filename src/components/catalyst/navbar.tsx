/**
 * Catalyst navbar primitives adapted for zero-dep, dark-mode UF ED dashboard.
 * Mirrors upstream exports (Navbar, NavbarDivider, NavbarSection, NavbarSpacer,
 * NavbarItem, NavbarLabel) minus the motion-driven underline indicator.
 */
import clsx from "clsx";
import React, { forwardRef } from "react";
import { Link } from "./link";

export function Navbar({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"nav">) {
  return (
    <nav
      {...props}
      className={clsx(className, "flex flex-1 items-center gap-4 py-2.5")}
    />
  );
}

export function NavbarDivider({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      aria-hidden="true"
      {...props}
      className={clsx(className, "h-6 w-px bg-white/10")}
    />
  );
}

export function NavbarSection({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div {...props} className={clsx(className, "flex items-center gap-3")} />
  );
}

export function NavbarSpacer({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      aria-hidden="true"
      {...props}
      className={clsx(className, "-ml-4 flex-1")}
    />
  );
}

type NavbarItemBaseProps = {
  current?: boolean;
  className?: string;
  children: React.ReactNode;
};

type NavbarItemAsButton = NavbarItemBaseProps & {
  href?: never;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

type NavbarItemAsLink = NavbarItemBaseProps & {
  href: string;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">;

export const NavbarItem = forwardRef<
  HTMLAnchorElement | HTMLButtonElement,
  NavbarItemAsButton | NavbarItemAsLink
>(function NavbarItem({ current, className, children, ...props }, ref) {
  const classes = clsx(
    "relative flex min-w-0 items-center gap-3 rounded-lg p-2 text-left text-sm/5 font-medium",
    "text-zinc-300 hover:bg-white/5 hover:text-zinc-100",
    "*:data-[slot=icon]:size-5 *:data-[slot=icon]:shrink-0 *:data-[slot=icon]:fill-zinc-400",
    "hover:*:data-[slot=icon]:fill-zinc-100",
    "data-[current=true]:bg-white/5 data-[current=true]:text-zinc-100",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uf-blue"
  );

  if (typeof (props as { href?: string }).href === "string") {
    const { href, ...rest } = props as NavbarItemAsLink;
    return (
      <span className={clsx(className, "relative")}>
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
      <button
        {...(props as NavbarItemAsButton)}
        ref={ref as React.ForwardedRef<HTMLButtonElement>}
        className={classes}
        data-current={current ? "true" : undefined}
      >
        {children}
      </button>
    </span>
  );
});

export function NavbarLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"span">) {
  return <span {...props} className={clsx(className, "truncate")} />;
}
