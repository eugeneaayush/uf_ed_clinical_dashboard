import clsx from "clsx";

export function LoadingDots({ className }: { className?: string }) {
  return (
    <div className={clsx("flex items-center justify-center py-16", className)}>
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-blue-400 animate-pulse"
            style={{ animationDelay: `${i * 0.18}s` }}
          />
        ))}
      </div>
    </div>
  );
}

export function ErrorState({ error }: { error: Error }) {
  return (
    <div className="tile p-8 text-center">
      <div className="font-display text-[16px] font-bold text-zinc-100">
        Couldn’t load data
      </div>
      <div className="mt-2 text-[13px] text-zinc-400">{error.message}</div>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-[13px] text-zinc-500">
      {message}
    </div>
  );
}

/**
 * Numbered page section header — template "01 / Programs & Training" pattern,
 * toned for the dark canvas.
 */
export function PageHeader({
  num,
  kicker,
  title,
  subtitle,
}: {
  num: string;
  kicker: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="mb-8 md:mb-10">
      <div className="section-tag">
        <span className="section-tag-num">{num}</span>
        <span aria-hidden className="h-3 w-px bg-uf-blue/40" />
        <span>{kicker}</span>
      </div>
      <h2 className="mt-5 font-display text-[34px] md:text-[44px] font-extrabold leading-[1.02] tracking-tighter text-zinc-100 max-w-3xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-3 text-[14px] text-zinc-400 max-w-2xl leading-relaxed">
          {subtitle}
        </p>
      )}
    </header>
  );
}
