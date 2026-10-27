"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import quotes from "@/data/quotes.json";

type Quote = {
  quote: string;
  author: string | null;
  translation: string;
};

const QUOTES = quotes as Quote[];

const subscribe = () => () => {};
let cache: { path: string; index: number } | null = null;

/** Her sayfa yüklemesinde ve sayfa geçişinde rastgele söz (yalnızca istemcide). */
function pickFor(path: string): number {
  if (cache?.path === path) return cache.index;
  let next = Math.floor(Math.random() * QUOTES.length);
  if (cache && next === cache.index && QUOTES.length > 1) {
    next = (next + 1) % QUOTES.length;
  }
  cache = { path, index: next };
  return next;
}

export default function HeaderQuote({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const index = useSyncExternalStore(
    subscribe,
    () => pickFor(pathname),
    () => null,
  );
  const q = index === null ? null : QUOTES[index];

  return (
    <figure
      className={["min-w-0 leading-tight", className].join(" ")}
      aria-label="Günün sözü"
    >
      {q ? (
        <>
          <blockquote className="truncate text-xs font-semibold text-panel-fg sm:text-[13px]">
            &ldquo;{q.quote}&rdquo;
          </blockquote>
          <figcaption className="mt-0.5 flex min-w-0 items-baseline gap-1.5 text-[11px] text-panel-fg-secondary">
            {q.author ? (
              <cite className="shrink-0 not-italic font-semibold text-panel-fg">
                — {q.author}
              </cite>
            ) : null}
            <span className="truncate italic">({q.translation})</span>
          </figcaption>
        </>
      ) : (
        <span className="block h-8" aria-hidden />
      )}
    </figure>
  );
}
