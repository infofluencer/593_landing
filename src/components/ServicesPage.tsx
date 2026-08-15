"use client";

import Link from "next/link";
import Image from "next/image";
import CursorDot from "./CursorDot";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import { infofluencerService, services } from "@/data/services";

const serviceCards = [
  ...services.map((service) => ({
    title: service.title,
    image: service.image,
    line: service.line,
    href: `/hizmetlerimiz/${service.slug}`,
    external: false,
  })),
  {
    title: infofluencerService.title,
    image: "/services/infofluencer.jpg",
    line: infofluencerService.line,
    href: infofluencerService.href,
    external: true,
  },
];

export default function ServicesPage() {
  return (
    <main className="min-h-screen bg-[#141111] text-[#f4f1ea]">
      <CursorDot />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(233,24,37,0.12),transparent_42%),radial-gradient(ellipse_at_bottom_right,rgba(244,241,234,0.05),transparent_40%)]"
      />

      <SiteHeader contactHref="mailto:hello@593emarketing.com" />

      <section className="page-x relative mx-auto max-w-6xl pb-10 pt-10 sm:pt-20 lg:pt-24">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
          593 E-Marketing
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-[clamp(2.4rem,7vw,5rem)] font-bold leading-[0.92] tracking-[-0.06em]">
          Hizmetlerimiz
        </h1>
        <p className="mt-5 max-w-xl text-[15px] leading-7 text-white/50 sm:text-base">
          Tasarım, strateji ve büyüme tek ritimde. Markanın her katmanını aynı
          sistem gibi kuruyoruz.
        </p>
      </section>

      <section className="page-x relative mx-auto max-w-6xl pb-12 lg:pb-8">
        <ul className="grid gap-5 sm:grid-cols-2 lg:gap-6">
          {serviceCards.map((service) => {
            const CardInner = (
              <>
                <div className="relative aspect-square overflow-hidden bg-[#111]">
                  <Image
                    src={service.image}
                    alt={service.title}
                    fill
                    sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 40vw"
                    className="object-cover transition duration-700 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="p-6 sm:p-7">
                  <h2 className="inline-flex items-center gap-2 font-display text-[clamp(1.35rem,2.4vw,1.85rem)] font-bold tracking-[-0.04em]">
                    {service.title}
                    <span aria-hidden className="text-[0.85em] text-white/40">
                      ↗
                    </span>
                  </h2>
                  <p className="mt-3 text-[14px] leading-7 text-white/50 sm:text-[15px]">
                    {service.line}
                  </p>
                </div>
              </>
            );

            return (
              <li
                key={service.title}
                className="group overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#1c1818]"
              >
                {service.external ? (
                  <a
                    href={service.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    {CardInner}
                  </a>
                ) : (
                  <Link href={service.href} className="block">
                    {CardInner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <SiteFooter />
    </main>
  );
}
