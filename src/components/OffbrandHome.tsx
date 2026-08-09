"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import CursorDot from "./CursorDot";

const LogoOrb = dynamic(() => import("./LogoOrb"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto aspect-square h-full w-full animate-pulse rounded-full bg-[#e91825]/25" />
  ),
});

const services = [
  {
    title: "Web Tasarım",
    image: "/services/web-tasarim.jpg",
    line: "İlk saniyeden dönüşüme kadar tüm dijital deneyimi tasarlıyoruz: site, ürün arayüzü ve teknik yapı tek bir sistem gibi çalışır; marka her ekranda aynı netlikte görünür.",
  },
  {
    title: "Dijital Pazarlama",
    image: "/services/dijital-pazarlama.jpg",
    line: "Reklam bütçesini rastgele harcamaz, ölçülebilir büyüme kurgularız. Kanal, mesaj ve hedef kitle aynı ritimde ilerler; her hamle rapora bağlanır.",
  },
  {
    title: "SEO",
    image: "/services/seo.jpg",
    line: "Arama sonuçlarında görünmek yetmez; doğru niyetle bulunmanı sağlar. İçerik, teknik altyapı ve otoriteyi birlikte büyütürüz ki trafik kalıcı olsun.",
  },
  {
    title: "Sosyal Medya",
    image: "/services/sosyal-medya.jpg",
    line: "Akışta kaybolan içerik değil, markanı tanıtan bir yayın düzeni kurarız. Ton, tempo ve topluluk aynı çizgide yürür; her paylaşım bir sonraki adımı hazırlar.",
  },
  {
    title: "Kreatif İçerik",
    image: "/services/kreatif-icerik.jpg",
    line: "Fotoğraf, video ve metni tek bir hikâyenin parçası gibi üretiriz. Her kare markanın sesini netleştirir, her satır aynı dünyada durur.",
  },
  {
    title: "Infofluencer",
    image: "/services/infofluencer.jpg",
    line: "Doğru isimle, veriye dayalı iş birlikleri kurarız. Hedef ham etkileşim değil; ölçülebilir dönüşüm ve markaya yakışan bir eşleşmedir.",
  },
];

const testimonials = [
  {
    quote:
      "593 EMarketing ile çalışmaya başladığımızda ilk olarak kurumsal web sitemiz ve e-ticaret altyapımız profesyonel şekilde kuruldu. SEO, Google Ads, Meta Ads, kreatif çekim hizmetleri ve sosyal medya yönetimiyle tüm süreç tek elden yürüdü.",
    company: "Tevalli Parasol's",
    name: "Mehmet Emin Türk",
    logo: "/testimonials/tevalli-parasols.png",
  },
  {
    quote:
      "593 eMarketing ile çalışmaya başladıktan sonra dijital görünürlüğümüz büyük ölçüde arttı. SEO, web site tasarımı, Google Ads, Meta Ads, TikTok Ads, LinkedIn Ads ve kreatif çekim hizmetleriyle markamız dijitalde net bir ivme kazandı.",
    company: "Endospine İstanbul",
    name: "Op. Dr. Eyüp Baykara",
    logo: "/testimonials/endospine-istanbul.webp",
  },
  {
    quote:
      "593 EMarketing ile çalışmaya başladığımızdan beri tüm dijital ihtiyaçlarımız tek elde toplandı. SEO, web site tasarımı, Google Ads, Meta Ads, TikTok Ads, LinkedIn Ads ve kreatif çekim aynı ritimde ilerliyor.",
    company: "Armonia Davet",
    name: "Armonia Davet Şirketler Grubu",
    logo: "/testimonials/armonia-davet.png",
  },
  {
    quote:
      "593 EMarketing ile yürüttüğümüz tercih dönemi kampanyasında TikTok Ads, LinkedIn Ads, Meta Ads ve Google Ads kanallarında kapsamlı bir strateji uyguladık. Kısa sürede yüksek görünürlük elde ederek hedef kitleye doğru anda ulaştık.",
    company: "Yıldız Teknik Üniversitesi",
    name: "Yıldız Teknik Üniversitesi",
    logo: "/testimonials/yildiz-teknik.png",
  },
  {
    quote:
      "593 EMarketing ile çalışmaya başladıktan sonra dijital pazarlama gücümüzü katladık. SEO, web site tasarımı, Google Ads, Meta Ads, TikTok Ads, kreatif çekim hizmetleri ve sosyal medya yönetimiyle tüm kanallar birlikte büyüdü.",
    company: "Ramtech Bilgisayar",
    name: "Murat Şengül",
    logo: "/testimonials/ramtech-bilgisayar.png",
  },
];

