"use client";

import Image from "next/image";
import { useState } from "react";

const services = [
  {
    title: "Dijital Pazarlama",
    code: "01",
    detail: "Veriye dayalı kampanyalarla markanızı doğru hedef kitleyle buluşturuyoruz.",
  },
  {
    title: "Web & UI/UX",
    code: "02",
    detail: "Markanıza özgü, hızlı ve dönüşüm odaklı dijital deneyimler tasarlıyoruz.",
  },
  {
    title: "SEO & Strateji",
    code: "03",
    detail: "Arama sonuçlarında kalıcı görünürlük sağlayan stratejiler geliştiriyoruz.",
  },
  {
    title: "Sosyal Medya",
    code: "04",
    detail: "Markanızın sesini güçlendiren içerikler ve topluluklar oluşturuyoruz.",
  },
  {
    title: "Kreatif İçerik",
    code: "05",
    detail: "Dikkat çeken fotoğraf, video ve yaratıcı fikirlerle markanızı anlatıyoruz.",
  },
  {
    title: "Infofluencer",
    code: "06",
    detail: "Doğru içerik üreticilerini markanızla bir araya getirerek etkiyi büyütüyoruz.",
  },
];

export default function ServiceShowcase() {
  const [active, setActive] = useState(0);
  const service = services[active];

  return (
    <div
      className="hover-showcase animate-fade-up-delay-2 relative aspect-[1.18] w-full max-w-[520px] overflow-hidden rounded-[2rem] border border-white/20 bg-white/[0.055] outline-none backdrop-blur-[22px]"
      role="region"
      aria-label="593 EMarketing hizmetleri"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-accent/[0.06]" />

      <div className="relative z-10 flex h-full flex-col p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55">
            Hizmetlerimiz
          </span>
          <span className="font-mono text-[10px] text-white/45">
            {service.code} / 06
          </span>
        </div>

        <div className="flex flex-1 items-center justify-between gap-8 py-7">
          <div className="min-w-0 max-w-[300px]">
            <h2
              key={service.title}
              className="showcase-title font-display text-[clamp(2rem,4vw,3.25rem)] font-semibold leading-[0.95] tracking-[-0.05em] text-white"
            >
              {service.title}
            </h2>
            <p
              key={service.detail}
              className="hover-detail mt-5 max-w-[270px] text-xs leading-relaxed text-white/55 sm:text-sm"
            >
              {service.detail}
            </p>
          </div>

          <div className="relative flex aspect-square w-24 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/15 sm:w-28">
            <div className="animate-spin-slow absolute inset-0">
              <svg viewBox="0 0 100 100" className="h-full w-full">
                <defs>
                  <path
                    id="cardCirclePath"
                    d="M 50, 50 m -36, 0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0"
                  />
                </defs>
                <text className="fill-accent text-[8px] font-medium uppercase tracking-[0.17em]">
                  <textPath href="#cardCirclePath">
                    Keşfet · Keşfet · Keşfet · Keşfet ·
                  </textPath>
                </text>
              </svg>
            </div>
            <Image
              src="/593-logo.png"
              alt="593 EMarketing"
              width={44}
              height={44}
              className="relative z-10 h-10 w-10 object-contain sm:h-11 sm:w-11"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 border-t border-white/15 pt-4 sm:grid-cols-3">
          {services.map((item, index) => (
            <button
              key={item.code}
              type="button"
              onPointerEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onClick={() => setActive(index)}
              className={`border-b border-white/10 py-2.5 text-left text-[10px] transition-colors duration-200 sm:text-[11px] ${
                index % 3 !== 2
                  ? "sm:border-r sm:border-white/10 sm:px-3"
                  : "sm:pl-3"
              } ${
                index % 2 === 1
                  ? "max-sm:pl-3"
                  : "max-sm:border-r max-sm:border-white/10"
              } ${
                active === index
                  ? "text-accent"
                  : "text-white/50 hover:text-white"
              }`}
              aria-pressed={active === index}
            >
              {item.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
