import clsx from "clsx";
import type { ReactNode } from "react";
import { Heading } from "./catalyst/heading";
import { Text } from "./catalyst/text";
import { Badge } from "./catalyst/badge";

interface CardProps {
  num?: string;
  title?: string;
  sub?: string;
  right?: ReactNode;
  className?: string;
  children: ReactNode;
  flush?: boolean;
}

export function Card({
  num,
  title,
  sub,
  right,
  className,
  children,
  flush = false,
}: CardProps) {
  return (
    <section 
      className={clsx(
        "flex flex-col bg-white dark:bg-zinc-900 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10 rounded-xl overflow-hidden",
        className
      )}
    >
      {(title || num || right) && (
        <header className="flex items-start justify-between border-b border-zinc-950/5 dark:border-white/10 px-5 py-4 bg-zinc-50/50 dark:bg-white/[0.02]">
          <div className="flex items-start gap-4 min-w-0">
            {num && (
              <Badge color="zinc" className="mt-0.5">
                {num}
              </Badge>
            )}
            <div className="min-w-0">
              {title && (
                <Heading level={3} className="!text-base">
                  {title}
                </Heading>
              )}
              {sub && (
                <Text className="mt-1 !text-xs leading-snug">
                  {sub}
                </Text>
              )}
            </div>
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </header>
      )}
      <div className={clsx(!flush && "p-5", "flex-1")}>{children}</div>
    </section>
  );
}
