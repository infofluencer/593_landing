"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import CursorDot from "./CursorDot";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import MobileActionDock from "./MobileActionDock";
import { infofluencerService, services } from "@/data/services";

const LogoOrb = dynamic(() => import("./LogoOrb"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto aspect-square h-full w-full animate-pulse rounded-full bg-[#e91825]/25" />
  ),
});

const infofluencer = infofluencerService;

const infoGallery = [
  {
    thumb: "/infofluencer/Db53F7GDobq.jpg",
    href: "https://www.instagram.com/infofluencertr/p/Db53F7GDobq/",
    label: "Instagram",
    video: true,
  },
  {
    thumb: "/infofluencer/influencer-1.jpeg",
    href: "https://infofluencer.co/tr",
    label: "Infofluencer",
    video: false,
  },
  {
    thumb: "/infofluencer/DZfx7xWOq_8.jpg",
    href: "https://www.instagram.com/infofluencertr/reel/DZfx7xWOq_8/",
    label: "Reel",
    video: true,
  },
  {
    thumb: "/infofluencer/influencer-17.jpeg",
    href: "https://infofluencer.co/tr",
    label: "Infofluencer",
    video: false,
  },
  {
    thumb: "/infofluencer/Db3ZyofDIaU.jpg",
    href: "https://www.instagram.com/infofluencertr/p/Db3ZyofDIaU/",
    label: "Instagram",
    video: true,
  },
  {
    thumb: "/infofluencer/influencer-4.jpeg",
    href: "https://infofluencer.co/tr",
    label: "Infofluencer",
    video: false,
  },
  {
    thumb: "/infofluencer/DZIMAqism3e.jpg",
    href: "https://www.instagram.com/infofluencertr/reel/DZIMAqism3e/",
    label: "Reel",
    video: true,
  },
  {
    thumb: "/infofluencer/influencer-2.jpeg",
    href: "https://infofluencer.co/tr",
    label: "Infofluencer",
    video: false,
  },
  {
    thumb: "/infofluencer/DbBYerXtPR-.jpg",
    href: "https://www.instagram.com/infofluencertr/reel/DbBYerXtPR-/",
    label: "Reel",
    video: true,
  },
  {
    thumb: "/infofluencer/influencer-5.jpeg",
    href: "https://infofluencer.co/tr",
    label: "Infofluencer",
    video: false,
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
    logo: "/testimonials/endospine-istanbul.png",
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

const brands = [
  {
    name: "Tevalli Parasol's",
    logo: "/brands/tevalli-parasols.png",
    href: "https://593emarketing.com/portfolio/tevalli-parasols-yaz-kampanyasi/",
  },
  {
    name: "Endospine İstanbul",
    logo: "/brands/endospine-istanbul.png",
    href: "https://593emarketing.com/portfolio/endospine-istanbul-dijital-pazarlama-yolculugu/",
  },
  {
    name: "Armonia Davet",
    logo: "/brands/armonia-davet.png",
    href: "https://593emarketing.com/projeler/",
  },
  {
    name: "Yıldız Teknik Üniversitesi",
    logo: "/brands/yildiz-teknik.png",
    href: "https://593emarketing.com/portfolio/yildiz-teknik-universitesi/",
  },
  {
    name: "Ramtech Bilgisayar",
    logo: "/brands/ramtech-bilgisayar.png",
    href: "https://593emarketing.com/portfolio/ramtech-bilgisayar-okula-donus-kampanyasi/",
  },
  {
    name: "Türkler Şemsiye",
    logo: "/brands/turkler-semsiye.png",
    href: "https://593emarketing.com/portfolio/1742-2/",
  },
  {
    name: "Zeynep Özel Bridal",
    logo: "/brands/zeynep-ozel.png",
    href: "https://593emarketing.com/portfolio/zeynep-ozel-bridal-dijital-donusum-sureci/",
  },
  {
    name: "MAREEN",
    logo: "/brands/mareen.png",
    href: "https://593emarketing.com/portfolio/mareen-marka-insasi-ve-performans-odakli-e-ticaret-sistemi/",
  },
  {
    name: "Güler Kuyumculuk",
    logo: "/brands/guler-kuyumculuk.png",
    href: "https://593emarketing.com/portfolio/guler-kuyumculuk-anlik-altin-kuru-entegrasyonlu-e-ticaret-sistemi/",
  },
  {
    name: "Bahex Mobilya",
    logo: "/brands/bahex-mobilya.png",
    href: "https://bahexmobilya.com/",
  },
  {
    name: "Yedi Mavi Cadde",
    logo: "/brands/yedi-mavi-cadde.png",
    href: "https://www.yedimavicadde.com/",
  },
  {
    name: "Anadolu Hastaneleri",
    logo: "/brands/anadolu-hastaneleri.png",
    href: "https://www.anadoluhastaneleri.com/",
  },
  {
    name: "Suare Davet",
    logo: "/brands/suare-davet.png",
    href: "https://suaredavet.co/",
  },
  {
    name: "Mokan Travel",
    logo: "/brands/mokan-travel.svg",
    href: "https://www.mokantravel.com/tr",
  },
  {
    name: "Op. Dr. Eyüp Baykara",
    logo: "/brands/eyup-baykara.png",
    href: "https://www.eyupbaykara.com/",
  },
  {
    name: "Infofluencer",
    logo: "/brands/infofluencer.svg",
    href: "https://infofluencer.co/tr",
  },
  {
    name: "Sekiz Ocakbaşı",
    logo: "/brands/sekiz-ocakbasi.png",
    href: "https://sekizocakbasi.com/",
  },
  {
    name: "Bi Anne Atölyesi",
    logo: "/brands/bi-anne-atolyesi.png",
    href: "https://593emarketing.com/portfolio/bi-anne-atolyesi-2021den-bugune-dijital-buyume-yolculugu/",
  },
];

function smoothstep(t: number) {
  const p = Math.min(1, Math.max(0, t));
  return p * p * (3 - 2 * p);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp01(t: number) {
  return Math.min(1, Math.max(0, t));
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
  const servicesHeadingRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLElement>(null);
  const infoStageRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLElement>(null);
  const closeCopyRef = useRef<HTMLDivElement>(null);
  const quotesPinRef = useRef<HTMLDivElement>(null);
  const quotesRailRef = useRef<HTMLDivElement>(null);
  const quotesBarRef = useRef<HTMLSpanElement>(null);
  const quotesCountRef = useRef<HTMLSpanElement>(null);
  const brandsRef = useRef<HTMLElement>(null);
  const [activeBrand, setActiveBrand] = useState<(typeof brands)[number] | null>(
    null,
  );
  // Phones get plain enter-on-scroll reveals instead of the desktop rAF rig.
  useEffect(() => {
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]:not([data-in])"),
    );
    if (!targets.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-in", "");
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const orb = orbRef.current;
    if (!orb) return;

    const wide = window.matchMedia("(min-width: 768px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let desktop = wide.matches;
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
    let infoT = 0;
    let infoLiftT = 0;
    let infoGalleryT = 0;
    let closeT = 0;
    let orbVisT = 1;
    let svcExitT = 0;
    let railT = 0;
    let x = tx;
    let y = ty;
    let s = ts;
    let fp = 0;
    let textP = 0;
    let cardsP = 0;
    let copyP = 0;
    let infoP = 0;
    let infoLiftP = 0;
    let infoGalleryP = 0;
    let closeP = 0;
    let orbVisP = 1;
    let svcExitP = 0;
    let railP = 0;
    let railSpan = 0;
    let railShown = -1;
    let railMeasured = false;
    let last = performance.now();

    // Querying these every frame was the single biggest cost in the loop.
    let letters: HTMLElement[] = [];
    let letterColors: string[] = [];
    let cards: HTMLElement[] = [];
    let quotes: HTMLElement[] = [];
    let infoLogo: HTMLElement | null = null;
    let infoCopy: HTMLElement | null = null;
    let infoGrid: HTMLElement | null = null;
    let infoCards: HTMLElement[] = [];

    const cache = () => {
      letters = Array.from(
        manifestoCopyRef.current?.querySelectorAll<HTMLElement>(
          "[data-letter]",
        ) ?? [],
      );
      letterColors = new Array(letters.length).fill("");
      cards = Array.from(
        cardsStageRef.current?.querySelectorAll<HTMLElement>(
          "[data-service-card]",
        ) ?? [],
      );
      quotes = Array.from(
        closeRef.current?.querySelectorAll<HTMLElement>("[data-testimonial]") ??
          [],
      );
      const stage = infoStageRef.current;
      infoLogo = stage?.querySelector<HTMLElement>("[data-info-media]") ?? null;
      infoCopy = stage?.querySelector<HTMLElement>("[data-info-copy]") ?? null;
      infoGrid = stage?.querySelector<HTMLElement>("[data-info-gallery]") ?? null;
      infoCards = Array.from(
        infoGrid?.querySelectorAll<HTMLElement>("[data-info-card]") ?? [],
      );
    };

    /** Drops every inline style the desktop rig owns, so CSS can take over. */
    const resetDesktopStyles = () => {
      for (const el of [
        ...cards,
        servicesHeadingRef.current,
        servicesCopyRef.current,
        closeCopyRef.current,
        ...quotes,
      ]) {
        if (!el) continue;
        el.style.opacity = "";
        el.style.transform = "";
      }
    };

    /** Distance the phone testimonial rail has to travel to show its last card. */
    const measureRail = () => {
      const rail = quotesRailRef.current;
      if (!rail) return;
      railMeasured = true;
      if (desktop) {
        railSpan = 0;
        rail.style.transform = "";
        return;
      }
      const prev = rail.style.transform;
      rail.style.transform = "none";
      const last = rail.lastElementChild as HTMLElement | null;
      const padEnd = parseFloat(getComputedStyle(rail).paddingRight) || 0;
      const contentRight = last
        ? last.getBoundingClientRect().right - rail.getBoundingClientRect().left
        : 0;
      railSpan = Math.max(0, contentRight + padEnd - rail.clientWidth);
      rail.style.transform = prev;
    };

    const layout = () => {
      desktop = wide.matches;
      base = Math.min(window.innerWidth * 0.82, 38 * 16);
      orb.style.width = `${base}px`;
      orb.style.height = `${base}px`;
      cache();
      if (!desktop) resetDesktopStyles();
      railMeasured = false;
      railShown = -1;
      measureRail();
      readTarget();
    };

    const sectionTop = (el: HTMLElement | null, fallback: number) =>
      el ? el.getBoundingClientRect().top + window.scrollY : fallback;

    const readTarget = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const sy = window.scrollY;

      const manEl = manifestoRef.current;
      const svcEl = servicesRef.current;
      const infoEl = infoRef.current;
      const closeEl = closeRef.current;
      const brandsEl = brandsRef.current;

      const manTop = sectionTop(manEl, h);
      const manH = manEl?.offsetHeight ?? h;
      const svcTop = sectionTop(svcEl, manTop + manH);
      const svcH = svcEl?.offsetHeight ?? h * 6;
      const infoTop = sectionTop(infoEl, svcTop + svcH);
      const infoH = infoEl?.offsetHeight ?? h * 2.2;
      const closeTop = sectionTop(closeEl, infoTop + infoH);
      const closeH = closeEl?.offsetHeight ?? h * 2;
      const brandsTop = sectionTop(brandsEl, closeTop + closeH);

      let a: { x: number; y: number; s: number };
      let b: { x: number; y: number; s: number };
      let t: number;
      let fade: number;
      let reveal = 0;
      let closeReveal = 0;
      let infoReveal = 0;
      let infoLift = 0;
      let infoGalleryOpen = 0;
      let orbVis = 1;
      let svcExit = 0;
      railT = 0;

      if (desktop) {
        const cover = Math.min(w * 0.82, h * 1.25);
        const scaleBig = cover / base;
        const scaleBrands = Math.min(w * 0.92, h * 1.05) / base;

        const hero = { x: w * 0.5, y: h * 0.54, s: 1 };
        const man = { x: w * 0.82, y: h * 0.5, s: scaleBig };
        const svc = { x: w * 0.18, y: h * 0.5, s: scaleBig };
        const vanish = { x: w * 0.5, y: h * 0.5, s: 0.04 };
        const close = { x: w * 0.82, y: h * 0.78, s: scaleBig };
        const brandsPos = { x: w * 0.5, y: 0, s: scaleBrands };

        const yArrive = Math.max(1, manTop - h * 0.12);
        const yText = Math.max(yArrive + 1, manTop + h * 0.08);
        const yReveal = Math.max(yText + 1, manTop + manH * 0.5);
        const yLeave = Math.max(yReveal + 1, svcTop - h * 0.08);
        const yCards = Math.max(yLeave + 1, svcTop + h * 0.18);
        const yCardsEnd = Math.max(yCards + 1, svcTop + svcH - h * 0.15);
        // Orb relocate windows: long scroll for shrink-out and bloom-back.
        const yOrbShrink = Math.max(yCardsEnd, infoTop - h * 0.25);
        const yOrbGone = yOrbShrink + h * 1.45;
        const yInfoIn = Math.max(yOrbGone + 1, infoTop + h * 0.2);
        const yInfoPeak = Math.max(yInfoIn + 1, infoTop + infoH * 0.48);
        const yClose = Math.max(yInfoPeak + h * 0.15, closeTop - h * 1.55);
        const yCloseArrive = yClose + h * 1.35;
        const yBrands = Math.max(yCloseArrive + 1, brandsTop - h * 0.65);
        const yBrandsArrive = Math.max(yBrands + 1, brandsTop - h * 0.2);

        a = hero;
        b = man;
        t = sy / yArrive;
        fade = t;

        if (sy >= yArrive && sy < yText) {
          a = man;
          b = man;
          t = 1;
          fade = 1;
        } else if (sy >= yText && sy < yReveal) {
          a = man;
          b = man;
          t = 1;
          fade = 1;
          reveal = (sy - yText) / (yReveal - yText);
        } else if (sy >= yReveal && sy < yOrbShrink) {
          a = man;
          b = svc;
          t = Math.min(1, (sy - yReveal) / (yLeave - yReveal));
          if (sy >= yLeave) {
            a = svc;
            b = svc;
            t = 1;
          }
          fade = 1;
          reveal = 1;
        } else if (sy >= yOrbShrink && sy < yOrbGone) {
          a = svc;
          b = vanish;
          t = (sy - yOrbShrink) / (yOrbGone - yOrbShrink);
          fade = 1;
          reveal = 1;
          orbVis = 1 - smoothstep(Math.pow(clamp01(t), 0.72));
          infoReveal = smoothstep(t) * 0.12;
        } else if (sy >= yOrbGone && sy < yClose) {
          a = vanish;
          b = vanish;
          t = 1;
          fade = 1;
          reveal = 1;
          orbVis = 0;
          const span = Math.max(1, yClose - yOrbGone);
          const p = clamp01((sy - yOrbGone) / span);
          // 0–0.18 enter · 0.18–0.38 logo lifts · 0.34–0.58 gallery · hold · out
          if (p < 0.18) {
            infoReveal = p / 0.18;
          } else if (p < 0.38) {
            infoReveal = 1;
            infoLift = (p - 0.18) / 0.2;
            infoGalleryOpen = Math.max(0, (p - 0.34) / 0.24);
          } else if (p < 0.72) {
            infoReveal = 1;
            infoLift = 1;
            infoGalleryOpen = Math.min(1, (p - 0.34) / 0.24);
          } else {
            infoLift = 1;
            infoGalleryOpen = 1;
            infoReveal = Math.max(0, 1 - (p - 0.72) / 0.22);
          }
        } else if (sy >= yClose && sy < yBrands) {
          a = vanish;
          b = close;
          t = Math.min(1, (sy - yClose) / (yCloseArrive - yClose));
          fade = 1;
          reveal = 1;
          closeReveal = Math.min(1, t / 0.42);
          orbVis = smoothstep(Math.pow(clamp01(t), 1.35));
          infoLift = 1;
        } else if (sy >= yBrands) {
          a = close;
          b = brandsPos;
          t = Math.min(1, (sy - yBrands) / (yBrandsArrive - yBrands));
          fade = 1;
          reveal = 1;
          closeReveal = 1;
          infoLift = 1;
        }

        const cardsRaw = sy <= yCards ? 0 : (sy - yCards) / (yCardsEnd - yCards);
        cardsT = reduced ? (cardsRaw > 0.08 ? 1 : 0) : clamp01(cardsRaw);
        svcExit =
          sy < yOrbShrink
            ? 0
            : sy >= yOrbGone
              ? 1
              : (sy - yOrbShrink) / (yOrbGone - yOrbShrink);
        const copyStart = yLeave - h * 0.18;
        copyT =
          sy <= copyStart
            ? 0
            : reduced
              ? sy > yLeave
                ? 1
                : 0
              : clamp01((sy - copyStart) / (yCards - copyStart));
      } else {
        // ---- Phone choreography -------------------------------------------
        // The orb is the only scroll-driven element; sections below it are
        // ordinary stacked layout with enter-on-scroll reveals.
        const scaleBig = Math.min(w * 1.45, h * 0.95) / base;
        const scaleBrands = Math.min(w * 1.15, h * 0.62) / base;
        const scaleQuotes = Math.min(w * 1.15, h * 0.6) / base;

        const hero = { x: w * 0.5, y: h * 0.46, s: 1 };
        const man = { x: w * 0.5, y: -h * 0.14, s: scaleBig };
        const gone = { x: w * 0.5, y: h * 0.5, s: 0.05 };
        // Sits above the headline while the quotes slide past underneath.
        const quotesPos = { x: w * 0.5, y: -h * 0.14, s: scaleQuotes };
        const brandsPos = { x: w * 0.5, y: -h * 0.08, s: scaleBrands };

        const yArrive = Math.max(1, manTop - h * 0.3);
        const yText = Math.max(yArrive + 1, manTop + h * 0.05);
        const yReveal = Math.max(yText + 1, manTop + manH * 0.55);
        const yFade = Math.max(yReveal + 1, svcTop - h * 0.75);
        const yFaded = yFade + h * 0.6;
        // Services and Infofluencer are opaque, full-width reads on a phone, so
        // the orb stays away until the testimonials pin.
        const yQuotes = Math.max(yFaded + 1, closeTop - h * 0.7);
        const yQuotesIn = yQuotes + h * 0.55;
        const yBloom = Math.max(yQuotesIn + 1, brandsTop - h * 0.95);
        const yBloomIn = yBloom + h * 0.7;
        const yBloomOut = Math.max(yBloomIn + 1, brandsTop + h * 0.1);
        const yBloomGone = yBloomOut + h * 0.55;

        a = hero;
        b = man;
        t = sy / yArrive;
        fade = t;

        if (sy >= yArrive && sy < yText) {
          a = man;
          b = man;
          t = 1;
          fade = 1;
        } else if (sy >= yText && sy < yReveal) {
          a = man;
          b = man;
          t = 1;
          fade = 1;
          reveal = (sy - yText) / (yReveal - yText);
        } else if (sy >= yReveal && sy < yFade) {
          a = man;
          b = man;
          t = 1;
          fade = 1;
          reveal = 1;
        } else if (sy >= yFade && sy < yFaded) {
          a = man;
          b = gone;
          t = (sy - yFade) / (yFaded - yFade);
          fade = 1;
          reveal = 1;
          orbVis = 1 - smoothstep(clamp01(t));
        } else if (sy >= yFaded && sy < yQuotes) {
          a = gone;
          b = gone;
          t = 1;
          fade = 1;
          reveal = 1;
          orbVis = 0;
        } else if (sy >= yQuotes && sy < yBloom) {
          a = gone;
          b = quotesPos;
          t = Math.min(1, (sy - yQuotes) / (yQuotesIn - yQuotes));
          fade = 1;
          reveal = 1;
          orbVis = smoothstep(clamp01(t));
        } else if (sy >= yBloom) {
          a = quotesPos;
          b = brandsPos;
          t = Math.min(1, (sy - yBloom) / (yBloomIn - yBloom));
          fade = 1;
          reveal = 1;
          orbVis =
            sy < yBloomOut
              ? 1
              : 1 - smoothstep(clamp01((sy - yBloomOut) / (yBloomGone - yBloomOut)));
        }

        // Rail travel is tied to the pinned block, not the orb timeline.
        const pinEl = quotesPinRef.current;
        const pinTop = sectionTop(pinEl, closeTop);
        const pinLen = Math.max(1, (pinEl?.offsetHeight ?? h * 2) - h);
        railT = clamp01(((sy - pinTop) / pinLen - 0.06) / 0.86);

        // The sticky panel covers the screen as soon as the section enters,
        // but ip used to be 0 only once the section top hit the viewport top.
        // That left a full blank frame after "Tüm hizmetler". Drive the intro
        // from when the panel first intersects, then use pin progress for lift.
        const viewStart = infoTop - h;
        const pinStart = infoTop;
        const pinEnd = infoTop + Math.max(h, infoH - h);
        const enter = clamp01((sy - viewStart) / Math.max(1, h * 0.55));
        const pinP = clamp01((sy - pinStart) / Math.max(1, pinEnd - pinStart));
        if (enter > 0 && pinP < 1) {
          infoReveal = enter * (1 - clamp01((pinP - 0.86) / 0.14));
          infoLift = clamp01((pinP - 0.06) / 0.22);
          infoGalleryOpen = clamp01((pinP - 0.2) / 0.24);
        } else if (pinP >= 1) {
          infoLift = 1;
          infoGalleryOpen = 1;
        }

        cardsT = 0;
        copyT = 0;
      }

      t = reduced ? (t > 0.45 ? 1 : 0) : smoothstep(t);
      reveal = reduced ? (reveal > 0.2 ? 1 : 0) : smoothstep(reveal);
      tx = a.x + (b.x - a.x) * t;
      ty = a.y + (b.y - a.y) * t;
      ts = a.s + (b.s - a.s) * t;
      tp = clamp01(fade);
      textT = reveal;
      closeT = reduced ? (closeReveal > 0.2 ? 1 : 0) : smoothstep(closeReveal);
      infoT = reduced
        ? infoReveal > 0.2
          ? 1
          : 0
        : smoothstep(clamp01(infoReveal));
      infoLiftT = reduced
        ? infoLift > 0.45
          ? 1
          : 0
        : smoothstep(clamp01(infoLift));
      infoGalleryT = reduced
        ? infoGalleryOpen > 0.45
          ? 1
          : 0
        : smoothstep(clamp01(infoGalleryOpen));
      orbVisT = reduced ? (orbVis > 0.45 ? 1 : 0) : clamp01(orbVis);
      svcExitT = reduced ? (svcExit > 0.45 ? 1 : 0) : smoothstep(svcExit);
    };

    const applyCards = (p: number, w: number) => {
      if (!cards.length) return;
      const n = services.length;
      let active = -1;
      const hide = 1 - svcExitP;

      cards.forEach((el, i) => {
        const local = p * n - i * 0.88;
        if (local >= 0) active = i;

        let opacity = 0;
        let slideX = w * 0.55;

        if (local >= 0 && local < 1.05) {
          if (local < 0.28) {
            const e = smoothstep(local / 0.28);
            opacity = Math.min(1, e * 1.5);
            slideX = lerp(w * 0.55, 0, e);
          } else if (local < 0.62) {
            opacity = 1;
            slideX = 0;
          } else {
            const e = smoothstep(Math.min(1, (local - 0.62) / 0.3));
            opacity = 1 - e;
            slideX = lerp(0, -w * 0.08, e);
          }
        }

        el.style.opacity = String(opacity * hide);
        el.style.transform = `translate3d(${slideX}px, -50%, 0)`;
      });

      // Fade heading with the last service card, not after orb exit.
      const lastLocal = p * n - (n - 1) * 0.88;
      let lastOut = 1;
      if (lastLocal >= 0.62) {
        lastOut =
          lastLocal >= 0.92
            ? 0
            : 1 - smoothstep(Math.min(1, (lastLocal - 0.62) / 0.3));
      }
      const headingShow =
        Math.min(1, Math.max(copyP, cardsP > 0.02 ? 1 : cardsP * 20)) *
        lastOut *
        hide;
      const heading = servicesHeadingRef.current;
      if (heading) {
        heading.style.opacity = String(headingShow);
        heading.style.transform = `translate3d(0, ${(1 - headingShow) * 12}px, 0)`;
      }

      const copy = servicesCopyRef.current;
      if (copy) {
        const showIntro = copyP * (active >= 0 ? 0 : 1) * hide;
        copy.style.opacity = String(showIntro);
        copy.style.transform = `translate3d(0, ${(1 - copyP) * 16}px, 0)`;
      }
    };

    const applyInfo = () => {
      const stage = infoStageRef.current;
      if (!stage) return;
      const h = window.innerHeight;
      const enter = smoothstep(infoP);
      const lift = smoothstep(infoLiftP);
      const gallery = smoothstep(infoGalleryP);

      stage.style.opacity = String(enter);
      stage.style.pointerEvents = enter > 0.2 ? "auto" : "none";

      if (infoLogo) {
        const scale = lerp(1, desktop ? 0.48 : 0.5, lift);
        const top = lerp(h * (desktop ? 0.4 : 0.3), desktop ? h * 0.11 : h * 0.13, lift);
        infoLogo.style.top = `${top}px`;
        infoLogo.style.transform = `translate(-50%, -50%) scale(${scale})`;
      }

      if (infoCopy) {
        const show = Math.max(0, 1 - lift * 1.4);
        infoCopy.style.opacity = String(show);
        infoCopy.style.top = `${lerp(h * (desktop ? 0.56 : 0.46), h * 0.5, lift)}px`;
        infoCopy.style.transform = "translate(-50%, 0)";
        infoCopy.style.pointerEvents = show > 0.4 ? "auto" : "none";
      }

      if (infoGrid) {
        const from = desktop ? h * 0.26 : h * 0.28;
        infoGrid.style.opacity = String(gallery);
        infoGrid.style.top = `${lerp(from, from - h * 0.06, gallery)}px`;
        infoGrid.style.transform = `translate(-50%, ${(1 - gallery) * 36}px)`;
        infoGrid.style.pointerEvents = gallery > 0.35 ? "auto" : "none";
      }

      infoCards.forEach((card, i) => {
        const local = clamp01(gallery * 1.4 - i * 0.06);
        const e = smoothstep(local);
        card.style.opacity = String(e);
        card.style.transform = `translate3d(0, ${(1 - e) * 24}px, 0) scale(${lerp(0.94, 1, e)})`;
      });
    };

    const applyLetters = () => {
      if (!letters.length) return;
      const n = letters.length;
      const cursor = textP * n;
      for (let i = 0; i < n; i += 1) {
        const el = letters[i];
        const local = clamp01(cursor - i);
        const e = local * local * (3 - 2 * local);
        const muted = el.dataset.tone === "muted";
        const r = Math.round(20 + e * (244 - 20));
        const g = Math.round(17 + e * (241 - 17));
        const bl = Math.round(17 + e * (234 - 17));
        const alpha = muted ? 1 - e * 0.55 : 1;
        const next = `rgba(${r}, ${g}, ${bl}, ${alpha})`;
        if (letterColors[i] === next) continue;
        letterColors[i] = next;
        el.style.color = next;
      }
    };

    const applyQuotes = () => {
      if (!quotes.length) return;
      const h = window.innerHeight;
      const headEl = closeCopyRef.current?.parentElement;
      const cut = headEl ? headEl.getBoundingClientRect().bottom : h * 0.22;
      const fadeBand = Math.max(36, h * 0.05);

      for (const el of quotes) {
        if (closeP < 0.02) {
          el.style.opacity = "0";
          el.style.transform = "translate3d(0, 28px, 0)";
          continue;
        }
        const top = el.getBoundingClientRect().top;
        const enter = clamp01((h - top) / Math.max(48, h * 0.07));
        const leave = clamp01((top - cut + 8) / fadeBand);
        el.style.opacity = String(smoothstep(enter) * smoothstep(leave) * closeP);
        el.style.transform = `translate3d(0, ${(1 - smoothstep(enter)) * 18}px, 0)`;
      }
    };

    /** Phone-only: pulls the testimonial rail left as the pinned block scrolls. */
    const applyRail = () => {
      const rail = quotesRailRef.current;
      if (!rail) return;
      if (!railMeasured) measureRail();
      rail.style.transform = `translate3d(${-railP * railSpan}px, 0, 0)`;

      const n = quotes.length;
      if (!n) return;

      const bar = quotesBarRef.current;
      if (bar) {
        bar.style.transform = `scaleX(${Math.max(1 / n, railP)})`;
      }

      const index = Math.min(n, Math.round(railP * (n - 1)) + 1);
      if (index !== railShown) {
        railShown = index;
        const count = quotesCountRef.current;
        if (count) {
          count.textContent = `${String(index).padStart(2, "0")} / ${String(n).padStart(2, "0")}`;
        }
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
      infoP += (infoT - infoP) * follow;
      infoLiftP += (infoLiftT - infoLiftP) * follow;
      infoGalleryP += (infoGalleryT - infoGalleryP) * follow;
      orbVisP += (orbVisT - orbVisP) * (reduced ? 1 : 1 - Math.exp(-3.8 * dt));

      // Park the orb far off-viewport once it is invisible: its own
      // IntersectionObserver then stops the WebGL loop entirely.
      const asleep = orbVisP < 0.012 && orbVisT < 0.012;
      const offset = asleep ? window.innerHeight * 2.5 : 0;
      orb.style.transform = `translate3d(${x - base / 2}px, ${y - base / 2 + offset}px, 0) scale(${s})`;
      orb.style.opacity = String(orbVisP);
      orb.style.pointerEvents = orbVisP < 0.08 ? "none" : "auto";
      if (ringsRef.current) ringsRef.current.style.opacity = String(1 - fp);
      if (hintRef.current) hintRef.current.style.opacity = String(1 - fp);

      applyLetters();
      applyInfo();

      if (desktop) {
        cardsP += (cardsT - cardsP) * follow;
        copyP += (copyT - copyP) * follow;
        closeP += (closeT - closeP) * follow;
        svcExitP += (svcExitT - svcExitP) * follow;

        applyCards(cardsP, window.innerWidth);

        const closeCopy = closeCopyRef.current;
        if (closeCopy) {
          closeCopy.style.opacity = String(closeP);
          closeCopy.style.transform = `translate3d(${(1 - closeP) * -28}px, 0, 0)`;
        }

        applyQuotes();
      } else {
        railP += (railT - railP) * follow;
        applyRail();
      }

      raf = requestAnimationFrame(tick);
    };

    const onScroll = () => readTarget();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", layout);
    wide.addEventListener("change", layout);
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
      wide.removeEventListener("change", layout);
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
        className="pointer-events-none fixed inset-y-0 right-0 z-[4] hidden w-1/2 items-center px-6 md:flex lg:px-10"
      >
        <div
          ref={servicesHeadingRef}
          className="absolute inset-x-6 top-[max(4.5rem,12vh)] z-[1] text-center opacity-0 will-change-transform lg:inset-x-10"
        >
          <h2 className="font-display text-[clamp(1.6rem,2.8vw,2.35rem)] font-bold tracking-[-0.05em] text-[#f4f1ea]">
            Hizmetlerimiz
          </h2>
        </div>

        {services.map((service) => (
          <article
            key={service.title}
            data-service-card
            className="absolute inset-x-6 top-[52%] w-[calc(100%-3rem)] opacity-0 will-change-transform lg:inset-x-10 lg:w-[calc(100%-5rem)]"
          >
            <div
              data-card-visual
              className="relative h-[min(56vh,32rem)] w-full overflow-hidden rounded-[1.75rem] bg-[#111]"
            >
              <Image
                src={service.image}
                alt={service.title}
                fill
                sizes="50vw"
                className="origin-center object-cover will-change-transform"
              />
            </div>
            <div data-card-caption className="mt-5 w-full text-left">
              <h3 className="font-display text-[clamp(1.35rem,2.2vw,1.9rem)] font-bold tracking-[-0.04em] text-[#f4f1ea]">
                {service.title}
              </h3>
              <p className="mt-2 w-full text-[15px] leading-7 text-white/50">
                {service.line}
              </p>
            </div>
          </article>
        ))}
      </div>

      <div
        ref={servicesCopyRef}
        className="pointer-events-none fixed top-1/2 right-0 z-[4] hidden w-1/2 -translate-y-1/2 px-6 text-left opacity-0 will-change-transform md:block lg:px-10"
      >
        <p className="mt-20 max-w-md text-[15px] leading-7 text-white/50">
          Markanın her katmanını tek bir ritimde kuruyoruz.
        </p>
      </div>

      {/* HERO — orb + blend-mode slogan (Off+Brand approach) */}
      <section className="relative min-h-svh overflow-hidden bg-[#141111] text-[#f4f1ea] md:min-h-dvh">
        <SiteHeader floating />

        <div className="page-x relative mx-auto flex min-h-svh max-w-7xl items-center justify-center pb-16 pt-[max(4.75rem,calc(var(--safe-t)+3.75rem))] md:min-h-[calc(100dvh-4.5rem)] md:pt-4">
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
              className="absolute left-[max(var(--gutter),var(--safe-l))] top-[15%] font-display text-[clamp(2.6rem,18.5vw,7.5rem)] font-semibold leading-[0.85] tracking-[-0.055em] text-white sm:text-[clamp(2.6rem,12.5vw,7.5rem)] sm:tracking-[-0.05em] md:-left-[4%] md:top-[16%] md:text-[clamp(2.6rem,11vw,7.5rem)] lg:-left-[6%]"
            >
              TASARIM
            </span>
            <span
              aria-hidden
              className="absolute right-[max(var(--gutter),var(--safe-r))] top-[46%] text-right font-display text-[clamp(2.6rem,18.5vw,7.5rem)] font-semibold leading-[0.85] tracking-[-0.055em] text-white sm:text-[clamp(2.6rem,12.5vw,7.5rem)] sm:tracking-[-0.05em] md:-right-[4%] md:top-[38%] md:text-[clamp(2.6rem,11vw,7.5rem)] lg:-right-[5%]"
            >
              STRATEJİ
            </span>
            <span
              aria-hidden
              className="absolute left-1/2 top-[77%] w-full -translate-x-1/2 text-center font-display text-[clamp(2.4rem,16.5vw,7rem)] font-semibold leading-[0.85] tracking-[-0.055em] text-white sm:text-[clamp(2.7rem,12.5vw,7rem)] sm:tracking-[-0.05em] md:bottom-[16%] md:top-auto md:text-[clamp(2.4rem,10.5vw,7rem)]"
            >
              DÖNÜŞÜM
            </span>
          </h1>

          <div
            ref={hintRef}
            className="absolute bottom-[max(1.25rem,var(--safe-b))] left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40 md:left-auto md:right-4 md:translate-x-0 lg:right-8"
          >
            Kaydır ↓
          </div>
        </div>
      </section>

      <section
        ref={manifestoRef}
        id="manifesto"
        className="relative z-0 min-h-[165vh] border-y border-white/8 bg-[#141111] text-[#141111] md:min-h-[220vh]"
      >
        <div className="page-x sticky top-0 flex min-h-svh items-center py-16 md:min-h-dvh lg:py-24">
          <div
            ref={manifestoCopyRef}
            className="relative z-10 w-full max-w-[34rem] md:max-w-[min(40rem,52vw)] md:pr-6 lg:max-w-[min(44rem,48vw)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">
              <LetterText text="Manifesto" tone="muted" />
            </p>
            <div className="mt-6">
              <p className="font-display text-[clamp(2rem,8.5vw,4.2rem)] font-bold leading-[0.98] tracking-[-0.05em] md:text-[clamp(2rem,4.6vw,4.2rem)] md:leading-[0.95] md:tracking-[-0.06em]">
                <LetterText text="Dikkat çeken değil, akılda kalan markalar tasarlıyoruz." />
              </p>
              <p className="mt-6 max-w-xl text-[15px] leading-7 sm:text-base md:text-lg">
                <LetterText text="Her temas noktasını tekil bir kampanya gibi değil, bir sistem gibi ele alıyoruz. Tasarım, yazılım ve büyüme tarafları tek bir ritimde çalıştığında markalar daha güçlü görünür." />
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        ref={servicesRef}
        id="services"
        className="relative z-0 bg-[#141111] md:min-h-[320vh]"
      >
        {/* Phones read the services as a stack of full-screen cards that slide
            over each other — no fixed half-width stage, no hover. */}
        <div className="md:hidden">
          <div className="page-x pb-10 pt-20" data-reveal>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
              Ne yapıyoruz
            </p>
            <h2 className="mt-3 font-display text-[clamp(2.1rem,9vw,3rem)] font-bold leading-[0.95] tracking-[-0.05em] text-[#f4f1ea]">
              Hizmetlerimiz
            </h2>
            <p className="mt-4 max-w-sm text-[15px] leading-7 text-white/50">
              Markanın her katmanını tek bir ritimde kuruyoruz.
            </p>
          </div>

          <div className="relative">
            {services.map((service, i) => (
              <div key={service.slug} className="sticky top-0 h-[100svh]">
                {/* Fills the visual viewport exactly, so the next card always
                    covers this one with no seam. */}
                <article className="page-x flex h-[100dvh] flex-col rounded-t-[2rem] border-t border-white/10 bg-[#141111] pb-[calc(5.25rem+var(--safe-b))] pt-[max(4rem,calc(var(--safe-t)+3.25rem))] shadow-[0_-30px_60px_-32px_rgba(0,0,0,1)]">
                  <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                    <span className="text-[#e91825]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      aria-hidden
                      className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent"
                    />
                    <span>{String(services.length).padStart(2, "0")}</span>
                  </div>

                  <div className="relative mt-4 min-h-0 w-full flex-1 overflow-hidden rounded-[1.5rem] bg-[#111]">
                    <Image
                      src={service.image}
                      alt={service.title}
                      fill
                      sizes="100vw"
                      className="object-cover"
                    />
                  </div>

                  <h3 className="mt-5 font-display text-[clamp(1.6rem,7vw,2.4rem)] font-bold leading-[1] tracking-[-0.045em] text-[#f4f1ea]">
                    {service.title}
                  </h3>
                  <p className="mt-2 line-clamp-3 text-[14px] leading-6 text-white/50">
                    {service.line}
                  </p>

                  <Link
                    href={`/hizmetlerimiz/${service.slug}`}
                    className="mt-2 inline-flex min-h-11 w-fit items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#f4f1ea] active:text-[#e91825]"
                  >
                    Detaylara bak
                    <span aria-hidden>↗</span>
                  </Link>
                </article>
              </div>
            ))}
          </div>

          <div className="page-x pb-16 pt-14" data-reveal>
            <Link
              href="/hizmetlerimiz"
              className="flex min-h-[3.25rem] items-center justify-center rounded-full border border-white/15 px-6 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#f4f1ea] active:border-[#e91825]/70"
            >
              Tüm hizmetler
            </Link>
          </div>
        </div>
      </section>

      <section
        ref={infoRef}
        id="infofluencer"
        className="relative z-[1] min-h-[300vh] bg-[#141111] md:z-0 md:min-h-[460vh]"
      >
        <div className="sticky top-0 h-[100svh] overflow-hidden md:h-dvh">
          <div ref={infoStageRef} className="relative h-full w-full opacity-0">
            <div
              data-info-media
              className="absolute left-1/2 z-[3] w-[min(80vw,34rem)] will-change-transform"
              style={{ top: "40%", transform: "translate(-50%, -50%)" }}
            >
              <img
                src={infofluencer.image}
                alt={infofluencer.title}
                className="h-auto w-full object-contain"
              />
            </div>

            <div
              data-info-copy
              className="page-x absolute left-1/2 z-[2] w-[min(94vw,36rem)] text-center will-change-transform"
              style={{ top: "56%", transform: "translate(-50%, 0)" }}
            >
              <p className="font-display text-[clamp(1.35rem,5.5vw,1.85rem)] font-bold tracking-[-0.04em] text-[#f4f1ea]">
                {infofluencer.tagline}
              </p>
              <p className="mx-auto mt-3 max-w-lg text-[15px] leading-7 text-white/50">
                {infofluencer.line}
              </p>
              <a
                href={infofluencer.href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-7 inline-flex min-h-[3.25rem] items-center rounded-full bg-[#f4f1ea] px-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#141111] transition duration-300 hover:bg-[#e91825] hover:text-white lg:min-h-0 lg:py-3"
              >
                Infofluencer’ı İncele
              </a>
            </div>

            <div
              data-info-gallery
              className="absolute left-1/2 z-[1] w-[min(92vw,72rem)] px-4 opacity-0 will-change-transform sm:w-[min(98vw,72rem)] sm:px-5"
              style={{ top: "28%", transform: "translate(-50%, 36px)" }}
            >
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-3.5 md:grid-cols-5 md:gap-4">
                {infoGallery.map((item, i) => (
                  <li
                    key={item.thumb}
                    data-info-card
                    className={[
                      "opacity-0 will-change-transform",
                      i >= 6 ? "hidden md:block" : "",
                      i >= 4 && i < 6 ? "hidden sm:block" : "",
                    ].join(" ")}
                  >
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={item.label}
                      className="group relative block aspect-[4/5] overflow-hidden rounded-[1.35rem] bg-[#1c1818] sm:aspect-[3/4]"
                    >
                      <Image
                        src={item.thumb}
                        alt=""
                        fill
                        sizes="(max-width: 639px) 45vw, (max-width: 767px) 30vw, 20vw"
                        className="object-cover transition duration-500 group-hover:scale-[1.04]"
                      />
                      <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                      {item.video ? (
                        <span
                          aria-hidden
                          className="absolute inset-0 flex items-center justify-center"
                        >
                          <span className="flex size-10 items-center justify-center rounded-full bg-white/90 text-[#141111] shadow-lg transition group-hover:scale-105">
                            <svg
                              viewBox="0 0 24 24"
                              className="ml-0.5 size-4 fill-current"
                              aria-hidden
                            >
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </span>
                        </span>
                      ) : null}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section
        ref={closeRef}
        id="contact"
        className="relative z-10 pb-16 md:page-x md:z-0 md:bg-[#141111] md:pt-[min(55vh,22rem)] lg:pb-20"
      >
        <div className="w-full md:max-w-[min(40rem,52vw)] md:pr-6">
          {/* Phones pin this block and pull the rail sideways as you scroll. */}
          <div ref={quotesPinRef} className="h-[280svh] md:h-auto">
            <div className="sticky top-0 z-10 flex h-[100svh] flex-col overflow-hidden pb-[calc(5.75rem+var(--safe-b))] pt-[max(4.75rem,calc(var(--safe-t)+3.75rem))] md:static md:z-auto md:block md:h-auto md:overflow-visible md:p-0">
              <div className="z-[3] md:sticky md:top-0 md:pt-10 lg:pt-12">
                <div className="page-x relative md:bg-[#141111] md:px-0 md:pb-5">
                  <div
                    ref={closeCopyRef}
                    data-reveal
                    className="will-change-transform md:opacity-0"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60 md:text-white/40">
                      Müşteri Memnuniyeti
                    </p>
                    <h2 className="mt-3 font-display text-[clamp(1.9rem,7.6vw,3.6rem)] font-bold leading-[0.95] tracking-[-0.06em] text-[#f4f1ea] md:mt-4 md:text-[clamp(2rem,4.4vw,3.6rem)]">
                      593 Hakkında
                    </h2>
                  </div>
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-[-1.5rem] top-full hidden h-10 bg-gradient-to-b from-[#141111] to-transparent md:block"
                  />
                </div>
              </div>

              <div
                ref={quotesRailRef}
                className="flex min-h-0 flex-1 items-stretch gap-4 pe-[max(var(--gutter),var(--safe-r))] ps-[max(var(--gutter),var(--safe-l))] pt-6 will-change-transform md:flex-none md:flex-col md:gap-10 md:pe-0 md:ps-0 md:pt-[min(28vh,12rem)] md:pb-10 md:transform-none"
              >
                {testimonials.map((item) => (
                  <article
                    key={item.company}
                    data-testimonial
                    className="relative flex h-full w-[80vw] shrink-0 flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#1c1818] p-5 will-change-transform sm:w-[58vw] md:h-auto md:w-auto md:shrink md:p-8 md:opacity-0"
                  >
                    <span
                      aria-hidden
                      className="font-display text-[2.75rem] leading-[0.7] text-[#e91825]/40 md:text-[5rem]"
                    >
                      “
                    </span>
                    <p className="mt-4 min-h-0 flex-1 overflow-hidden font-display text-[clamp(0.9rem,3.7vw,1.1rem)] font-medium leading-[1.5] tracking-[-0.03em] text-[#f4f1ea] md:mt-5 md:flex-none md:overflow-visible md:text-[clamp(1.05rem,2.1vw,1.28rem)] md:leading-[1.45] md:tracking-[-0.035em]">
                      {item.quote}
                    </p>
                    <div className="mt-4 flex items-center gap-3.5 border-t border-white/10 pt-4 md:mt-8 md:gap-4 md:pt-5">
                      <div className="size-11 shrink-0 overflow-hidden rounded-2xl bg-[#f4f1ea] p-1.5 md:size-14">
                        <img
                          src={item.logo}
                          alt={item.company}
                          loading="lazy"
                          decoding="async"
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

              <div
                aria-hidden
                className="page-x mt-5 flex shrink-0 items-center gap-3 md:hidden"
              >
                <span className="h-px flex-1 overflow-hidden bg-white/12">
                  <span
                    ref={quotesBarRef}
                    className="block h-full w-full origin-left scale-x-0 bg-[#e91825]"
                  />
                </span>
                <span
                  ref={quotesCountRef}
                  className="text-[11px] font-semibold uppercase tracking-[0.18em] tabular-nums text-white/30"
                >
                  01 / {String(testimonials.length).padStart(2, "0")}
                </span>
              </div>
            </div>
          </div>

          <div className="page-x flex flex-col gap-3 pb-6 pt-10 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 md:px-0 md:pt-2">
            <Link
              href="mailto:hello@593emarketing.com"
              className="flex min-h-[3.25rem] items-center justify-center rounded-full bg-[#f4f1ea] px-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#141111] transition duration-300 hover:bg-[#e91825] hover:text-white lg:min-h-0 lg:py-3"
            >
              İletişim
            </Link>
            <a
              href="mailto:hello@593emarketing.com"
              className="flex min-h-11 items-center justify-center text-sm text-white/50 transition hover:text-[#f4f1ea] lg:min-h-0"
            >
              hello@593emarketing.com
            </a>
          </div>
        </div>
      </section>

      <section
        ref={brandsRef}
        id="brands"
        className="page-x relative overflow-x-clip border-t border-white/8 bg-[#141111] pb-[calc(7rem+var(--safe-b))] pt-28 md:flex md:min-h-dvh md:items-center md:justify-center md:pb-20 md:pt-[min(38vh,16rem)]"
      >
        <div
          className="relative mx-auto w-full max-w-6xl"
          onMouseLeave={() => setActiveBrand(null)}
        >
          <div
            data-reveal
            className="relative z-[7] mb-7 mix-blend-difference sm:mb-10"
          >
            <div className="flex items-baseline gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                İş ortaklarımız
              </p>
              <span className="text-[11px] font-semibold tabular-nums tracking-[0.18em] text-white/45">
                {brands.length}
              </span>
            </div>
            <h2 className="mt-3 font-display text-[clamp(2.1rem,9vw,3.4rem)] font-bold leading-[0.95] tracking-[-0.06em] text-white md:text-[clamp(2rem,4.4vw,3.4rem)]">
              Markalarımız
            </h2>
            <p className="mt-3 max-w-md text-[15px] leading-7 text-white/80">
              Birlikte büyüttüğümüz markalar.
            </p>
          </div>

          {/* Logos are opaque 1:1 artwork, so the plate stays square at every
              size and phones get density from a tighter grid instead. */}
          <ul
            data-reveal
            className="grid grid-cols-3 gap-x-2.5 gap-y-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-6"
          >
            {brands.map((brand) => {
              const isActive = activeBrand?.name === brand.name;
              return (
                <li
                  key={brand.name}
                  className="relative lg:aspect-square"
                  onMouseEnter={() => setActiveBrand(brand)}
                  onMouseLeave={() => setActiveBrand(null)}
                  onFocus={() => setActiveBrand(brand)}
                  onBlur={() => setActiveBrand(null)}
                >
                  <a
                    href={brand.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${brand.name} — incele`}
                    className={[
                      "flex h-full flex-col overflow-hidden rounded-[1.15rem] border border-white/8 bg-white/[0.035] transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:border-[#e91825]/60 sm:rounded-[1.35rem] lg:absolute lg:inset-x-0 lg:top-0 lg:h-auto lg:border-transparent lg:bg-[#161212]",
                      isActive
                        ? "lg:z-20 lg:-translate-y-[4.75rem] lg:bg-[#1a1616] lg:shadow-[0_28px_50px_-22px_rgba(0,0,0,0.95)]"
                        : "lg:z-10",
                    ].join(" ")}
                  >
                    <div className="aspect-square w-full shrink-0 p-1.5 sm:p-3">
                      <div
                        className={[
                          "flex h-full w-full items-center justify-center overflow-hidden rounded-[0.8rem] bg-[#f4f1ea] transition duration-500 sm:rounded-[1rem]",
                          isActive ? "lg:opacity-100" : "lg:opacity-85",
                        ].join(" ")}
                      >
                        <img
                          src={brand.logo}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className={[
                            "h-full w-full object-contain p-1.5 transition duration-500 ease-out sm:p-2.5 lg:grayscale",
                            isActive ? "lg:scale-[1.02] lg:grayscale-0" : "",
                          ].join(" ")}
                        />
                      </div>
                    </div>

                    <div
                      className={[
                        "flex flex-1 overflow-hidden lg:block lg:flex-none lg:transition-[max-height,opacity] lg:duration-300 lg:ease-[cubic-bezier(0.22,1,0.36,1)]",
                        isActive
                          ? "lg:max-h-28 lg:opacity-100"
                          : "lg:max-h-0 lg:opacity-0",
                      ].join(" ")}
                    >
                      <div className="flex w-full flex-col items-center justify-center px-1.5 pb-2.5 pt-1 text-center sm:px-3 sm:pb-4 sm:pt-0.5">
                        <p className="line-clamp-2 font-display text-[10px] font-medium leading-tight tracking-[-0.01em] text-white/55 sm:text-[12px] sm:leading-snug sm:tracking-[-0.02em] lg:text-white/50">
                          {brand.name}
                        </p>
                        <span className="mt-2.5 hidden rounded-full bg-[#f4f1ea] px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#141111] transition duration-300 hover:bg-[#e91825] hover:text-white lg:inline-flex">
                          İncele
                        </span>
                      </div>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <SiteFooter />
      <MobileActionDock />
    </main>
  );
}
