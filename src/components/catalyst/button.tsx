/**
 * Catalyst `Button` simplified for the UF ED Dashboard dark-mode redesign.
 *
 * The upstream version uses Headless UI's button + data-* attribute hooks;
 * we keep the same prop surface but use native `<button>` / internal `Link`
 * instead, with plain hover/focus Tailwind variants. Only the variants we
 * actually use (`solid` default, `outline`, `plain`) are included to stay
 * tight on bundle size.
 */
import clsx from "clsx";
import React, { forwardRef } from "react";
import { Link } from "./link";

const styles = {
  base: [
    "relative inline-flex items-center justify-center gap-x-2 rounded-lg border text-sm font-semibold",
    "px-3 py-1.5",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uf-blue",
    "disabled:opacity-50",
  ],
  solid: [
    "border-zinc-700 bg-zinc-800 text-zinc-100 shadow-sm",
    "hover:bg-zinc-700 hover:border-zinc-600",
  ],
  outline: [
    "border-white/15 bg-transparent text-zinc-100",
    "hover:bg-white/5 hover:border-white/25",
  ],
  plain: [
    "border-transparent bg-transparent text-zinc-100",
    "hover:bg-white/5",
  ],
};

type Variant = "solid" | "outline" | "plain";

type CommonProps = {
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
};

type ButtonAsButton = CommonProps & { href?: never } & React.ButtonHTMLAttributes<HTMLButtonElement>;
type ButtonAsLink = CommonProps & { href: string } & Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
>;

export const Button = forwardRef<HTMLElement, ButtonAsButton | ButtonAsLink>(
  function Button({ variant = "solid", className, children, ...props }, ref) {
    const classes = clsx(styles.base, styles[variant], className);
    if (typeof (props as { href?: string }).href === "string") {
      const { href, ...rest } = props as ButtonAsLink;
      return (
        <Link
          href={href}
          {...rest}
          className={classes}
          ref={ref as React.ForwardedRef<HTMLAnchorElement>}
        >
          {children}
        </Link>
      );
    }
    return (
      <button
        {...(props as ButtonAsButton)}
        ref={ref as React.ForwardedRef<HTMLButtonElement>}
        className={classes}
      >
        {children}
      </button>
    );
  }
);

/**
 * Expands the hit area to at least 44x44 on touch devices. Kept as a passthrough
 * so downstream sidebar/navbar items can nest an invisible touch target.
 */
export function TouchTarget({ children }: { children: React.ReactNode }) {
  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 size-[max(100%,2.75rem)] -translate-x-1/2 -translate-y-1/2 [@media(pointer:fine)]:hidden"
      />
      {children}
    </>
  );
}
