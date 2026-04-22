import clsx from "clsx";
import React from "react";

export function Divider({
  soft = false,
  className,
  ...props
}: { soft?: boolean } & React.ComponentPropsWithoutRef<"hr">) {
  return (
    <hr
      role="presentation"
      {...props}
      className={clsx(
        className,
        "w-full border-t",
        soft ? "border-white/5" : "border-white/10"
      )}
    />
  );
}
