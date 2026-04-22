import clsx from "clsx";
import React from "react";
import { Link } from "./link";

export function Text({ className, ...props }: React.ComponentPropsWithoutRef<"p">) {
  return (
    <p
      data-slot="text"
      {...props}
      className={clsx(className, "text-base/6 text-zinc-400 sm:text-sm/6")}
    />
  );
}

export function TextLink({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Link>) {
  return (
    <Link
      {...props}
      className={clsx(
        className,
        "text-zinc-100 underline decoration-zinc-600 hover:decoration-zinc-200"
      )}
    />
  );
}

export function Strong({ className, ...props }: React.ComponentPropsWithoutRef<"strong">) {
  return (
    <strong {...props} className={clsx(className, "font-medium text-zinc-100")} />
  );
}

export function Code({ className, ...props }: React.ComponentPropsWithoutRef<"code">) {
  return (
    <code
      {...props}
      className={clsx(
        className,
        "rounded-sm border border-white/15 bg-white/5 px-0.5 font-mono text-[0.8125rem] font-medium text-zinc-100"
      )}
    />
  );
}
