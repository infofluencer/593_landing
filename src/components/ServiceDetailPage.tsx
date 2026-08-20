"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import CursorDot from "./CursorDot";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import BuiltSitesShowcase from "./BuiltSitesShowcase";
import MobileActionDock from "./MobileActionDock";
import OutArrow from "./OutArrow";
import type { Service } from "@/data/services";
import { services } from "@/data/services";

const LogoOrb = dynamic(() => import("./LogoOrb"), {
  ssr: false,
  loading: () => (
    <div className="aspect-square h-full w-full animate-pulse rounded-full bg-[#e91825]/20" />
  ),
});

const offeringIcons: readonly ReactNode[] = [
  <svg key="a" viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
    <path
      d="M4 20V8l8-4 8 4v12H4Z"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <path d="M9 20v-6h6v6" stroke="currentColor" strokeWidth="1.6" />
  </svg>,
  <svg key="b" viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
    <path
      d="M7 8h13l-1.2 8H8.5L7 8Z"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <path d="M7 8 5.8 4H3" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="10" cy="20" r="1.1" fill="currentColor" />
    <circle cx="17" cy="20" r="1.1" fill="currentColor" />
  </svg>,
  <svg
    key="c"
    viewBox="0 0 24 24"
    className="h-4 w-4 rotate-45"
    fill="none"
    aria-hidden
  >
    <path
      d="M12 3c2.2 3.2 3.5 6.1 3.8 8.6.2 1.5-.2 2.7-1.1 3.6l1.6 3.3h-2.1l-.9-2.1c-.4.1-.8.2-1.3.2s-.9-.1-1.3-.2l-.9 2.1H7.7l1.6-3.3c-.9-.9-1.3-2.1-1.1-3.6C8.5 9.1 9.8 6.2 12 3Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path
      d="M10.2 14.2 8 17.5M13.8 14.2 16 17.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>,
  <svg key="d" viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
    <path
      d="M4 6h6v6H4V6Zm10 0h6v6h-6V6ZM4 16h6v4H4v-4Zm10 0h6v4h-6v-4Z"
      stroke="currentColor"
      strokeWidth="1.6"
    />
  </svg>,
];

