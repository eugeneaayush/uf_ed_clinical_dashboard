import clsx from "clsx";
import React from "react";

const colors = {
  red: "bg-red-500/10 text-red-400 ring-1 ring-red-500/30",
  orange: "bg-uf-orange/10 text-uf-orange ring-1 ring-uf-orange/30",
  amber: "bg-amber-400/10 text-amber-400 ring-1 ring-amber-400/30",
  yellow: "bg-yellow-400/10 text-yellow-300 ring-1 ring-yellow-400/30",
  lime: "bg-lime-400/10 text-lime-300 ring-1 ring-lime-400/30",
  green: "bg-green-500/10 text-green-400 ring-1 ring-green-500/30",
  emerald: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30",
  teal: "bg-teal-500/10 text-teal-300 ring-1 ring-teal-500/30",
  cyan: "bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-400/30",
  sky: "bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/30",
  blue: "bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/30",
  indigo: "bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/30",
  violet: "bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/30",
  purple: "bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/30",
  fuchsia: "bg-fuchsia-400/10 text-fuchsia-400 ring-1 ring-fuchsia-400/30",
  pink: "bg-pink-400/10 text-pink-400 ring-1 ring-pink-400/30",
  rose: "bg-rose-400/10 text-rose-400 ring-1 ring-rose-400/30",
  zinc: "bg-white/5 text-zinc-300 ring-1 ring-white/10",
};

type BadgeProps = { color?: keyof typeof colors };

export function Badge({
  color = "zinc",
  className,
  ...props
}: BadgeProps & React.ComponentPropsWithoutRef<"span">) {
  return (
    <span
      {...props}
      className={clsx(
        className,
        "inline-flex items-center gap-x-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium",
        colors[color]
      )}
    />
  );
}
