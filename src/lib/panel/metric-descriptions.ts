/**
 * Merkezi metrik sözlüğü — KPI (?) tooltip’leri buradan beslenir.
 * Kartlar `metricKey` ile çeker; sayfada tekrar yazılmaz.
 */

export type MetricDescription = {
  /** Kısa başlık (tooltip üst satır). */
  title: string;
  /** Türkçe açıklama — ne anlama gelir. */
  description: string;
  /** Nasıl hesaplanır (varsa). */
  formula?: string;
};

export const METRIC_DESCRIPTIONS = {
  spend: {
    title: "Harcama",
    description: "Seçilen dönemde reklama harcanan toplam tutar.",
    formula: "Kanaldaki tüm kampanya harcamalarının toplamı",
  },
  revenue: {
    title: "Gelir",
    description: "Reklamların getirdiği dönüşüm değeri (ciro).",
    formula: "Dönüşüm değeri toplamı",
  },
  conversions: {
    title: "Dönüşüm",
    description:
      "Hedef aksiyon sayısı. E-ticarette satış; lead’de form / WhatsApp vb.",
    formula: "Platformda sayılan dönüşüm adedi (kanal düz toplamı)",
  },
  conv: {
    title: "Dönüşüm",
    description:
      "Hedef aksiyon sayısı. E-ticarette satış; lead’de form / WhatsApp vb.",
    formula: "Platformda sayılan dönüşüm adedi",
  },
  cpl: {
    title: "Lead maliyeti",
    description: "Bir lead’in ortalama maliyeti.",
    formula: "Harcama ÷ lead sayısı",
  },
  cpa: {
    title: "Satış maliyeti",
    description: "Bir satışın (veya sonuç biriminin) ortalama maliyeti.",
    formula: "Harcama ÷ satış / sonuç adedi",
  },
  costPerResult: {
    title: "Sonuç maliyeti",
    description: "Bir sonucun ortalama maliyeti (satış veya lead).",
    formula: "Harcama ÷ sonuç adedi",
  },
  roas: {
    title: "Getiri (ROAS)",
    description:
      "Reklam harcaması getirisi. Her 1₺ harcamaya karşılık gelen ciro.",
    formula: "Dönüşüm değeri ÷ harcama",
  },
  clicks: {
    title: "Tıklama",
    description: "Reklama tıklayan etkileşim sayısı.",
    formula: "Platform tıklama toplamı",
  },
  impressions: {
    title: "Gösterim",
    description: "Reklamın kaç kez ekranda gösterildiği.",
    formula: "Gösterim adedi (aynı kişi birden fazla sayılabilir)",
  },
  impr: {
    title: "Gösterim",
    description: "Reklamın kaç kez ekranda gösterildiği.",
    formula: "Gösterim adedi",
  },
  reach: {
    title: "Erişim",
    description: "Reklamı gören tahmini tekil kişi sayısı.",
    formula: "Meta tekil erişim (unique reach)",
  },
  frequency: {
    title: "Frekans",
    description: "Aynı kişinin reklamı ortalama kaç kez gördüğü.",
    formula: "Gösterim ÷ erişim",
  },
  ctr: {
    title: "Tıklama oranı (CTR)",
    description: "Gösterimlerin yüzde kaçının tıklamaya dönüştüğü.",
    formula: "(Tıklama ÷ gösterim) × 100",
  },
  cpc: {
    title: "Tıklama maliyeti (CPC)",
    description: "Bir tıklamanın ortalama maliyeti.",
    formula: "Harcama ÷ tıklama",
  },
  bounceRate: {
    title: "Hemen çıkma",
    description: "Tek sayfalık oturumların oranı.",
    formula: "Tek etkileşimli oturum ÷ tüm oturum",
  },
  sessionConvRate: {
    title: "Oturum dönüşüm oranı",
    description: "Oturumların yüzde kaçında dönüşüm olduğu.",
    formula: "(Dönüşüm ÷ oturum) × 100",
  },
  users: {
    title: "Kullanıcı",
    description: "Sitede aktif olan tahmini tekil kullanıcı.",
  },
  sessions: {
    title: "Oturum",
    description: "Sitede başlayan oturum sayısı.",
  },
  pagePerSession: {
    title: "Sayfa / oturum",
    description: "Bir oturumda ortalama görüntülenen sayfa.",
    formula: "Sayfa görüntüleme ÷ oturum",
  },
  avgSessionDuration: {
    title: "Ort. oturum süresi",
    description: "Kullanıcıların sitede geçirdiği ortalama süre.",
  },
  transactions: {
    title: "İşlem",
    description: "Tamamlanan satın alma işlem sayısı (GA4).",
  },
  gscClicks: {
    title: "Arama tıklaması",
    description: "Google Arama sonuçlarından siteye gelen tıklamalar.",
  },
  gscImpressions: {
    title: "Arama gösterimi",
    description: "Sitenin arama sonuçlarında göründüğü sayı.",
  },
  gscCtr: {
    title: "Arama CTR",
    description: "Arama gösterimlerinin tıklamaya dönüş oranı.",
    formula: "(Tıklama ÷ gösterim) × 100",
  },
  gscPosition: {
    title: "Ort. konum",
    description: "Arama sonuçlarındaki ortalama sıralama. Düşük sayı daha iyi.",
  },
  channelsConnected: {
    title: "Kanallar",
    description: "Bu markada veri alınan reklam / analitik kanalları.",
  },
  health: {
    title: "Durum",
    description: "Marka sağlığı özeti (eşik ve sync durumuna göre).",
  },
  syncStatus: {
    title: "Sync",
    description: "Son senkronizasyonun başarı / hata durumu.",
  },
  gtmSiteVerify: {
    title: "Site doğrulama",
    description: "GTM / consent senaryolarının sitede test sonucu.",
  },
  videoViews: {
    title: "Video izleme",
    description: "Video reklamın izlenme sayısı (platform tanımına göre).",
  },
  thruplay: {
    title: "ThruPlay",
    description: "Videonun en az 15 sn veya sonuna kadar izlenmesi (Meta).",
  },
  videoP25: {
    title: "Video %25",
    description: "Videonun en az %25’inin izlendiği sayı.",
  },
  videoP50: {
    title: "Video %50",
    description: "Videonun en az %50’sinin izlendiği sayı.",
  },
  videoP75: {
    title: "Video %75",
    description: "Videonun en az %75’inin izlendiği sayı.",
  },
  videoP100: {
    title: "Video %100",
    description: "Videonun tamamının izlendiği sayı.",
  },
  formLeads: {
    title: "Form lead",
    description: "Form / iletişim dönüşümleri.",
  },
  whatsappLeads: {
    title: "WhatsApp",
    description: "WhatsApp / mesajlaşma dönüşümleri.",
  },
  budgetUsed: {
    title: "Bütçe kullanımı",
    description: "Dönem bütçesinin ne kadarının harcandığı.",
    formula: "(Harcama ÷ bütçe) × 100",
  },
  invoiceTotal: {
    title: "Fatura tutarı",
    description: "Döneme ait faturalandırılan reklam harcaması.",
  },
  campaign: {
    title: "Kampanya",
    description: "Reklam platformundaki kampanya adı veya kimliği.",
  },
  adset: {
    title: "Reklam seti",
    description: "Kampanya altındaki hedefleme / bütçe grubu.",
  },
  creative: {
    title: "Kreatif",
    description: "Reklam görseli / videosu / metin varlığı.",
  },
} as const satisfies Record<string, MetricDescription>;

export type MetricDescriptionKey = keyof typeof METRIC_DESCRIPTIONS;

export function getMetricDescription(
  key: string | null | undefined,
): MetricDescription | null {
  if (!key) return null;
  const entry = METRIC_DESCRIPTIONS[key as MetricDescriptionKey];
  return entry ?? null;
}
