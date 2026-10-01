"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  failPeriodNav,
  normalizeHref,
  startPeriodNav,
  usePeriodNavState,
} from "./store";

/**
 * Zaman filtresi düğmeleri için ortak navigasyon: tıklanan kontrolü,
 * yükleme / yavaş / hata durumunu döndürür.
 */
export function usePeriodNavigation() {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const nav = usePeriodNavState();

  const busy = pending || nav.status === "loading" || nav.status === "slow";

  function navigate(href: string, opts: { key: string; label: string }) {
    const qs = searchParams.toString();
    const current = qs ? `${pathname}?${qs}` : pathname;
    if (normalizeHref(href) === normalizeHref(current)) return;

    startPeriodNav({ href, key: opts.key, label: opts.label, fromPath: pathname });
    startTransition(() => {
      try {
        router.push(href, { scroll: false });
      } catch {
        failPeriodNav();
      }
    });
  }

  return {
    navigate,
    busy,
    status: nav.status,
    activeKey: busy || nav.status === "error" ? nav.key : null,
    label: nav.label,
  };
}
