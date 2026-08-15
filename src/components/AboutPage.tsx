"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import CursorDot from "./CursorDot";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";

const LogoOrb = dynamic(() => import("./LogoOrb"), {
  ssr: false,
  loading: () => (
    <div className="aspect-square h-full w-full animate-pulse rounded-full bg-[#e91825]/20" />
  ),
});

export default function AboutPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <main className="relative min-h-screen bg-[#141111] text-[#f4f1ea]">
      <CursorDot />
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[#141111]" />
        <div className="absolute right-[-25%] top-[35%] h-[90vh] w-[80vw] rounded-full bg-[radial-gradient(circle_at_center,rgba(233,24,37,0.2)_0%,rgba(233,24,37,0.07)_40%,transparent_72%)] blur-[80px]" />
        <div className="absolute left-[-20%] top-[-15%] h-[75vh] w-[70vw] rounded-full bg-[radial-gradient(circle_at_center,rgba(244,241,234,0.05)_0%,transparent_68%)] blur-[90px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_78%_70%,rgba(233,24,37,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_15%_8%,rgba(244,241,234,0.04),transparent_50%)]" />
      </div>

      <SiteHeader contactHref="mailto:info@593emarketing.com" />

      <div
        className={`pointer-events-none absolute z-[5] aspect-square transition duration-1000 delay-150 ease-out ${
          ready ? "scale-100 opacity-100" : "scale-95 opacity-0"
        } right-0 top-[18%] w-[min(88vw,38rem)] translate-x-[22%] sm:top-[10%] sm:w-[min(68vw,48rem)] sm:translate-x-[24%] lg:top-[4%] lg:w-[min(58vw,58rem)] lg:translate-x-[26%]`}
      >
        <LogoOrb />
      </div>

      {/* Opening — one composition */}
      <section className="relative z-10">
        <div className="page-x relative mx-auto max-w-7xl pt-10 pb-20 sm:pt-14 sm:pb-28 lg:pt-16 lg:pb-32">
          <div
            className={`relative z-[6] max-w-xl transition duration-700 ease-out lg:max-w-[34rem] ${
              ready ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
            }`}
          >
            <p className="font-logo text-[clamp(1rem,2vw,1.25rem)] font-bold tracking-[-0.02em] text-[#f4f1ea]/80">
              593 E-MARKETİNG
            </p>
            <h1 className="mt-5 font-display text-[clamp(2.6rem,7vw,4.5rem)] font-bold leading-[0.92] tracking-[-0.055em] text-[#f4f1ea]">
              Hakkımızda
            </h1>
            <p className="mt-8 text-[17px] leading-8 text-white/60 sm:text-[18px] sm:leading-9">
              <span className="font-display font-bold tracking-[-0.03em] text-[#f4f1ea]">
                Dikkat çeken değil. Akılda kalan.
              </span>{" "}
              Biz markayı bir dizi ayrı iş gibi değil, tek bir ritim gibi
              düşünürüz. Tasarım, strateji, üretim ve teknoloji aynı
              cümleden çıkar; her dokunuş bir sonraki adımı hazırlar.
            </p>
          </div>
        </div>
      </section>

      {/* Narrative body */}
      <article className="relative z-10">
        <div className="page-x mx-auto max-w-7xl pb-20 sm:pb-28 lg:pb-32">
          <div className="max-w-xl space-y-16 sm:space-y-20 lg:max-w-[34rem] lg:space-y-24">
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e91825]">
                Nasıl bakıyoruz
              </p>
              <p className="mt-5 font-display text-[clamp(1.45rem,3vw,2rem)] font-bold leading-[1.15] tracking-[-0.04em] text-[#f4f1ea]">
                Görünür olmak yetmez. Seçilir ve hatırlanır olmak gerekir.
              </p>
              <div className="mt-6 space-y-5 text-[15px] leading-8 text-white/55 sm:text-[16px] sm:leading-8">
                <p>
                  Çoğu marka için dijital dünya parçalı ilerler: bir yerde
                  site, başka yerde reklam, başka bir yerde içerik. Dil
                  bozulur, tempo düşer, sonuç dağılır. Biz tam tersini
                  istiyoruz — her temas noktasının aynı hikâyeden geldiğini
                  hissettirmek.
                </p>
                <p>
                  Bu yüzden işi kanallara bölmek yerine tek bir stüdyo
                  ritminde kuruyoruz. Kısa bir brief’ten uzun bir sistem
                  çıkar; ekran, mesaj ve büyüme aynı çizgide yürür.
                </p>
              </div>
            </section>

            <section>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Ne kuruyoruz
              </p>
              <div className="mt-5 space-y-5 text-[15px] leading-8 text-white/55 sm:text-[16px] sm:leading-8">
                <p>
                  Tasarımla markanın ilk saniyesini netleştiririz. Stratejiyle
                  bütçeyi rastgele harcamaz, ölçülebilir bir büyüme yolu
                  çizeriz. Üretimde fotoğraf, video ve metni aynı dünyada
                  tutarız. Teknolojide ise hızı ve sağlamlığı arka planda
                  bırakmadan, deneyimin kendisi gibi hissederiz.
                </p>
                <p>
                  Hepsi ayrı hizmetler gibi görünse de bizim için tek iştir:
                  markanın doğru ritimde büyümesi. İstanbul’dan, odaklanmış
                  bir ekiple; gürültü değil netlik üretmek için.
                </p>
              </div>
            </section>

            <section>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Ne için varız
              </p>
              <p className="mt-5 font-display text-[clamp(1.35rem,2.8vw,1.85rem)] font-bold leading-[1.2] tracking-[-0.04em] text-[#f4f1ea]">
                Ölçülmeyen iş büyümez. Anlatılmayan marka unutulur.
              </p>
              <div className="mt-6 space-y-5 text-[15px] leading-8 text-white/55 sm:text-[16px] sm:leading-8">
                <p>
                  Her hamleyi bir sonraki adıma bağlarız. Kampanya bir vitrin
                  değil, sistemin parçasıdır; site bir dosya değil, satış ve
                  güven üreten bir yüzeydir. İçerik de akışta kaybolan bir
                  paylaşım değil, markanın günlük sesidir.
                </p>
                <p>
                  593’ün adı bizim için bir numara değil — ritim ve odak
                  demektir. Az gürültü, net karar, tutarlı dil. Markanı
                  büyütürken gösteriş değil, kalıcılık peşindeyiz.
                </p>
              </div>
            </section>

            <section className="border-t border-white/10 pt-12 sm:pt-14">
              <p className="text-[15px] leading-8 text-white/50 sm:text-[16px]">
                Birlikte çalışmak istersen, kısa bir brifle başlayalım. Gerisini
                aynı ritimde netleştiririz.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-5">
                <a
                  href="mailto:info@593emarketing.com"
                  className="inline-flex min-h-[3.25rem] items-center rounded-full bg-[#f4f1ea] px-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#141111] transition duration-300 hover:bg-[#e91825] hover:text-white lg:min-h-0 lg:py-3"
                >
                  Proje Başlat
                </a>
                <Link
                  href="/hizmetlerimiz"
                  className="inline-flex min-h-11 items-center text-[14px] text-white/45 transition hover:text-[#f4f1ea] lg:min-h-0"
                >
                  Hizmetlerimize bak ↗
                </Link>
              </div>
            </section>
          </div>
        </div>
      </article>

      <SiteFooter />
    </main>
  );
}
