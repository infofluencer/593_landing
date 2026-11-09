/**
 * Shift sayfası — tasarım tek yerden.
 * Renkler 593 paleti: mürekkep #141111, vurgu #e91825, onay yeşili.
 */

export const SHIFT_UI = {
  copy: {
    title: "Shift",
    subtitle: "Haftalık ofis planı — kim hangi gün ofiste.",
    employeeHeader: "Çalışan",
    weeklyHeader: "Haftalık",
    emptyPeopleTitle: "Ekipte kimse yok",
    emptyPeopleBody: "Gösterilecek çalışan bulunmuyor.",
    offMark: "—",
    planTitle: "Haftalık Ofis Planı",
    chartTitle: "Günlük Ofis Yoğunluğu",
  },

  show: {
    table: true,
    chart: true,
  },

  /** Shift tablosunda gizlenen kişiler (Ekip sayfasında kalır). */
  omitEmails: [
    "hakan@593emarketing.com",
    "muhammet@593emarketing.com",
  ],

  /** Tablo sırası; yazılmayanlar alta alfabetik eklenir. */
  peopleOrder: [
    "Numan",
    "Kaan",
    "Sevde",
    "Alara",
    "Hüseyin",
    "Sudenas",
  ],

  colors: {
    ink: "#141111",
    muted: "#6b7280",
    faint: "#9ca3af",
    surface: "#ffffff",
    border: "#e7e5e4",
    accent: "#e91825",
    accentSoft: "rgba(233, 24, 37, 0.08)",
    ok: "#15803d",
    okBg: "#f0fdf4",
    okBorder: "#bbf7d0",
    warn: "#b91c1c",
    warnBg: "#fef2f2",
    rowA: "#ffffff",
    rowB: "#fafaf9",
    tableHead: "#f5f5f4",
    bar: "#e91825",
    barMuted: "rgba(233, 24, 37, 0.28)",
  },

  size: {
    radius: 20,
    tableMinWidth: 640,
    cell: 36,
    barMax: 132,
  },
} as const;

export type ShiftUi = typeof SHIFT_UI;
