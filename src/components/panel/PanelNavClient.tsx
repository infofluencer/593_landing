"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const PERIOD_KEYS = ["period", "start", "end"] as const;

export default function PanelNavClient({
  items,
}: {
  items: { href: string; label: string }[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const periodQs = (() => {
    const q = new URLSearchParams();
    for (const k of PERIOD_KEYS) {
      const v = searchParams.get(k);
      if (v) q.set(k, v);
    }
    const s = q.toString();
    return s ? `?${s}` : "";
  })();

  return (
    <>
      {items.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/" || pathname === "/panel"
            : pathname === item.href ||
              pathname === `/panel${item.href}` ||
              pathname.startsWith(`${item.href}/`);

        const href =
          item.href === "/" ||
          item.href === "/meta" ||
          item.href === "/google"
            ? `${item.href}${periodQs}`
            : item.href;

        return (
          <Link
            key={item.href}
            href={href}
            className={[
              "shrink-0 rounded-md px-3 py-2 text-sm transition",
              active
                ? "bg-zinc-900 font-medium text-white"
                : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800",
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
