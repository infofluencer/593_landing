export type Service = {
  slug: string;
  title: string;
  image: string;
  line: string;
  headline: string;
  body: string;
  points: readonly string[];
};

export const services: readonly Service[] = [
  {
    slug: "web-tasarim",
    title: "Web Tasarım",
    image: "/services/web-tasarim.jpg",
    line: "İlk saniyeden dönüşüme kadar tüm dijital deneyimi tasarlıyoruz: site, ürün arayüzü ve teknik yapı tek bir sistem gibi çalışır; marka her ekranda aynı netlikte görünür.",
    headline: "Ekranda ilk saniye, markanın tamamı.",
    body: "Web’i vitrin gibi değil, satış ve güven üreten bir sistem gibi kuruyoruz. Görsel dil, bilgi mimarisi ve teknik performans aynı brief’ten çıkar; her sayfa bir sonraki adıma taşır.",
    points: [
      "Kurumsal site, landing ve ürün arayüzü",
      "Mobil öncelikli deneyim ve net bilgi hiyerarşisi",
      "Marka kimliğiyle uyumlu tipografi ve görsel sistem",
      "Hız, erişilebilirlik ve ölçülebilir dönüşüm noktaları",
    ],
  },
  {
    slug: "dijital-pazarlama",
    title: "Dijital Pazarlama",
    image: "/services/dijital-pazarlama.jpg",
    line: "Reklam bütçesini rastgele harcamaz, ölçülebilir büyüme kurgularız. Kanal, mesaj ve hedef kitle aynı ritimde ilerler; her hamle rapora bağlanır.",
    headline: "Bütçe harcanmaz. Büyüme kurulur.",
    body: "Kampanyayı kanal listesi gibi değil, tek bir büyüme ritmi gibi yönetiriz. Mesaj, kitle ve teklif aynı çizgide ilerler; her hamle ölçülür, her hafta sadeleştirilir.",
    points: [
      "Meta, Google ve performans odaklı kampanya kurulumu",
      "Hedef kitle, teklif ve mesaj hizalaması",
      "Funnel kurgusu ve dönüşüm takibi",
      "Haftalık optimizasyon ve net raporlama",
    ],
  },
  {
    slug: "seo",
    title: "SEO",
    image: "/services/seo.jpg",
    line: "Arama sonuçlarında görünmek yetmez; doğru niyetle bulunmanı sağlar. İçerik, teknik altyapı ve otoriteyi birlikte büyütürüz ki trafik kalıcı olsun.",
    headline: "Bulunmak yetmez. Doğru niyetle seçilmek gerekir.",
    body: "SEO’yu tek seferlik bir liste gibi değil, markanın arama görünürlüğünü büyüten sürekli bir sistem gibi ele alırız. Teknik temel, içerik ve otorite aynı hedefe bağlanır.",
    points: [
      "Teknik SEO ve site sağlığı",
      "Anahtar kelime ve niyet analizi",
      "İçerik mimarisi ve sayfa optimizasyonu",
      "Yerel görünürlük ve otorite büyümesi",
    ],
  },
  {
    slug: "sosyal-medya",
    title: "Sosyal Medya",
    image: "/services/sosyal-medya.jpg",
    line: "Akışta kaybolan içerik değil, markanı tanıtan bir yayın düzeni kurarız. Ton, tempo ve topluluk aynı çizgide yürür; her paylaşım bir sonraki adımı hazırlar.",
    headline: "Akışta kaybolma. Marka olarak dur.",
    body: "Sosyal medyayı rastgele paylaşım alanı gibi değil, markanın günlük sesi gibi yönetiriz. İçerik planı, görsel dil ve topluluk yönetimi aynı ritimde ilerler.",
    points: [
      "İçerik stratejisi ve yayın takvimi",
      "Görsel dil ve ton of voice",
      "Topluluk yönetimi ve etkileşim",
      "Organik büyüme ile reklamın birlikte kurgulanması",
    ],
  },
  {
    slug: "kreatif-icerik",
    title: "Kreatif İçerik",
    image: "/services/kreatif-icerik.jpg",
    line: "Fotoğraf, video ve metni tek bir hikâyenin parçası gibi üretiriz. Her kare markanın sesini netleştirir, her satır aynı dünyada durur.",
    headline: "Her kare aynı hikâyeden gelsin.",
    body: "İçeriği parçalı üretim gibi değil, markanın görsel ve yazılı dilini büyüten bir set gibi kurarız. Fotoğraf, video ve metin aynı dünyada durur; her çıktı bir sonrakini güçlendirir.",
    points: [
      "Fotoğraf ve video prodüksiyon",
      "Marka filmleri ve kampanya görselleri",
      "Metin, senaryo ve içerik yönlendirmesi",
      "Kanal bazlı uyarlama ve yayın formatları",
    ],
  },
] as const;

export function getServiceBySlug(slug: string) {
  return services.find((service) => service.slug === slug);
}

export const infofluencerService = {
  title: "Infofluencer",
  image: "/main_dikey.svg",
  href: "https://infofluencer.co/tr",
  tagline: "Doğru influencer. Net sonuç.",
  line: "Markanı tahminle değil veriyle büyütür: doğru isimleri bulur, AI ile eşleştirir, kampanyayı yönetir ve her iş birliğini ölçülebilir hale getirir.",
} as const;