function smoothstep(t: number) {
  const p = Math.min(1, Math.max(0, t));
  return p * p * (3 - 2 * p);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function LetterText({
  text,
  className,
  tone = "solid",
}: {
  text: string;
  className?: string;
  tone?: "solid" | "muted";
}) {
  return (
    <span className={className}>
      {Array.from(text).map((ch, i) => (
        <span
          key={`${ch}-${i}`}
          data-letter
          data-tone={tone}
          className="text-[#141111]"
        >
          {ch === " " ? " " : ch}
        </span>
      ))}
    </span>
  );
}

export default function OffbrandHome() {
  const orbRef = useRef<HTMLDivElement>(null);
  const ringsRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const manifestoRef = useRef<HTMLElement>(null);
  const manifestoCopyRef = useRef<HTMLDivElement>(null);
  const servicesRef = useRef<HTMLElement>(null);
  const cardsStageRef = useRef<HTMLDivElement>(null);
  const servicesCopyRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLElement>(null);
  const closeCopyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const orb = orbRef.current;
    if (!orb) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let running = true;
    let base = Math.min(window.innerWidth * 0.82, 38 * 16);
    let tx = window.innerWidth / 2;
    let ty = window.innerHeight * 0.54;
    let ts = 1;
    let tp = 0;
    let textT = 0;
    let cardsT = 0;
    let copyT = 0;
    let closeT = 0;
    let x = tx;
    let y = ty;
    let s = ts;
    let fp = 0;
    let textP = 0;
    let cardsP = 0;
    let copyP = 0;
    let closeP = 0;
    let last = performance.now();

    const layout = () => {
      base = Math.min(window.innerWidth * 0.82, 38 * 16);
      orb.style.width = `${base}px`;
      orb.style.height = `${base}px`;
      readTarget();
    };

    const readTarget = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cover = Math.min(w * 0.82, h * 1.25);
      const scaleBig = cover / base;

      const hero = { x: w * 0.5, y: h * 0.54, s: 1 };
      const man = { x: w * 0.82, y: h * 0.5, s: scaleBig };
      const svc = { x: w * 0.18, y: h * 0.5, s: scaleBig };
      const close = { x: w * 0.82, y: h * 0.78, s: scaleBig };

      const manEl = manifestoRef.current;
      const svcEl = servicesRef.current;
      const closeEl = closeRef.current;
      const manTop = manEl ? manEl.getBoundingClientRect().top + window.scrollY : h;
      const manH = manEl?.offsetHeight ?? h;
      const svcTop = svcEl ? svcEl.getBoundingClientRect().top + window.scrollY : manTop + manH;
      const svcH = svcEl?.offsetHeight ?? h * 7;
      const closeTop = closeEl
        ? closeEl.getBoundingClientRect().top + window.scrollY
        : svcTop + svcH;
      const yArrive = Math.max(1, manTop - h * 0.12);
      const yText = Math.max(yArrive + 1, manTop + h * 0.08);
      const yReveal = Math.max(yText + 1, manTop + manH * 0.5);
      const yLeave = Math.max(yReveal + 1, svcTop - h * 0.08);
      const yCards = Math.max(yLeave + 1, svcTop + h * 0.18);
      const yCardsEnd = Math.max(yCards + 1, svcTop + svcH - h * 0.12);
      const yClose = Math.max(yLeave + 1, Math.min(yCardsEnd - h * 0.08, closeTop - h * 0.82));
      const yCloseArrive = Math.max(yClose + 1, closeTop - h * 0.48);
      const sy = window.scrollY;

      let a = hero;
      let b = man;
      let t = sy / yArrive;
      let fade = t;
      let reveal = 0;
      let closeReveal = 0;

      if (sy >= yArrive && sy < yText) {
        a = man;
        b = man;
        t = 1;
        fade = 1;
        reveal = 0;
      } else if (sy >= yText && sy < yReveal) {
        a = man;
        b = man;
        t = 1;
        fade = 1;
        reveal = (sy - yText) / (yReveal - yText);
      } else if (sy >= yReveal && sy < yClose) {
        a = man;
        b = svc;
        t = Math.min(1, (sy - yReveal) / (yLeave - yReveal));
        fade = 1;
        reveal = 1;
      } else if (sy >= yClose) {
        a = svc;
        b = close;
        t = Math.min(1, (sy - yClose) / (yCloseArrive - yClose));
        fade = 1;
        reveal = 1;
        closeReveal = t;
      }

      t = reduced ? (t > 0.45 ? 1 : 0) : smoothstep(t);
      reveal = reduced ? (reveal > 0.2 ? 1 : 0) : smoothstep(reveal);
      tx = a.x + (b.x - a.x) * t;
      ty = a.y + (b.y - a.y) * t;
      ts = a.s + (b.s - a.s) * t;
      tp = Math.min(1, Math.max(0, fade));
      textT = reveal;
      const cards = sy <= yCards ? 0 : (sy - yCards) / (yCardsEnd - yCards);
      cardsT = reduced ? (cards > 0.08 ? 1 : 0) : Math.min(1, Math.max(0, cards));
      closeT = reduced ? (closeReveal > 0.2 ? 1 : 0) : smoothstep(closeReveal);
      const copyStart = yLeave - h * 0.18;
      copyT =
        sy <= copyStart
          ? 0
          : reduced
            ? sy > yLeave
              ? 1
              : 0
            : Math.min(1, Math.max(0, (sy - copyStart) / (yCards - copyStart)));
    };

    const applyCards = (p: number, w: number) => {
      const layer = cardsStageRef.current;
      if (!layer) return;
      const els = layer.querySelectorAll<HTMLElement>("[data-service-card]");
      const n = services.length;
      let active = -1;

      els.forEach((el, i) => {
        const local = p * n - i * 0.88;
        if (local >= 0) active = i;

        let opacity = 0;
        let slideX = w * 0.55;

        if (local >= 0 && local < 1.05) {
          if (local < 0.28) {
            const t = smoothstep(local / 0.28);
            opacity = Math.min(1, t * 1.5);
            slideX = lerp(w * 0.55, 0, t);
          } else if (local < 0.62) {
            opacity = 1;
            slideX = 0;
          } else {
            const t = smoothstep(Math.min(1, (local - 0.62) / 0.3));
            opacity = 1 - t;
            slideX = lerp(0, -w * 0.08, t);
          }
        }

        const hide = 1 - closeP;
        el.style.opacity = String(opacity * hide);
        el.style.transform = `translate3d(${slideX}px, -50%, 0)`;
      });

      const copy = servicesCopyRef.current;
      if (copy) {
        const showIntro = copyP * (active >= 0 ? 0 : 1);
        copy.style.opacity = String(showIntro);
        copy.style.transform = `translate3d(0, ${(1 - copyP) * 16}px, 0)`;
      }
    };

    const tick = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const follow = reduced ? 1 : 1 - Math.exp(-7.5 * dt);
      x += (tx - x) * follow;
      y += (ty - y) * follow;
      s += (ts - s) * follow;
      fp += (tp - fp) * follow;
      textP += (textT - textP) * follow;
      cardsP += (cardsT - cardsP) * follow;
      copyP += (copyT - copyP) * follow;
      closeP += (closeT - closeP) * follow;

      orb.style.transform = `translate3d(${x - base / 2}px, ${y - base / 2}px, 0) scale(${s})`;
      if (ringsRef.current) ringsRef.current.style.opacity = String(1 - fp);
      if (hintRef.current) hintRef.current.style.opacity = String(1 - fp);

      const copy = manifestoCopyRef.current;
      if (copy) {
        const letters = copy.querySelectorAll<HTMLElement>("[data-letter]");
        const n = letters.length || 1;
        const cursor = textP * n;
        letters.forEach((el, i) => {
          const local = Math.min(1, Math.max(0, cursor - i));
          const e = local * local * (3 - 2 * local);
          const muted = el.dataset.tone === "muted";
          const r = Math.round(20 + e * (244 - 20));
          const g = Math.round(17 + e * (241 - 17));
          const b = Math.round(17 + e * (234 - 17));
          const a = muted ? 1 - e * 0.55 : 1;
          el.style.color = `rgba(${r}, ${g}, ${b}, ${a})`;
        });
      }

      applyCards(cardsP, window.innerWidth);

      const closeCopy = closeCopyRef.current;
      if (closeCopy) {
        closeCopy.style.opacity = String(closeP);
        closeCopy.style.transform = `translate3d(${(1 - closeP) * -28}px, 0, 0)`;
      }

      const h = window.innerHeight;
      const headEl = closeCopyRef.current?.parentElement;
      const cut = headEl ? headEl.getBoundingClientRect().bottom : h * 0.22;
      const fadeBand = Math.max(36, h * 0.05);
      closeRef.current?.querySelectorAll<HTMLElement>("[data-testimonial]").forEach((el) => {
        if (closeP < 0.02) {
          el.style.opacity = "0";
          el.style.transform = "translate3d(0, 28px, 0)";
          return;
        }
        const top = el.getBoundingClientRect().top;
        const enter = Math.min(1, Math.max(0, (h - top) / Math.max(48, h * 0.07)));
        const leave = Math.min(1, Math.max(0, (top - cut + 8) / fadeBand));
        const e = smoothstep(enter) * smoothstep(leave) * closeP;
        el.style.opacity = String(e);
        el.style.transform = `translate3d(0, ${(1 - smoothstep(enter)) * 18}px, 0)`;
      });

      raf = requestAnimationFrame(tick);
    };

    const onScroll = () => readTarget();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", layout);
    layout();
    cardsStageRef.current?.querySelectorAll("img").forEach((img) => {
      if (!img.complete) img.addEventListener("load", layout, { once: true });
    });
    x = tx;
    y = ty;
    s = ts;
    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", layout);
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#141111] text-[#f4f1ea]">
      <CursorDot />

      <div
        ref={orbRef}
        className="pointer-events-none fixed top-0 left-0 z-[5] origin-center will-change-transform"
        style={{ width: "min(82vw, 38rem)", height: "min(82vw, 38rem)" }}
      >
        <div className="pointer-events-auto h-full w-full">
          <LogoOrb />
        </div>
      </div>

      <div
        ref={cardsStageRef}
        className="pointer-events-none fixed inset-y-0 right-0 z-[4] flex w-1/2 items-center px-4 sm:px-6 lg:px-10"
      >
        {services.map((service) => (
          <article
            key={service.title}
            data-service-card
            className="absolute inset-x-4 top-1/2 w-[calc(100%-2rem)] opacity-0 will-change-transform sm:inset-x-6 sm:w-[calc(100%-3rem)] lg:inset-x-10 lg:w-[calc(100%-5rem)]"
          >
            <div
              data-card-visual
              className="relative h-[min(62vh,36rem)] w-full overflow-hidden rounded-[1.75rem] bg-[#111]"
            >
              <img
                src={service.image}
                alt={service.title}
                className="h-full w-full origin-center object-cover will-change-transform"
              />
            </div>
            <div data-card-caption className="mt-5 w-full text-left">
              <h3 className="font-display text-[clamp(1.35rem,2.2vw,1.9rem)] font-bold tracking-[-0.04em] text-[#f4f1ea]">
                {service.title}
              </h3>
              <p className="mt-2 w-full text-[14px] leading-6 text-white/50 sm:text-[15px] sm:leading-7">
                {service.line}
              </p>
            </div>
          </article>
        ))}
      </div>

      <div
        ref={servicesCopyRef}
        className="pointer-events-none fixed top-1/2 right-0 z-[4] w-1/2 -translate-y-1/2 px-4 text-left opacity-0 will-change-transform sm:px-6 lg:px-10"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
          Hizmetler
        </p>
        <h2 className="mt-3 font-display text-[clamp(1.8rem,3vw,2.6rem)] font-bold tracking-[-0.05em] text-[#f4f1ea]">
          Hizmetlerimiz
        </h2>
        <p className="mt-2 max-w-md text-[15px] leading-7 text-white/50">
          Markanın her katmanını tek bir ritimde kuruyoruz.
        </p>
      </div>

      {/* HERO — orb + blend-mode slogan (Off+Brand approach) */}
      <section className="relative min-h-dvh overflow-hidden bg-[#141111] text-[#f4f1ea]">
        <div className="relative z-30 flex w-full items-center justify-between pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(1rem,env(safe-area-inset-top))] sm:pr-6 lg:pr-8">
          <Link
            href="/"
            className="font-logo text-[clamp(1.35rem,3.4vw,2.1rem)] font-bold leading-none tracking-[-0.02em] text-[#f4f1ea]"
          >
            593 E-MARKETİNG
          </Link>
          <nav className="flex items-center">
            <Link
              href="#contact"
              className="rounded-full bg-[#f4f1ea] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#141111] transition duration-300 hover:bg-[#e91825] hover:text-white sm:px-6 sm:py-3"
            >
              İletişim
            </Link>
          </nav>
        </div>

        <div className="relative mx-auto flex min-h-[calc(100dvh-4.5rem)] max-w-7xl items-center justify-center px-4 pb-16 pt-4 sm:px-6">
          <div
            ref={ringsRef}
            className="pointer-events-none absolute inset-0 z-0"
          >
            <div className="absolute left-1/2 top-1/2 aspect-square w-[min(92vw,42rem)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.08]" />
            <div className="absolute left-1/2 top-1/2 aspect-square w-[min(78vw,34rem)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.1]" />
            <div className="absolute left-1/2 top-1/2 aspect-square w-[min(64vw,26rem)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.12]" />
          </div>

          <h1 className="pointer-events-none absolute inset-0 z-20 mix-blend-difference">
            <span className="sr-only">Strateji, Tasarım, Dönüşüm</span>
            <span
              aria-hidden
              className="absolute left-0 top-[14%] font-display text-[clamp(2.6rem,11vw,7.5rem)] font-semibold leading-[0.85] tracking-[-0.05em] text-white sm:-left-[2%] sm:top-[16%] md:-left-[4%] lg:-left-[6%]"
            >
              TASARIM
            </span>
            <span
              aria-hidden
              className="absolute -right-[2%] top-[40%] text-right font-display text-[clamp(2.6rem,11vw,7.5rem)] font-semibold leading-[0.85] tracking-[-0.05em] text-white sm:-right-[3%] sm:top-[38%] md:-right-[4%] lg:-right-[5%]"
            >
              STRATEJİ
            </span>
            <span
              aria-hidden
              className="absolute bottom-[18%] left-1/2 w-full -translate-x-1/2 text-center font-display text-[clamp(2.4rem,10.5vw,7rem)] font-semibold leading-[0.85] tracking-[-0.05em] text-white sm:bottom-[16%]"
            >
              DÖNÜŞÜM
            </span>
          </h1>

          <div
            ref={hintRef}
            className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-30 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40 sm:right-8"
          >
            Kaydır ↓
          </div>
        </div>
      </section>

      <section
        ref={manifestoRef}
        id="manifesto"
        className="relative z-0 min-h-[220vh] border-y border-white/8 bg-[#141111] text-[#141111]"
      >
        <div className="sticky top-0 flex min-h-dvh items-center px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div
            ref={manifestoCopyRef}
            className="relative z-10 w-full max-w-[min(40rem,52vw)] pr-4 sm:pr-6 lg:max-w-[min(44rem,48vw)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">
              <LetterText text="Manifesto" tone="muted" />
            </p>
            <div className="mt-6">
              <p className="font-display text-[clamp(2rem,4.6vw,4.2rem)] font-bold leading-[0.95] tracking-[-0.06em]">
                <LetterText text="Dikkat çeken değil, akılda kalan markalar tasarlıyoruz." />
              </p>
              <p className="mt-6 max-w-xl text-base leading-7 sm:text-lg">
                <LetterText text="Her temas noktasını tekil bir kampanya gibi değil, bir sistem gibi ele alıyoruz. Tasarım, yazılım ve büyüme tarafları tek bir ritimde çalıştığında markalar daha güçlü görünür." />
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        ref={servicesRef}
        id="services"
        className="relative z-0 min-h-[380vh] bg-[#141111]"
      />

      <section
        ref={closeRef}
        id="contact"
        className="relative z-0 min-h-[280vh] bg-[#141111] px-4 pb-24 sm:px-6 lg:px-8"
      >
        <div className="w-full max-w-[min(40rem,52vw)] pr-4 sm:pr-6">
          <div className="sticky top-0 z-[3] pt-8 sm:pt-10 lg:pt-12">
            <div className="relative bg-[#141111] pb-5">
              <div
                ref={closeCopyRef}
                className="opacity-0 will-change-transform"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                  Müşteri Memnuniyeti
                </p>
                <h2 className="mt-4 font-display text-[clamp(2rem,4.4vw,3.6rem)] font-bold leading-[0.95] tracking-[-0.06em] text-[#f4f1ea]">
                  593 Hakkında
                </h2>
              </div>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-[-1.25rem] top-full h-10 bg-gradient-to-b from-[#141111] to-transparent sm:inset-x-[-1.5rem]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-10 pt-[42vh] pb-[70vh]">
            {testimonials.map((item) => (
              <article
                key={item.company}
                data-testimonial
                className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#1c1818] p-7 opacity-0 will-change-transform sm:p-8"
              >
                <span
                  aria-hidden
                  className="font-display text-[5rem] leading-[0.7] text-[#e91825]/40"
                >
                  “
                </span>
                <p className="mt-5 font-display text-[clamp(1.05rem,2.1vw,1.28rem)] font-medium leading-[1.45] tracking-[-0.035em] text-[#f4f1ea]">
                  {item.quote}
                </p>
                <div className="mt-8 flex items-center gap-4 border-t border-white/10 pt-5">
                  <div className="size-14 shrink-0 overflow-hidden rounded-2xl bg-[#f4f1ea] p-1.5">
                    <img
                      src={item.logo}
                      alt={item.company}
                      className="size-full object-contain grayscale contrast-125"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[#f4f1ea]">
                      {item.company}
                    </p>
                    <p className="mt-0.5 truncate text-[13px] text-white/45">
                      {item.name}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4 pb-10">
            <Link
              href="mailto:hello@593emarketing.com"
              className="rounded-full bg-[#f4f1ea] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#141111] transition duration-300 hover:bg-[#e91825] hover:text-white"
            >
              İletişim
            </Link>
            <a
              href="mailto:hello@593emarketing.com"
              className="text-sm text-white/50 transition hover:text-[#f4f1ea]"
            >
              hello@593emarketing.com
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
