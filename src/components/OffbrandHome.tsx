"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import CursorDot from "./CursorDot";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
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
  const brandsRef = useRef<HTMLElement>(null);
  const [activeBrand, setActiveBrand] = useState<(typeof brands)[number] | null>(
    null,
  );

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
    let infoT = 0;
    let infoLiftT = 0;
    let infoGalleryT = 0;
    let closeT = 0;
    let orbVisT = 1;
    let svcExitT = 0;
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
      const scaleBrands = Math.min(w * 0.92, h * 1.05) / base;

      const hero = { x: w * 0.5, y: h * 0.54, s: 1 };
      const man = { x: w * 0.82, y: h * 0.5, s: scaleBig };
      const svc = { x: w * 0.18, y: h * 0.5, s: scaleBig };
      const vanish = { x: w * 0.5, y: h * 0.5, s: 0.04 };
      const close = { x: w * 0.82, y: h * 0.78, s: scaleBig };
      const brandsPos = { x: w * 0.5, y: 0, s: scaleBrands };

      const manEl = manifestoRef.current;
      const svcEl = servicesRef.current;
      const infoEl = infoRef.current;
      const closeEl = closeRef.current;
      const brandsEl = brandsRef.current;
      const manTop = manEl ? manEl.getBoundingClientRect().top + window.scrollY : h;
      const manH = manEl?.offsetHeight ?? h;
      const svcTop = svcEl ? svcEl.getBoundingClientRect().top + window.scrollY : manTop + manH;
      const svcH = svcEl?.offsetHeight ?? h * 6;
      const infoTop = infoEl
        ? infoEl.getBoundingClientRect().top + window.scrollY
        : svcTop + svcH;
      const infoH = infoEl?.offsetHeight ?? h * 2.2;
      const closeTop = closeEl
        ? closeEl.getBoundingClientRect().top + window.scrollY
        : infoTop + infoH;
      const closeH = closeEl?.offsetHeight ?? h * 2;
      const brandsTop = brandsEl
        ? brandsEl.getBoundingClientRect().top + window.scrollY
        : closeTop + closeH;

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
      const sy = window.scrollY;

      let a = hero;
      let b = man;
      let t = sy / yArrive;
      let fade = t;
      let reveal = 0;
      let closeReveal = 0;
      let infoReveal = 0;
      let infoLift = 0;
      let infoGallery = 0;
      let orbVis = 1;

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
        orbVis = 1 - smoothstep(Math.pow(Math.min(1, Math.max(0, t)), 0.72));
        infoReveal = smoothstep(t) * 0.12;
      } else if (sy >= yOrbGone && sy < yClose) {
        a = vanish;
        b = vanish;
        t = 1;
        fade = 1;
        reveal = 1;
        orbVis = 0;
        const span = Math.max(1, yClose - yOrbGone);
        const p = Math.min(1, Math.max(0, (sy - yOrbGone) / span));
        // 0–0.18 enter · 0.18–0.38 logo lifts · 0.34–0.58 gallery · then hold · fade out
        if (p < 0.18) {
          infoReveal = p / 0.18;
          infoLift = 0;
          infoGallery = 0;
        } else if (p < 0.38) {
          infoReveal = 1;
          infoLift = (p - 0.18) / 0.2;
          infoGallery = Math.max(0, (p - 0.34) / 0.24);
        } else if (p < 0.72) {
          infoReveal = 1;
          infoLift = 1;
          infoGallery = Math.min(1, (p - 0.34) / 0.24);
        } else {
          infoLift = 1;
          infoGallery = 1;
          infoReveal = Math.max(0, 1 - (p - 0.72) / 0.22);
        }
      } else if (sy >= yClose && sy < yBrands) {
        a = vanish;
        b = close;
        t = Math.min(1, (sy - yClose) / (yCloseArrive - yClose));
        fade = 1;
        reveal = 1;
        closeReveal = Math.min(1, t / 0.42);
        orbVis = smoothstep(Math.pow(Math.min(1, Math.max(0, t)), 1.35));
        infoReveal = 0;
        infoLift = 1;
        infoGallery = 0;
      } else if (sy >= yBrands) {
        a = close;
        b = brandsPos;
        t = Math.min(1, (sy - yBrands) / (yBrandsArrive - yBrands));
        fade = 1;
        reveal = 1;
        closeReveal = 1;
        orbVis = 1;
        infoReveal = 0;
        infoLift = 1;
        infoGallery = 0;
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
      infoT = reduced ? (infoReveal > 0.2 ? 1 : 0) : smoothstep(Math.min(1, Math.max(0, infoReveal)));
      infoLiftT = reduced ? (infoLift > 0.45 ? 1 : 0) : smoothstep(Math.min(1, Math.max(0, infoLift)));
      infoGalleryT = reduced
        ? infoGallery > 0.45
          ? 1
          : 0
        : smoothstep(Math.min(1, Math.max(0, infoGallery)));
      orbVisT = reduced ? (orbVis > 0.45 ? 1 : 0) : Math.min(1, Math.max(0, orbVis));
      const svcExit =
        sy < yOrbShrink
          ? 0
          : sy >= yOrbGone
            ? 1
            : (sy - yOrbShrink) / (yOrbGone - yOrbShrink);
      svcExitT = reduced ? (svcExit > 0.45 ? 1 : 0) : smoothstep(svcExit);
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
      const hide = 1 - svcExitP;

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

      const logo = stage.querySelector<HTMLElement>("[data-info-media]");
      if (logo) {
        const scale = lerp(1, 0.48, lift);
        const top = lerp(h * 0.42, h * 0.11, lift);
        logo.style.top = `${top}px`;
        logo.style.transform = `translate(-50%, -50%) scale(${scale})`;
      }

      const copy = stage.querySelector<HTMLElement>("[data-info-copy]");
      if (copy) {
        const show = Math.max(0, 1 - lift * 1.4);
        copy.style.opacity = String(show);
        copy.style.top = `${lerp(h * 0.58, h * 0.5, lift)}px`;
        copy.style.transform = `translate(-50%, 0)`;
        copy.style.pointerEvents = show > 0.4 ? "auto" : "none";
      }

      const grid = stage.querySelector<HTMLElement>("[data-info-gallery]");
      if (grid) {
        grid.style.opacity = String(gallery);
        grid.style.top = `${lerp(h * 0.26, h * 0.2, gallery)}px`;
        grid.style.transform = `translate(-50%, ${(1 - gallery) * 36}px)`;
        grid.style.pointerEvents = gallery > 0.35 ? "auto" : "none";
      }

      grid?.querySelectorAll<HTMLElement>("[data-info-card]").forEach((card, i) => {
        const local = Math.min(1, Math.max(0, gallery * 1.4 - i * 0.06));
        const e = smoothstep(local);
        card.style.opacity = String(e);
        card.style.transform = `translate3d(0, ${(1 - e) * 24}px, 0) scale(${lerp(0.94, 1, e)})`;
      });
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
      infoP += (infoT - infoP) * follow;
      infoLiftP += (infoLiftT - infoLiftP) * follow;
      infoGalleryP += (infoGalleryT - infoGalleryP) * follow;
      closeP += (closeT - closeP) * follow;
      orbVisP += (orbVisT - orbVisP) * (reduced ? 1 : 1 - Math.exp(-3.8 * dt));
      svcExitP += (svcExitT - svcExitP) * follow;

      orb.style.transform = `translate3d(${x - base / 2}px, ${y - base / 2}px, 0) scale(${s})`;
      orb.style.opacity = String(orbVisP);
      orb.style.pointerEvents = orbVisP < 0.08 ? "none" : "auto";
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
      applyInfo();

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
        <div
          ref={servicesHeadingRef}
          className="absolute inset-x-4 top-[max(4.5rem,12vh)] z-[1] text-center opacity-0 will-change-transform sm:inset-x-6 lg:inset-x-10"
        >
          <h2 className="font-display text-[clamp(1.6rem,2.8vw,2.35rem)] font-bold tracking-[-0.05em] text-[#f4f1ea]">
            Hizmetlerimiz
          </h2>
        </div>

        {services.map((service) => (
          <article
            key={service.title}
            data-service-card
            className="absolute inset-x-4 top-[52%] w-[calc(100%-2rem)] opacity-0 will-change-transform sm:inset-x-6 sm:w-[calc(100%-3rem)] lg:inset-x-10 lg:w-[calc(100%-5rem)]"
          >
            <div
              data-card-visual
              className="relative h-[min(56vh,32rem)] w-full overflow-hidden rounded-[1.75rem] bg-[#111]"
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
        <p className="mt-16 max-w-md text-[15px] leading-7 text-white/50 sm:mt-20">
          Markanın her katmanını tek bir ritimde kuruyoruz.
        </p>
      </div>

      {/* HERO — orb + blend-mode slogan (Off+Brand approach) */}
      <section className="relative min-h-dvh overflow-hidden bg-[#141111] text-[#f4f1ea]">
        <SiteHeader />

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
        className="relative z-0 min-h-[320vh] bg-[#141111]"
      />

      <section
        ref={infoRef}
        id="infofluencer"
        className="relative z-0 min-h-[460vh] bg-[#141111]"
      >
        <div className="sticky top-0 h-dvh overflow-hidden">
          <div
            ref={infoStageRef}
            className="relative h-full w-full opacity-0"
          >
            <div
              data-info-media
              className="absolute left-1/2 z-[3] w-[min(88vw,34rem)] will-change-transform"
              style={{ top: "42%", transform: "translate(-50%, -50%)" }}
            >
              <img
                src={infofluencer.image}
                alt={infofluencer.title}
                className="h-auto w-full object-contain"
              />
            </div>

            <div
              data-info-copy
              className="absolute left-1/2 z-[2] w-[min(92vw,36rem)] px-4 text-center will-change-transform"
              style={{ top: "58%", transform: "translate(-50%, 0)" }}
            >
              <p className="font-display text-[clamp(1.35rem,2.8vw,1.85rem)] font-bold tracking-[-0.04em] text-[#f4f1ea]">
                {infofluencer.tagline}
              </p>
              <p className="mx-auto mt-3 max-w-lg text-[15px] leading-7 text-white/50">
                {infofluencer.line}
              </p>
              <a
                href={infofluencer.href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-7 inline-flex rounded-full bg-[#f4f1ea] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#141111] transition duration-300 hover:bg-[#e91825] hover:text-white"
              >
                Infofluencer’ı İncele
              </a>
            </div>

            <div
              data-info-gallery
              className="absolute left-1/2 z-[1] w-[min(98vw,72rem)] px-3 opacity-0 will-change-transform sm:px-5"
              style={{ top: "20%", transform: "translate(-50%, 36px)" }}
            >
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-3.5 md:grid-cols-5 md:gap-4">
                {infoGallery.map((item) => (
                  <li
                    key={item.thumb}
                    data-info-card
                    className="opacity-0 will-change-transform"
                  >
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={item.label}
                      className="group relative block aspect-[3/4] overflow-hidden rounded-[1.35rem] bg-[#1c1818]"
                    >
                      <img
                        src={item.thumb}
                        alt=""
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
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
        className="relative z-0 bg-[#141111] px-4 pb-16 pt-[min(55vh,22rem)] sm:px-6 lg:px-8 lg:pb-20"
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

          <div className="flex flex-col gap-8 pt-[min(28vh,12rem)] pb-10 sm:gap-10">
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

          <div className="flex flex-wrap items-center gap-4 pb-6 pt-2">
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

      <section
        ref={brandsRef}
        id="brands"
        className="relative flex min-h-dvh items-center justify-center overflow-x-hidden border-t border-white/8 bg-[#141111] px-4 pb-20 pt-[min(38vh,16rem)] sm:px-6 lg:px-8"
      >
        <div
          className="relative mx-auto w-full max-w-6xl"
          onMouseLeave={() => setActiveBrand(null)}
        >
          <div className="relative z-[7] mb-8 mix-blend-difference sm:mb-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
              İş ortaklarımız
            </p>
            <h2 className="mt-3 font-display text-[clamp(2rem,4.4vw,3.4rem)] font-bold leading-[0.95] tracking-[-0.06em] text-white">
              Markalarımız
            </h2>
            <p className="mt-3 max-w-md text-[15px] leading-7 text-white/80">
              Birlikte büyüttüğümüz markalar.
            </p>
          </div>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-6">
            {brands.map((brand) => {
              const isActive = activeBrand?.name === brand.name;
              return (
                <li
                  key={brand.name}
                  className="relative aspect-square"
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
                      "absolute inset-x-0 top-0 flex flex-col overflow-hidden rounded-[1.35rem] transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                      isActive
                        ? "z-20 -translate-y-[4.75rem] bg-[#1a1616] shadow-[0_28px_50px_-22px_rgba(0,0,0,0.95)]"
                        : "z-10 bg-[#161212]",
                    ].join(" ")}
                  >
                    <div className="aspect-square w-full shrink-0 p-2.5 sm:p-3">
                      <div
                        className={[
                          "flex h-full w-full items-center justify-center overflow-hidden rounded-[1rem] bg-[#f4f1ea] transition duration-500",
                          isActive ? "opacity-100" : "opacity-85",
                        ].join(" ")}
                      >
                        <img
                          src={brand.logo}
                          alt=""
                          className={[
                            "h-full w-full object-contain p-2 transition duration-500 ease-out sm:p-2.5",
                            isActive
                              ? "scale-[1.02] grayscale-0"
                              : "grayscale",
                          ].join(" ")}
                        />
                      </div>
                    </div>

                    <div
                      className={[
                        "overflow-hidden transition-[max-height,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                        isActive
                          ? "max-h-28 opacity-100"
                          : "max-h-0 opacity-0",
                      ].join(" ")}
                    >
                      <div className="flex flex-col items-center px-3 pb-4 pt-0.5 text-center">
                        <p className="line-clamp-2 font-display text-[11px] font-medium leading-snug tracking-[-0.02em] text-white/50 sm:text-[12px]">
                          {brand.name}
                        </p>
                        <span className="mt-2.5 inline-flex rounded-full bg-[#f4f1ea] px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#141111] transition duration-300 hover:bg-[#e91825] hover:text-white">
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
    </main>
  );
}
