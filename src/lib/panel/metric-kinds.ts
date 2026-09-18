/**
 * Metrik tipi → görsel kalıp eşlemesi.
 * Her katalog metriği bu tiplerden birine girer; UI her yerde aynı kalıbı kullanır.
 */

export type MetricKind =
  | "money" // harcama, gelir, CPA, CPL
  | "rate" // CTR, bounce, dönüşüm oranı %
  | "multiplier" // ROAS / getiri (11,21x) — paradan görsel ayrışır
  | "count" // tıklama, gösterim, dönüşüm adedi, oturum
  | "duration" // ort. oturum süresi mm:ss
  | "status" // health, alert, sync — StatusBadge
  | "unknown"; // veri yok → EmptyState / "—", ASLA 0

/** Pozitif değişimin "iyi" sayılıp sayılmadığı. */
export type MetricGoodDirection = "up" | "down" | "neutral";

export type MetricDef = {
  id: string;
  label: string;
  kind: MetricKind;
  /** Değişim rozeti rengi buna göre. */
  goodDirection: MetricGoodDirection;
  hint?: string;
  /** Hangi tenant tipinde görünür. */
  tenantTypes?: Array<"ecommerce" | "lead" | "both">;
};

/**
 * Katalogdaki metrikler — tek kaynak.
 * Sayfa giydirmede KPICard/StatusBadge bu id’lerle beslenir.
 */
export const METRIC_CATALOG: Record<string, MetricDef> = {
  spend: {
    id: "spend",
    label: "Harcama",
    kind: "money",
    goodDirection: "down",
    hint: "Reklam harcaması",
    tenantTypes: ["both"],
  },
  revenue: {
    id: "revenue",
    label: "Gelir",
    kind: "money",
    goodDirection: "up",
    hint: "Dönüşüm değeri",
    tenantTypes: ["ecommerce"],
  },
  cpa: {
    id: "cpa",
    label: "Satış maliyeti",
    kind: "money",
    goodDirection: "down",
    hint: "Harcama / satış",
    tenantTypes: ["ecommerce"],
  },
  cpl: {
    id: "cpl",
    label: "Lead maliyeti",
    kind: "money",
    goodDirection: "down",
    hint: "Harcama / lead",
    tenantTypes: ["lead"],
  },
  costPerResult: {
    id: "costPerResult",
    label: "Sonuç maliyeti",
    kind: "money",
    goodDirection: "down",
    tenantTypes: ["both"],
  },
  ctr: {
    id: "ctr",
    label: "Tıklama oranı",
    kind: "rate",
    goodDirection: "up",
    hint: "Tıklama / gösterim",
    tenantTypes: ["both"],
  },
  bounceRate: {
    id: "bounceRate",
    label: "Hemen çıkma",
    kind: "rate",
    goodDirection: "down",
    tenantTypes: ["both"],
  },
  sessionConvRate: {
    id: "sessionConvRate",
    label: "Oturum dönüşüm oranı",
    kind: "rate",
    goodDirection: "up",
    tenantTypes: ["both"],
  },
  gscCtr: {
    id: "gscCtr",
    label: "Ort. CTR",
    kind: "rate",
    goodDirection: "up",
    tenantTypes: ["both"],
  },
  roas: {
    id: "roas",
    label: "Getiri",
    kind: "multiplier",
    goodDirection: "up",
    hint: "Gelir / harcama",
    tenantTypes: ["ecommerce"],
  },
  clicks: {
    id: "clicks",
    label: "Tıklama",
    kind: "count",
    goodDirection: "up",
    tenantTypes: ["both"],
  },
  impressions: {
    id: "impressions",
    label: "Gösterim",
    kind: "count",
    goodDirection: "neutral",
    hint: "Reklamı gören tekil gösterim",
    tenantTypes: ["both"],
  },
  reach: {
    id: "reach",
    label: "Erişim",
    kind: "count",
    goodDirection: "up",
    hint: "Reklamı gören tekil kişi",
    tenantTypes: ["both"],
  },
  conversions: {
    id: "conversions",
    label: "Dönüşüm",
    kind: "count",
    goodDirection: "up",
    tenantTypes: ["both"],
  },
  users: {
    id: "users",
    label: "Kullanıcı",
    kind: "count",
    goodDirection: "up",
    tenantTypes: ["both"],
  },
  sessions: {
    id: "sessions",
    label: "Oturum",
    kind: "count",
    goodDirection: "up",
    tenantTypes: ["both"],
  },
  pagePerSession: {
    id: "pagePerSession",
    label: "Sayfa / oturum",
    kind: "count",
    goodDirection: "up",
    tenantTypes: ["both"],
  },
  transactions: {
    id: "transactions",
    label: "İşlem",
    kind: "count",
    goodDirection: "up",
    tenantTypes: ["ecommerce"],
  },
  channelsConnected: {
    id: "channelsConnected",
    label: "Kanallar",
    kind: "count",
    goodDirection: "neutral",
    tenantTypes: ["both"],
  },
  gscClicks: {
    id: "gscClicks",
    label: "Tıklama",
    kind: "count",
    goodDirection: "up",
    tenantTypes: ["both"],
  },
  gscImpressions: {
    id: "gscImpressions",
    label: "Gösterim",
    kind: "count",
    goodDirection: "up",
    tenantTypes: ["both"],
  },
  gscPosition: {
    id: "gscPosition",
    label: "Ort. konum",
    kind: "count",
    goodDirection: "down",
    hint: "Düşük sayı daha iyi",
    tenantTypes: ["both"],
  },
  avgSessionDuration: {
    id: "avgSessionDuration",
    label: "Ort. oturum süresi",
    kind: "duration",
    goodDirection: "up",
    tenantTypes: ["both"],
  },
  health: {
    id: "health",
    label: "Durum",
    kind: "status",
    goodDirection: "neutral",
    tenantTypes: ["both"],
  },
  syncStatus: {
    id: "syncStatus",
    label: "Sync",
    kind: "status",
    goodDirection: "neutral",
    tenantTypes: ["both"],
  },
  gtmSiteVerify: {
    id: "gtmSiteVerify",
    label: "Site doğrulama",
    kind: "status",
    goodDirection: "neutral",
    tenantTypes: ["both"],
  },
};

