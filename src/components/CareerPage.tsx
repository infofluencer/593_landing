"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CursorDot from "./CursorDot";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import OutArrow from "./OutArrow";
import { positions } from "@/data/positions";

const eyebrow =
  "text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40";

const principles = [
  {
    title: "Tek ritim, net iş",
    text: "Tasarım, strateji ve büyüme aynı masada. Herkes neyin neden yapıldığını bilir; iş kanallara bölünmez.",
  },
  {
    title: "Hibrit düzen",
    text: "Haftanın 3 günü Beyoğlu’ndaki ofisimizde birlikte, 2 günü uzaktan çalışıyoruz.",
  },
  {
    title: "Sorumluluk alan ekip",
    text: "Küçük ve odaklı bir ekibiz. Her iş birinin adıyla yürür; takip eden tamamlar, tamamlayan anlatır.",
  },
];

export default function CareerPage() {
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
        <div className="absolute left-[-20%] top-[30%] h-[90vh] w-[80vw] rounded-full bg-[radial-gradient(circle_at_center,rgba(233,24,37,0.18)_0%,rgba(233,24,37,0.06)_40%,transparent_72%)] blur-[80px]" />
        <div className="absolute right-[-15%] top-[-10%] h-[70vh] w-[65vw] rounded-full bg-[radial-gradient(circle_at_center,rgba(244,241,234,0.05)_0%,transparent_68%)] blur-[90px]" />
      </div>

      <SiteHeader />

      {/* Opening */}
      <section className="relative z-10">
        <div className="page-x mx-auto max-w-7xl pt-10 pb-16 sm:pt-14 sm:pb-20 lg:pt-16 lg:pb-24">
          <div
            className={`max-w-2xl transition duration-700 ease-out ${
              ready ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
            }`}
          >
            <p className="font-logo text-[clamp(1rem,2vw,1.25rem)] font-bold tracking-[-0.02em] text-[#f4f1ea]/80">
              593 E-MARKETİNG
            </p>
            <h1 className="mt-5 font-display text-[clamp(2.6rem,7vw,4.5rem)] font-bold leading-[0.92] tracking-[-0.055em]">
              Kariyer
            </h1>
            <p className="mt-8 text-[17px] leading-8 text-white/60 sm:text-[18px] sm:leading-9">
              <span className="font-display font-bold tracking-[-0.03em] text-[#f4f1ea]">
                Az gürültü, net karar, tutarlı dil.
              </span>{" "}
              İstanbul’dan odaklanmış bir ekiple çalışıyoruz. İşi kanallara
              bölmek yerine tek bir stüdyo ritminde kuruyoruz; sen de bu ritme
              katılmak istiyorsan açık pozisyonlara göz at.
            </p>
            <a
              href="#pozisyonlar"
              className="mt-8 inline-flex min-h-11 items-center gap-1.5 text-[14px] text-white/45 transition hover:text-[#f4f1ea] lg:min-h-0"
            >
              Açık pozisyonlara git
              <OutArrow className="size-3.5" />
            </a>
          </div>
        </div>
      </section>

      {/* How we work */}
      <section className="relative z-10">
        <div className="page-x mx-auto max-w-7xl pb-20 sm:pb-28">
          <p className={eyebrow}>Nasıl çalışıyoruz</p>
          <ul className="mt-6 grid gap-px overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/10 sm:grid-cols-3">
            {principles.map((item) => (
              <li key={item.title} className="bg-[#171313] px-6 py-8 sm:px-7 sm:py-9">
                <p className="font-display text-[1.2rem] font-bold leading-[1.15] tracking-[-0.03em]">
                  {item.title}
                </p>
                <p className="mt-3 text-[14.5px] leading-7 text-white/55">
                  {item.text}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Open positions */}
      <section id="pozisyonlar" className="relative z-10 scroll-mt-24">
        <div className="page-x mx-auto max-w-7xl border-t border-white/10 pb-24 pt-16 sm:pb-32 sm:pt-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e91825]">
                Açık pozisyonlar
              </p>
              <h2 className="mt-5 font-display text-[clamp(1.8rem,4vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.05em]">
                Şu an aradığımız ekip arkadaşları.
              </h2>
            </div>
            <p className="text-[14px] text-white/45">
              {positions.length} açık pozisyon
            </p>
          </div>

          <ul className="mt-10 space-y-4">
            {positions.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/kariyer/${p.slug}`}
                  className="group flex flex-col gap-5 rounded-[1.5rem] border border-white/10 bg-white/[0.025] px-6 py-6 transition hover:border-[#e91825]/60 hover:bg-white/[0.04] sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-7"
                >
                  <div className="min-w-0">
                    <p className="font-display text-[clamp(1.35rem,2.6vw,1.8rem)] font-bold leading-[1.1] tracking-[-0.04em] transition group-hover:text-[#f4f1ea]">
                      {p.title}
                    </p>
                    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-white/50">
                      <li>{p.department}</li>
                      <li>{p.employment}</li>
                      <li>{p.workModel}</li>
                      <li>{p.location}</li>
                    </ul>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f4f1ea]/80 transition group-hover:text-[#e91825]">
                    İncele ve başvur
                    <OutArrow className="size-3 text-current" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-12 border-t border-white/10 pt-10">
            <p className="max-w-xl text-[15px] leading-8 text-white/50 sm:text-[16px]">
              Sana uyan bir pozisyon yok ama ekibimizde olmak istiyorsan
              özgeçmişini ve kısa bir notu bize gönder. Uygun bir rol
              açıldığında seninle iletişime geçeriz.
            </p>
            <a
              href="mailto:info@593emarketing.com?subject=Genel%20ba%C5%9Fvuru"
              className="mt-6 inline-flex min-h-11 items-center gap-1.5 text-[14px] text-white/45 transition hover:text-[#f4f1ea] lg:min-h-0"
            >
              info@593emarketing.com
              <OutArrow className="size-3.5" />
            </a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