export default function ServiceDetailPage({ service }: { service: Service }) {
  const others = services.filter((item) => item.slug !== service.slug);
  const isWeb = service.slug === "web-tasarim";
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [service.slug]);

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

      <SiteHeader />

      {/* Orb — pinned to the right of the hero. Offsets are absolute lengths on
          purpose: a percentage `top` resolves against the whole document, which
          dropped the orb hundreds of pixels into the copy on long pages. */}
      <div
        className={`pointer-events-none absolute right-0 z-[5] aspect-square transition duration-1000 delay-150 ease-out ${
          ready ? "scale-100 opacity-100" : "scale-95 opacity-0"
        } top-[-2.5rem] w-[min(56vw,16rem)] translate-x-[36%] sm:top-[-3rem] sm:w-[min(46vw,20rem)] sm:translate-x-[30%] md:top-[5rem] md:w-[min(34vw,20rem)] md:translate-x-[34%] lg:pointer-events-auto lg:top-[5.5rem] lg:w-[min(62vw,62rem)] lg:translate-x-[22%] xl:w-[min(56vw,70rem)] xl:translate-x-[18%]`}
      >
        <LogoOrb />
      </div>

      {/* Phones/small tablets tuck the orb under the bar, so darken the strip
          behind the logo and the menu button to keep them readable. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-[6] h-[6.5rem] bg-gradient-to-b from-[#141111] via-[#141111]/55 to-transparent md:hidden"
      />

      {/* Only the two-column lg layout needs a viewport-tall hero; below that a
          forced 100dvh just leaves a void under short copy. */}
      <section className="relative z-10 lg:min-h-[calc(100dvh-4.5rem)]">
        <div className="page-x relative mx-auto flex max-w-7xl lg:min-h-[calc(100dvh-4.5rem)]">
          <div
            className={`relative z-[6] w-full max-w-xl pt-8 pb-10 transition duration-700 ease-out lg:w-[52%] lg:max-w-none lg:pb-16 lg:pt-10 ${
              ready ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
            }`}
          >
            {/* Below lg the orb already occupies the top-right corner. */}
            <p
              aria-hidden
              className="pointer-events-none absolute top-6 right-0 hidden select-none font-display text-[clamp(5rem,16vw,10rem)] font-bold leading-none tracking-[-0.08em] text-white/[0.035] lg:block lg:-right-8"
            >
              593
            </p>

            <Link
              href="/hizmetlerimiz"
              className="relative -ml-1 inline-flex min-h-11 items-center gap-1.5 pr-2 pl-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/45 transition active:text-[#f4f1ea] md:hidden"
            >
              <svg
                viewBox="0 0 16 16"
                className="size-3.5"
                fill="none"
                aria-hidden
              >
                <path
                  d="M9.5 3.5 5 8l4.5 4.5"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Hizmetler
            </Link>

            {/* Capped on phones so long titles wrap instead of running under
                the orb parked at the right edge. */}
            <h1 className="relative mt-1 max-w-[58vw] font-display text-[clamp(2.4rem,6vw,4rem)] font-bold leading-[0.95] tracking-[-0.055em] text-[#f4f1ea] sm:max-w-none lg:mt-0">
              {service.title}
            </h1>

            <p className="relative mt-5 max-w-md text-[15px] leading-7 text-white/55 sm:text-[16px] sm:leading-8">
              <span className="font-display font-bold tracking-[-0.03em] text-[#f4f1ea]">
                {service.heroLead}
              </span>{" "}
              {service.heroBody}
            </p>

            <ul className="relative mt-8 overflow-hidden rounded-2xl border border-white/12">
              <li className="grid grid-cols-1 sm:grid-cols-2">
                {service.offerings.map((item, i) => (
                  <div
                    key={item.title}
                    className={`group flex items-start gap-3.5 p-4 transition duration-300 hover:bg-white/[0.04] sm:gap-4 sm:p-5 ${
                      i % 2 === 0 ? "sm:border-r sm:border-white/10" : ""
                    } ${i < 2 ? "border-b border-white/10" : ""} ${
                      i === 2 ? "max-sm:border-b max-sm:border-white/10" : ""
                    }`}
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e91825]/18 text-[#e91825] transition duration-300 group-hover:bg-[#e91825] group-hover:text-white">
                      {offeringIcons[i % offeringIcons.length]}
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className="font-display text-[14px] font-bold tracking-[-0.03em] text-[#f4f1ea] sm:text-[15px]">
                        {item.title}
                      </p>
                      <p className="mt-1 text-[12px] leading-5 text-white/40 sm:text-[13px]">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </li>
            </ul>

            <dl className="relative mt-8 grid grid-cols-3 gap-x-3 border-t border-white/10 pt-6 sm:gap-0">
              {service.stats.map((stat, i) => (
                <div
                  key={stat.label}
                  className={`min-w-0 ${
                    i > 0
                      ? "border-l border-white/10 pl-3 sm:border-white/10 sm:pl-5"
                      : ""
                  }`}
                >
                  <dt className="font-display text-[clamp(1.35rem,5vw,1.55rem)] font-bold tracking-[-0.04em] text-[#f4f1ea]">
                    {stat.value}
                  </dt>
                  <dd className="mt-1.5 text-[10px] font-semibold uppercase leading-[1.35] tracking-[0.1em] text-white/40 sm:tracking-[0.12em]">
                    {stat.label}
                  </dd>
                </div>
              ))}
            </dl>

            {isWeb ? (
              <div
                className={`relative mt-10 flex items-end justify-start gap-2 sm:mt-12 sm:gap-3 ${
                  ready ? "opacity-100" : "opacity-0"
                } transition duration-1000 delay-200`}
              >
                <img
                  src="/laptop-mockup.png"
                  alt="Web tasarım laptop önizleme"
                  className="mockup-float w-[min(58%,15rem)] max-w-[15rem] drop-shadow-[0_18px_40px_rgba(0,0,0,0.45)] select-none sm:w-[min(52%,17rem)]"
                  draggable={false}
                />
                <img
                  src="/phone-mockup.png"
                  alt="Web tasarım mobil önizleme"
                  className="mockup-float-delay mb-[4%] w-[min(24%,6.5rem)] max-w-[6.5rem] drop-shadow-[0_14px_28px_rgba(0,0,0,0.4)] select-none sm:w-[min(22%,7.25rem)]"
                  draggable={false}
                />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="relative z-10">
        <div className="page-x mx-auto grid max-w-7xl gap-14 py-16 sm:py-20 lg:grid-cols-12 lg:gap-10 lg:py-24">
          <div className="lg:col-span-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e91825]">
              Yaklaşım
            </p>
            <p className="mt-5 font-display text-[clamp(1.55rem,3.2vw,2.35rem)] font-bold leading-[1.1] tracking-[-0.045em]">
              {service.body}
            </p>
          </div>

          <div className="lg:col-span-6 lg:col-start-7">
            <p className="text-[15px] leading-8 text-white/50">{service.line}</p>

            <p className="mt-12 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
              Neler yapıyoruz
            </p>
            <ul className="mt-5">
              {service.points.map((point, i) => (
                <li
                  key={point}
                  className="flex gap-5 border-t border-white/10 py-5 first:border-t-0 first:pt-0"
                >
                  <span className="w-8 shrink-0 pt-1 text-[12px] font-semibold tracking-[0.12em] text-[#e91825]/80">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[16px] leading-7 text-[#f4f1ea]/85">
                    {point}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {isWeb ? <BuiltSitesShowcase /> : null}

      <section className="relative">
        <div className="page-x mx-auto max-w-7xl py-16 sm:py-20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Diğer hizmetler
              </p>
              <h2 className="mt-3 font-display text-[clamp(1.8rem,4vw,2.8rem)] font-bold tracking-[-0.05em]">
                Aynı ritimde devam et
              </h2>
            </div>
            <Link
              href="/hizmetlerimiz"
              className="inline-flex min-h-11 w-fit items-center gap-1.5 text-[13px] text-white/45 transition hover:text-[#f4f1ea] lg:min-h-0"
            >
              Tüm hizmetler
              <OutArrow className="size-3.5" />
            </Link>
          </div>

          <ul className="mt-10 divide-y divide-white/10 border-y border-white/10">
            {others.map((item) => (
              <li key={item.slug}>
                <Link
                  href={`/hizmetlerimiz/${item.slug}`}
                  className="group flex items-center justify-between gap-6 py-5 transition sm:py-6"
                >
                  <span className="font-display text-[clamp(1.2rem,2.5vw,1.7rem)] font-bold tracking-[-0.04em] text-[#f4f1ea]/85 transition group-hover:text-[#f4f1ea]">
                    {item.title}
                  </span>
                  <OutArrow className="size-4 text-white/35 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#e91825]" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <SiteFooter />
      <MobileActionDock />
    </main>
  );
}
