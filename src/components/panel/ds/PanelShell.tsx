"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react";
import {
  Building2,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Palette,
  Receipt,
  Settings,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { BrandNavIcon, isBrandNavHref } from "./BrandMarks";
import type { PanelNavLink } from "./nav-config";

const PERIOD_KEYS = ["period", "start", "end", "compare"] as const;

const NAV_ICONS: Record<string, LucideIcon> = {
  "/": LayoutDashboard,
  "/budget": Receipt,
  "/faturalar": Receipt,
  "/brands": Building2,
  "/board": ClipboardList,
  "/ekip": Users,
  "/settings": Settings,
  "/design": Palette,
};

function iconFor(href: string): LucideIcon {
  return NAV_ICONS[href] ?? LayoutDashboard;
}

type ShellProps = {
  variant: "staff" | "tenant";
  nav: PanelNavLink[];
  pageTitle: string;
  brandName?: string;
  brandTypeLabel?: string;
  userEmail: string;
  userRoleLabel: string;
  topBarExtra?: ReactNode;
  children: ReactNode;
};

export default function PanelShell({
  variant,
  nav,
  pageTitle,
  brandName,
  brandTypeLabel,
  userEmail,
  userRoleLabel,
  topBarExtra,
  children,
}: ShellProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const drawerId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    document.documentElement.classList.add("panel-drawer-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("panel-drawer-open");
    };
  }, [open, close]);

  return (
    <div className="panel-root flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-[var(--panel-sidebar-w)] shrink-0 flex-col border-r border-panel-border bg-panel-surface lg:flex">
        <div className="flex h-full min-h-0 flex-col">
          <SidebarChrome
            variant={variant}
            nav={nav}
            brandName={brandName}
            brandTypeLabel={brandTypeLabel}
            userEmail={userEmail}
            userRoleLabel={userRoleLabel}
          />
        </div>
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
          <button
            type="button"
            aria-label="Menüyü kapat"
            className="absolute inset-0 bg-panel-fg/40"
            onClick={close}
          />
          <aside
            id={drawerId}
            className="absolute inset-y-0 left-0 flex w-[min(var(--panel-sidebar-w),88vw)] flex-col border-r border-panel-border bg-panel-surface shadow-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Navigasyon"
          >
            <div className="flex shrink-0 items-center justify-end border-b border-panel-border px-3 py-2">
              <button
                type="button"
                onClick={close}
                className="rounded-panel-btn p-2 text-panel-fg-secondary hover:bg-panel-surface-muted hover:text-panel-fg"
                aria-label="Kapat"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              <SidebarChrome
                variant={variant}
                nav={nav}
                brandName={brandName}
                brandTypeLabel={brandTypeLabel}
                userEmail={userEmail}
                userRoleLabel={userRoleLabel}
              />
            </div>
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-panel-border bg-panel-surface/95 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
          <button
            type="button"
            className="rounded-panel-btn p-2 text-panel-fg-secondary hover:bg-panel-surface-muted hover:text-panel-fg lg:hidden"
            aria-expanded={open}
            aria-controls={drawerId}
            onClick={() => setOpen(true)}
          >
            <Menu className="size-5" aria-hidden />
            <span className="sr-only">Menü</span>
          </button>
          <div className="mr-auto min-w-0">
            <p className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-panel-fg-muted sm:block">
              {variant === "staff" ? "Ajans paneli" : "Marka paneli"}
            </p>
            <h1 className="truncate text-sm font-semibold text-panel-fg sm:text-base">
              {pageTitle}
            </h1>
          </div>
          {topBarExtra ? (
            <div className="hidden items-center gap-2 md:flex">{topBarExtra}</div>
          ) : null}
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mx-auto w-full max-w-[var(--panel-content-max)] space-y-6 sm:space-y-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarChrome({
  variant,
  nav,
  brandName,
  brandTypeLabel,
  userEmail,
  userRoleLabel,
}: {
  variant: "staff" | "tenant";
  nav: PanelNavLink[];
  brandName?: string;
  brandTypeLabel?: string;
  userEmail: string;
  userRoleLabel: string;
}) {
  return (
    <>
      <div className="border-b border-panel-border px-5 py-5">
        {variant === "staff" ? (
          <div>
            <p className="font-logo text-lg font-extrabold tracking-tight text-panel-fg">
              593
            </p>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-panel-fg-muted">
              Panel · ajans
            </p>
          </div>
        ) : (
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-panel-fg">
              {brandName}
            </p>
            {brandTypeLabel ? (
              <span className="mt-2 inline-flex rounded-md border border-panel-border bg-panel-surface-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-panel-fg-secondary">
                {brandTypeLabel}
              </span>
            ) : null}
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Ana menü">
        <SidebarNav items={nav} />
      </nav>

      <div className="mt-auto border-t border-panel-border px-4 py-4">
        <p className="truncate text-xs font-medium text-panel-fg">{userEmail}</p>
        <p className="mt-0.5 text-[11px] text-panel-fg-muted">{userRoleLabel}</p>
        <button
          type="button"
          onClick={async () => {
            await signOut({ redirect: false });
            window.location.assign("/login");
          }}
          className="mt-3 inline-flex w-full items-center gap-2 rounded-panel-btn px-2.5 py-2 text-xs font-medium text-panel-fg-secondary transition hover:bg-panel-surface-muted hover:text-panel-fg"
        >
          <LogOut className="size-3.5" aria-hidden />
          Çıkış
        </button>
      </div>
    </>
  );
}

function SidebarNav({ items }: { items: PanelNavLink[] }) {
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
    <ul className="space-y-1">
      {items.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/" || pathname === "/panel"
            : pathname === item.href ||
              pathname === `/panel${item.href}` ||
              pathname.startsWith(`${item.href}/`);

        const keepPeriod =
          item.href === "/" ||
          item.href === "/meta" ||
          item.href === "/google" ||
          item.href === "/ga4" ||
          item.href === "/budget" ||
          item.href === "/faturalar";

        const href = keepPeriod ? `${item.href}${periodQs}` : item.href;
        const brand = isBrandNavHref(item.href);
        const Icon = iconFor(item.href);

        return (
          <li key={item.href}>
            <Link
              href={href}
              className={[
                "relative flex items-center gap-3 rounded-panel-md px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-panel-accent-soft text-panel-accent before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-panel-accent"
                  : "text-panel-fg-secondary hover:bg-panel-surface-muted hover:text-panel-fg",
              ].join(" ")}
              aria-current={active ? "page" : undefined}
            >
              {brand ? (
                <BrandNavIcon
                  href={item.href}
                  className="size-[18px] shrink-0"
                />
              ) : (
                <Icon
                  className="size-4 shrink-0"
                  aria-hidden
                  strokeWidth={active ? 2.25 : 1.75}
                />
              )}
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
