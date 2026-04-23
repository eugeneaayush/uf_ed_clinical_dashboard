import clsx from "clsx";
import { Heading } from "./catalyst/heading";
import { Text } from "./catalyst/text";
import { Badge } from "./catalyst/badge";

export function LoadingDots({ className }: { className?: string }) {
  return (
    <div className={clsx("flex items-center justify-center py-16", className)}>
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse"
            style={{ animationDelay: `${i * 0.18}s` }}
          />
        ))}
      </div>
    </div>
  );
}

export function ErrorState({ error }: { error: Error }) {
  return (
    <div className="bg-white dark:bg-white shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10 rounded-xl p-8 text-center max-w-lg mx-auto mt-12">
      <Heading className="!text-lg text-red-600">Couldn’t load data</Heading>
      <Text className="mt-2">{error.message}</Text>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-zinc-500">
      {message}
    </div>
  );
}

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
      <div className="flex items-center gap-3">
        <Badge color="indigo" className="font-mono">{num}</Badge>
        <span aria-hidden className="h-3 w-px bg-zinc-300 dark:bg-zinc-700" />
        <Text className="font-medium !text-indigo-600 dark:!text-indigo-400">{kicker}</Text>
      </div>
      <Heading level={1} className="mt-5 !text-3xl md:!text-4xl !tracking-tight max-w-3xl">
        {title}
      </Heading>
      {subtitle && (
        <Text className="mt-3 max-w-2xl text-base leading-relaxed">
          {subtitle}
        </Text>
      )}
    </header>
  );
}
