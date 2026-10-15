/**
 * Panel grafik teması — kanal renkleri CVD doğrulamalı
 * (validate_palette: #0866FF ↔ #E37400, en kötü ΔE 33, tüm kontroller geçti).
 * Metin hiçbir zaman seri renginde yazılmaz; kimliği yanındaki işaret taşır.
 */

export const META_COLOR = "#0866FF";
export const GOOGLE_COLOR = "#E37400";

/** Durum renkleri — yalnızca durum için, ikon + etiketle birlikte. */
export const STATUS_OK = "#15803d";
export const STATUS_ERROR = "#be123c";
export const STATUS_EMPTY = "#e7e5e4";

export const INK = "#141111";
export const INK_SOFT = "#78716c";
export const GRID = "#f0eeeb";

export const AXIS_TICK = { fill: INK_SOFT, fontSize: 11 } as const;

export const TOOLTIP_STYLE = {
  background: "#ffffff",
  border: "1px solid #e7e5e4",
  borderRadius: 12,
  fontSize: 12,
  color: INK,
  boxShadow: "0 8px 24px rgba(20,17,17,0.08)",
} as const;

export const TOOLTIP_CURSOR = { fill: "rgba(20,17,17,0.05)" } as const;

/** 4,5 bin · 1,2 milyon — "B" (bin) milyar sanılmasın. */
export function compactNumber(v: number): string {
  return new Intl.NumberFormat("tr-TR", {
    notation: "compact",
    compactDisplay: "long",
    maximumFractionDigits: 1,
  }).format(v);
}

export function currencySymbol(currency: string): string {
  return (
    new Intl.NumberFormat("tr-TR", { style: "currency", currency })
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value ?? currency
  );
}

export function compactMoney(v: number, currency: string): string {
  return `${currencySymbol(currency)}${compactNumber(v)}`;
}

export function shortDay(ymd: string): string {
  return `${ymd.slice(8, 10)}.${ymd.slice(5, 7)}`;
}

/** Önceki döneme göre yüzde değişim; taban 0 ise null. */
export function deltaPct(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Sonuç türleri — Meta/Google renklerinden ayrı; CVD doğrulamalı (ΔE 22,9). */
export const LEAD_COLOR = "#047857";
export const SALE_COLOR = "#9333EA";
