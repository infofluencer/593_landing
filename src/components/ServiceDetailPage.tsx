"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CursorDot from "./CursorDot";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import BuiltSitesShowcase from "./BuiltSitesShowcase";
import type { Service } from "@/data/services";
import { services } from "@/data/services";

export default function ServiceDetailPage({ service }: { service: Service }) {
  const others = services.filter((item) => item.slug !== service.slug);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [service.slug]);

  return (
    <main className="min-h-screen bg-[#141111] text-[#f4f1ea]">
      <CursorDot />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -left-[20%] top-[-10%] h-[55vh] w-[70vw] rounded-full bg-[radial-gradient(circle,rgba(233,24,37,0.18),transparent_62%)] blur-2xl" />
        <div className="absolute bottom-[-15%] right-[-10%] h-[50vh] w-[55vw] rounded-full bg-[radial-gradient(circle,rgba(244,241,234,0.06),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(244,241,234,0.035)_1px,transparent_1px)] bg-size-[minmax(4.5rem,12vw)_100%] opacity-40 [mask-image:linear-gradient(to_bottom,#000_0%,#000_55%,transparent_100%)]" />
      </div>

      <SiteHeader contactHref="mailto:hello@593emarketing.com" />

      <section className="relative mx-auto flex min-h-[calc(100dvh-5rem)] max-w-7xl flex-col justify-end px-4 pb-16 pt-10 sm:px-6 sm:pb-20 lg:px-8 lg:pb-24">
        <div
          className={`transition duration-700 ease-out ${
            ready ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
        >
          <Link
            href="/hizmetlerimiz"
            className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45 transition hover:text-[#f4f1ea]"
          >
            <span aria-hidden>←</span>
            Hizmetlerimiz
          </Link>
        </div>

        <div className="relative mt-10 sm:mt-14">
          <p
            className={`font-logo text-[clamp(1.15rem,2.6vw,1.55rem)] font-bold tracking-[-0.02em] text-[#f4f1ea] transition duration-700 delay-100 ease-out ${
              ready ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
            }`}
          >
            593 E-MARKETİNG
          </p>

          <h1
            className={`mt-4 max-w-[14ch] font-display text-[clamp(3.2rem,11vw,7.5rem)] font-bold leading-[0.86] tracking-[-0.07em] transition duration-700 delay-150 ease-out ${
              ready ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
            }`}
          >
            {service.title}
          </h1>

          <p
            className={`mt-7 max-w-xl text-[16px] leading-8 text-white/55 transition duration-700 delay-200 ease-out sm:text-[17px] ${
              ready ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
            }`}
          >
            {service.headline}
          </p>

          <div
            className={`mt-10 flex flex-wrap items-center gap-4 transition duration-700 delay-300 ease-out ${
              ready ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
            }`}
          >
            <a
              href="mailto:hello@593emarketing.com"
              className="rounded-full bg-[#f4f1ea] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#141111] transition duration-300 hover:bg-[#e91825] hover:text-white"
            >
              Proje Başlat
            </a>
            <a
              href="tel:+905435939533"
              className="text-sm text-white/45 transition hover:text-[#f4f1ea]"
            >
              +90 543 593 95 33
            </a>
          </div>
        </div>
      </section>

      <section className="relative border-t border-white/8">
        <div className="mx-auto grid max-w-7xl gap-14 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-12 lg:gap-10 lg:px-8 lg:py-24">
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

      {service.slug === "web-tasarim" ? <BuiltSitesShowcase /> : null}

      <section className="relative border-t border-white/8">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
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
              className="text-[13px] text-white/45 transition hover:text-[#f4f1ea]"
            >
              Tüm hizmetler ↗
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
                  <span
                    aria-hidden
                    className="text-[1.1rem] text-white/35 transition group-hover:translate-x-0.5 group-hover:text-[#e91825]"
                  >
                    ↗
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <SiteFooter homeAnchors />
    </main>
  );
}
