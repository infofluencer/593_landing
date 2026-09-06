"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function PanelNavClient({
  items,
}: {
  items: { href: string; label: string }[];
}) {
  const pathname = usePathname();

  return (
    <>
      {items.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/" || pathname === "/panel"
            : pathname === item.href ||
              pathname === `/panel${item.href}` ||
              pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
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