export const METRIC_KIND_META: Record<
  MetricKind,
  {
    label: string;
    pattern: string;
    component: string;
  }
> = {
  money: {
    label: "Para",
    pattern: "Büyük tabular-nums + ₺ (tenant.currency) + değişim rozeti",
    component: "KPICard kind=money",
  },
  rate: {
    label: "Oran",
    pattern: "Yüzde + küçük trend oku",
    component: "KPICard kind=rate",
  },
  multiplier: {
    label: "Çarpan",
    pattern: "“x” soneki · paradan ayrışan etiket rengi",
    component: "KPICard kind=multiplier",
  },
  count: {
    label: "Sayaç",
    pattern: "Tam sayı, binlik ayraç, alt açıklama",
    component: "KPICard kind=count",
  },
  duration: {
    label: "Süre",
    pattern: "mm:ss — sayı kalıbından ayrı",
    component: "KPICard kind=duration",
  },
  status: {
    label: "Durum",
    pattern: "ok/warn/critical/unknown · unknown nötr gri",
    component: "StatusBadge",
  },
  unknown: {
    label: "Kontrol edilemedi",
    pattern: "ASLA 0 veya boş grafik · nötr EmptyState",
    component: "EmptyState variant=unknown",
  },
};

export function metricDef(id: string): MetricDef | undefined {
  return METRIC_CATALOG[id];
}

export function deltaInvertFor(goodDirection: MetricGoodDirection): boolean {
  return goodDirection === "down";
}

/** Saniye → mm:ss */
export function formatDurationMmSs(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds)) return "—";
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
