"use client";

import { useSyncExternalStore } from "react";

/**
 * Zaman filtresi geçişlerinin ortak durumu (PeriodFilterBar + DateRangePicker).
 * Filtre bileşeni sayfayla birlikte unmount olabildiği için durum modül
 * seviyesinde tutulur; PanelShell içindeki gösterge URL'yi izleyip bitirir.
 */
export type PeriodNavStatus = "idle" | "loading" | "slow" | "error";

export type PeriodNavState = {
  status: PeriodNavStatus;
  /** Hedef URL (pathname + query). */
  href: string | null;
  /** Hangi kontrol tetikledi (spinner o düğmede döner). */
  key: string | null;
  /** Kullanıcıya gösterilecek dönem adı. */
  label: string | null;
  /** Başlatıldığı pathname — farklı sayfaya geçilirse iş biter. */
  fromPath: string | null;
};

/** Bu süreden sonra "hâlâ yükleniyor" uyarısı. */
const SLOW_MS = 8_000;
/** Bu süreden sonra yüklenemedi say. */
const FAIL_MS = 30_000;

const IDLE: PeriodNavState = {
  status: "idle",
  href: null,
  key: null,
  label: null,
  fromPath: null,
};

let state: PeriodNavState = IDLE;
const listeners = new Set<() => void>();
let slowTimer: ReturnType<typeof setTimeout> | null = null;
let failTimer: ReturnType<typeof setTimeout> | null = null;

function emit(next: PeriodNavState) {
  state = next;
  for (const l of listeners) l();
}

function clearTimers() {
  if (slowTimer) clearTimeout(slowTimer);
  if (failTimer) clearTimeout(failTimer);
  slowTimer = null;
  failTimer = null;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function startPeriodNav(opts: {
  href: string;
  key: string;
  label: string;
  fromPath: string;
}) {
  clearTimers();
  emit({ status: "loading", ...opts });
  const token = opts.href;
  slowTimer = setTimeout(() => {
    if (state.href === token && state.status === "loading") {
      emit({ ...state, status: "slow" });
    }
  }, SLOW_MS);
  failTimer = setTimeout(() => {
    if (state.href === token && state.status !== "idle") {
      emit({ ...state, status: "error" });
    }
  }, FAIL_MS);
}

export function failPeriodNav() {
  clearTimers();
  if (state.status !== "idle") emit({ ...state, status: "error" });
}

export function finishPeriodNav() {
  clearTimers();
  if (state.status !== "idle") emit(IDLE);
}

export function usePeriodNavState(): PeriodNavState {
  return useSyncExternalStore(subscribe, () => state, () => IDLE);
}

/** Sorgu sırası farklı olsa da aynı URL'yi eşleştirir. */
export function normalizeHref(href: string): string {
  const [path, qs = ""] = href.split("?");
  const params = new URLSearchParams(qs);
  const sorted = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  const q = new URLSearchParams(sorted).toString();
  return q ? `${path}?${q}` : path;
}
