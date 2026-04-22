import clsx from "clsx";
import type { ReactNode } from "react";

interface CardProps {
  /** Mono number tag, e.g. "01" */
  num?: string;
  title?: string;
  sub?: string;
  right?: ReactNode;
  className?: string;
  children: ReactNode;
  /** Remove internal padding (for charts that need edge-to-edge) */
  flush?: boolean;
}

/**
 * Card primitive for the dashboard — a zinc-900 surface with a hairline ring
 * and the mono-numbered "01 / Title" header treatment carried over from the
 * original template, now tuned for dark canvas.
 */
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
        "tile animate-fade-up transition-colors hover:ring-zinc-700 hover:bg-zinc-900/80",
        className
      )}
    >
      {(title || num || right) && (
        <header className="tile-header">
          <div className="flex items-start gap-4 min-w-0">
            {num && (
              <span
                aria-hidden
                className="font-mono text-[12px] text-blue-400 pt-0.5 shrink-0"
              >
                {num}
              </span>
            )}
            <div className="min-w-0">
              {title && (
                <h3 className="font-display font-bold text-[14px] text-zinc-100 tracking-tight leading-tight">
                  {title}
                </h3>
              )}
              {sub && (
                <p className="mt-0.5 text-[12px] text-zinc-400 leading-snug">
                  {sub}
                </p>
              )}
            </div>
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </header>
      )}
      <div className={clsx(!flush && "tile-body")}>{children}</div>
    </section>
  );
}
