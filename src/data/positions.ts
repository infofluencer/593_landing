/**
 * Açık pozisyonlar ve başvuru formundaki ön eleme soruları.
 * Form ve /api/career aynı kaynaktan okur; soru eklemek için yalnız burayı düzenle.
 */

export type ScreeningQuestion = {
  id: string;
  label: string;
  /** `years`: sayı girişi; `yesno`: Evet / Hayır. */
  kind: "years" | "yesno";
  required: boolean;
};

export type Position = {
  slug: string;
  title: string;
  department: string;
  employment: string;
  workModel: string;
  location: string;
  intro: string;
  skills: string[];
  expectations: string[];
  bonus: string;
  applicationNote: string;
  screening: ScreeningQuestion[];
};

export const positions: Position[] = [
  {
    slug: "performans-pazarlama-uzmani",
    title: "Performans Pazarlama Uzmanı",
    department: "Reklam Hizmetleri",
    employment: "Tam zamanlı",
    workModel: "Hibrit · 3 gün ofis, 2 gün uzaktan",
    location: "Beyoğlu, İstanbul",
    intro:
      "593 E-Marketing olarak farklı sektörlerde hizmet verdiğimiz markaların reklam süreçlerini yönetecek, teknik kuruluma ve düzenli iş takibine hâkim, en az 3 yıl deneyimli bir Performans Pazarlama Uzmanı arıyoruz. Stratejiyi birlikte oluşturacağımız; kurulum, günlük kontrol, optimizasyon ve raporlama süreçlerini sorumluluk alarak yürütebilecek bir ekip arkadaşıyla çalışmak istiyoruz.",
    skills: [
      "Meta Ads ve Google Ads platformlarında en az 3 yıl aktif kampanya yönetimi deneyimi.",
      "Farklı sektörlerdeki markalar için hedefe uygun kampanya yönetebilme; sağlık ve e-ticaret alanlarında deneyim.",
      "Pixel, Meta Conversions API, Google Tag Manager, GA4 ve Google Ads dönüşüm takibi süreçlerini kurabilme, test edebilme ve sorunlarını tespit edebilme.",
      "Ürün kataloğu, Google Merchant Center, ürün feed’i ve CRM bağlantılarına hâkimiyet.",
      "Shopify, WooCommerce ve benzeri e-ticaret altyapılarında reklam ve ölçümleme entegrasyonları konusunda uygulama deneyimi.",
      "Reklam bütçelerini ve performans verilerini düzenli takip ederek gerekli aksiyonları alabilme.",
      "Birden fazla markanın işlerini planlayabilme, önceliklendirebilme ve tamamlanana kadar takip edebilme.",
    ],
    expectations: [
      "Birlikte belirlenen stratejiyi uygulamaya geçirmek ve reklam hesaplarının günlük yönetimini üstlenmek.",
      "Harcama, yayın, dönüşüm takibi ve katalog sorunlarını zamanında fark ederek çözüm sürecini yürütmek.",
      "Performans değişimlerini nedenleriyle değerlendirmek, iyileştirme önerileri geliştirmek ve alınan aksiyonların sonuçlarını takip etmek.",
      "Reklam görseli ve videolarındaki eksiklikleri belirleyip somut notlarla tasarım ve video ekibine aktarmak; ekip içi beyin fırtınasına ve kreatif test planlarına katkı sağlamak.",
      "Teknik destek gereken konularda ihtiyacı doğru tarif etmek, ilgili ekiple koordinasyon kurmak ve çözümü doğrulamak. Kod yazma beklentimiz bulunmuyor.",
    ],
    bonus:
      "TikTok Ads, LinkedIn Ads, ChatGPT Ads ve diğer reklam kanallarındaki deneyim ek avantajdır.",
    applicationNote:
      "Özgeçmişinizle birlikte yönettiğiniz sektörleri ve doğrudan sorumluluk aldığınız işleri kısaca belirtmenizi rica ediyoruz.",
    screening: [
      {
        id: "years",
        label:
          "Meta Ads ve Google Ads hesaplarını aktif olarak kaç yıldır yönetiyorsunuz?",
        kind: "years",
        required: true,
      },
      {
        id: "hybrid",
        label:
          "Haftanın 3 günü ofisten, 2 günü evden çalışılan hibrit düzene uygun musunuz?",
        kind: "yesno",
        required: true,
      },
      {
        id: "capi",
        label:
          "Meta Pixel ve Conversions API kurulumunu yapıp olayların doğru çalıştığını test ettiniz mi?",
        kind: "yesno",
        required: true,
      },
      {
        id: "gtm",
        label:
          "Google Tag Manager üzerinden GA4 ve Google Ads dönüşüm takibi kurulumlarını doğrudan yaptınız mı?",
        kind: "yesno",
        required: true,
      },
      {
        id: "feed",
        label:
          "Meta ürün kataloğu ve Google Merchant Center üzerinde ürün feed’i kurulumu ve hata giderme süreçlerini yürüttünüz mü?",
        kind: "yesno",
        required: true,
      },
      {
        id: "creative",
        label:
          "Reklam performansından hareketle kreatif eksikliklerini belirleyip tasarım veya video ekibine yazılı geri bildirim verdiniz mi?",
        kind: "yesno",
        required: true,
      },
      {
        id: "health",
        label: "Sağlık sektöründe reklam kampanyaları yönettiniz mi?",
        kind: "yesno",
        required: false,
      },
      {
        id: "shop",
        label:
          "Shopify veya WooCommerce üzerinde dönüşüm takibi ve ürün kataloğu kurulumunu doğrudan yaptınız mı?",
        kind: "yesno",
        required: false,
      },
    ],
  },
];

export function getPosition(slug: string) {
  return positions.find((p) => p.slug === slug) ?? null;
}

/** CV eki üst sınırı (bayt). Form ve API birlikte kullanır. */
export const CV_MAX_BYTES = 5 * 1024 * 1024;
