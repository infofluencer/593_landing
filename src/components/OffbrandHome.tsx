"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import CursorDot from "./CursorDot";

const LogoOrb = dynamic(() => import("./LogoOrb"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto aspect-square w-full max-w-[min(82vw,38rem)] animate-pulse rounded-full bg-[#e91825]/25" />
  ),
});

const featuredWork = [
  {
    title: "Dijital Pazarlama",
    type: "Performans / Strateji",
    image: "/services/dijital-pazarlama.jpg",
  },
  {
    title: "Web Tasarım",
    type: "Deneyim / Geliştirme",
    image: "/services/web-tasarim.jpg",
  },
  {
    title: "SEO",
    type: "Görünürlük / İçerik",
    image: "/services/seo.jpg",
  },
];

const services = [
  "Marka stratejisi",
  "Dijital deneyim tasarımı",
  "Performans pazarlama",
  "SEO ve içerik sistemi",
  "Sosyal medya kurgusu",
  "Kreatif prodüksiyon",
];

export default function OffbrandHome() {
  return (
    <main className="min-h-screen bg-white text-[#111111]">
      <CursorDot />
      {/* HERO — orb + blend-mode slogan (Off+Brand approach) */}
      <section className="relative min-h-dvh overflow-hidden bg-white text-[#111111]">
        <div className="relative z-30 flex w-full items-center justify-between pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(1rem,env(safe-area-inset-top))] sm:pr-6 lg:pr-8">
          <Link
            href="/"
            className="font-logo text-[clamp(1.35rem,3.4vw,2.1rem)] font-extrabold leading-none tracking-[-0.02em]"
          >
            593 E-MARKETİNG
          </Link>
          <nav className="flex items-center">
            <Link
              href="#contact"
              className="rounded-full bg-[#111111] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition duration-300 hover:bg-[#e91825] sm:px-6 sm:py-3"
            >
              İletişim
            </Link>
          </nav>
        </div>

        <div className="relative mx-auto flex min-h-[calc(100dvh-4.5rem)] max-w-7xl items-center justify-center px-4 pb-16 pt-4 sm:px-6">
          <div className="pointer-events-none absolute inset-0 z-0">
            <div className="absolute left-1/2 top-1/2 aspect-square w-[min(92vw,42rem)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/[0.04]" />
            <div className="absolute left-1/2 top-1/2 aspect-square w-[min(78vw,34rem)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/[0.05]" />
            <div className="absolute left-1/2 top-1/2 aspect-square w-[min(64vw,26rem)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/[0.06]" />
          </div>

          <div className="relative z-10 w-full max-w-[min(82vw,38rem)]">
            <LogoOrb />
          </div>

          <h1 className="pointer-events-none absolute inset-0 z-20 mix-blend-difference">
            <span className="sr-only">Strateji, Tasarım, Dönüşüm</span>
            <span
              aria-hidden
              className="absolute left-0 top-[14%] font-display text-[clamp(2.6rem,11vw,7.5rem)] font-extrabold leading-[0.85] tracking-[-0.06em] text-white sm:-left-[2%] sm:top-[16%] md:-left-[4%] lg:-left-[6%]"
            >
              STRATEJİ
            </span>
            <span
              aria-hidden
              className="absolute -right-[8%] top-[40%] text-right font-display text-[clamp(2.6rem,11vw,7.5rem)] font-extrabold leading-[0.85] tracking-[-0.06em] text-white sm:-right-[10%] sm:top-[38%] md:-right-[14%] lg:-right-[18%]"
            >
              TASARIM
            </span>
            <span
              aria-hidden
              className="absolute bottom-[18%] left-1/2 w-full -translate-x-1/2 text-center font-display text-[clamp(2.4rem,10.5vw,7rem)] font-extrabold leading-[0.85] tracking-[-0.06em] text-white sm:bottom-[16%]"
            >
              DÖNÜŞÜM
            </span>
          </h1>

          <div className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-30 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40 sm:right-8">
            Kaydır ↓
          </div>
        </div>
      </section>

      <section
        id="manifesto"
        className="border-y border-black/8 bg-[#111111] px-4 py-16 text-[#f4f1ea] sm:px-6 lg:px-8 lg:py-24"
      >
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
            Manifesto
          </p>
          <div>
            <p className="max-w-5xl font-display text-[clamp(2rem,5vw,4.5rem)] font-bold leading-[0.95] tracking-[-0.06em]">
              Dikkat çeken değil, akılda kalan markalar tasarlıyoruz.
            </p>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
              Her temas noktasını tekil bir kampanya gibi değil, bir sistem gibi
              ele alıyoruz. Tasarım, yazılım ve büyüme tarafları tek bir ritimde
              çalıştığında markalar daha güçlü görünür.
            </p>
          </div>
        </div>
      </section>

      <section id="work" className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45">
                Seçili İşler
              </p>
              <h2 className="mt-3 font-display text-[clamp(2.2rem,5vw,4.2rem)] font-bold leading-[0.95] tracking-[-0.06em]">
                Markayı ileri taşıyan
                <br />
                dijital yüzeyler.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-black/55 sm:text-base">
              Editorial bir ritim: sessiz ama keskin.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {featuredWork.map((item, index) => (
              <article
                key={item.title}
                className="group overflow-hidden rounded-[2rem] border border-black/8 bg-white"
              >
                <div className="relative aspect-[4/5] overflow-hidden">
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 33vw"
                    className="object-cover transition duration-700 group-hover:scale-[1.03]"
                    priority={index === 0}
                  />
                </div>
                <div className="flex items-end justify-between gap-4 p-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-black/38">
                      {item.type}
                    </p>
                    <h3 className="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">
                      {item.title}
                    </h3>
                  </div>
                  <span className="text-sm font-semibold text-black/40">0{index + 1}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="services" className="border-t border-black/8 px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45">
              Hizmetler
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {services.map((service, index) => (
              <div
                key={service}
                className="flex items-center justify-between border-b border-black/10 py-4"
              >
                <span className="font-display text-[clamp(1.4rem,3vw,2.4rem)] font-bold tracking-[-0.05em]">
                  {service}
                </span>
                <span className="text-sm text-black/35">0{index + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pb-24">
        <div className="mx-auto max-w-7xl rounded-[2rem] bg-[#e91825] px-6 py-10 text-white sm:px-8 lg:px-10 lg:py-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
            İletişim
          </p>
          <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="font-display text-[clamp(2.25rem,5vw,4.5rem)] font-bold leading-[0.95] tracking-[-0.06em]">
                Sıradaki projeyi
                <br />
                birlikte kuralım.
              </h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-white/78">
                Markanı büyütecek strateji, tasarım ve performans için bize
                yaz — kısa bir brieften başlayalım.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="mailto:hello@593emarketing.com"
                className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#111111]"
              >
                hello@593emarketing.com
              </Link>
              <Link
                href="https://593emarketing.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-white/25 px-5 py-3 text-sm font-semibold text-white"
              >
                Mevcut siteyi gör
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
