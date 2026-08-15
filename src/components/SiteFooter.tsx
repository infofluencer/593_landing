import Link from "next/link";
import { services } from "@/data/services";

/** 44px rows through the tablet range, tight rhythm on pointer-sized screens. */
const linkClass =
  "flex min-h-11 items-center text-[14px] text-[#f4f1ea]/75 transition hover:text-[#f4f1ea] lg:inline-flex lg:min-h-0";

const pageLinks = [
  { label: "Ana Sayfa", href: "/" },
  { label: "Hakkımızda", href: "/hakkimizda" },
  { label: "Hizmetler", href: "/hizmetlerimiz" },
];

export default function SiteFooter() {
  return (
    <footer
      id="site-footer"
      className="relative z-10 overflow-x-clip border-t border-white/8 bg-[#141111] text-[#f4f1ea]"
    >
      <div className="page-x mx-auto max-w-7xl pb-10 pt-16 sm:pb-12 sm:pt-20 lg:pt-24">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
              Sonraki adım
            </p>
            <h2 className="mt-4 font-display text-[clamp(2.2rem,5.5vw,4.25rem)] font-bold leading-[0.95] tracking-[-0.06em]">
              Markanı doğru
              <br />
              ritimde büyütelim.
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-7 text-white/45">
              Tasarım, strateji ve büyüme tek elde. Kısa bir brifle başlayalım;
              gerisini birlikte netleştirelim.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <a
              href="mailto:info@593emarketing.com"
              className="flex min-h-[3.25rem] items-center justify-center rounded-full bg-[#f4f1ea] px-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#141111] transition duration-300 hover:bg-[#e91825] hover:text-white lg:min-h-0 lg:py-3"
            >
              Proje Başlat
            </a>
            <a
              href="tel:+905435939533"
              className="flex min-h-[3.25rem] items-center justify-center rounded-full border border-white/15 px-6 text-sm text-white/70 transition hover:text-[#f4f1ea] lg:min-h-0 lg:border-0 lg:px-0 lg:text-white/50"
            >
              +90 543 593 95 33
            </a>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-2 gap-x-8 gap-y-10 border-t border-white/8 pt-12 sm:mt-20 sm:grid-cols-4 sm:pt-14">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
              Sayfalar
            </p>
            <ul className="mt-2 space-y-0 sm:mt-4 lg:space-y-3">
              {pageLinks.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className={linkClass}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
              Hizmetler
            </p>
            <ul className="mt-2 space-y-0 sm:mt-4 lg:space-y-3">
              {services.slice(0, 4).map((service) => (
                <li key={service.slug}>
                  <Link
                    href={`/hizmetlerimiz/${service.slug}`}
                    className={linkClass}
                  >
                    {service.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
              Sosyal
            </p>
            <ul className="mt-2 space-y-0 sm:mt-4 lg:space-y-3">
              <li>
                <a
                  href="https://www.instagram.com/593emarketing/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  Instagram
                </a>
              </li>
              <li>
                <a
                  href="https://www.linkedin.com/company/593-emarketing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  LinkedIn
                </a>
              </li>
              <li>
                <a
                  href="https://593emarketing.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  593emarketing.com
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
              İletişim
            </p>
            <ul className="mt-2 space-y-0 text-[14px] text-[#f4f1ea]/75 sm:mt-4 lg:space-y-3">
              <li className="flex min-h-11 items-center lg:min-h-0">
                İstanbul, Türkiye
              </li>
              <li>
                <a href="mailto:info@593emarketing.com" className={linkClass}>
                  info@593emarketing.com
                </a>
              </li>
              <li>
                <a href="tel:+905435939533" className={linkClass}>
                  +90 543 593 95 33
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-2 sm:mt-16 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] text-white/35">
            © {new Date().getFullYear()} 593 E-Marketing
          </p>
          <p className="text-[12px] text-white/25">
            Tasarım · Strateji · Dönüşüm
          </p>
        </div>
      </div>

      <div className="pointer-events-none max-w-full select-none overflow-hidden px-2 pb-[max(0.75rem,var(--safe-b))] pt-6 sm:px-4">
        <p className="font-logo whitespace-nowrap text-center text-[clamp(1.9rem,10.5vw,9.5rem)] font-extrabold leading-[1.2] tracking-[-0.055em] text-[#f4f1ea]/[0.1]">
          593 E-MARKETİNG
        </p>
      </div>
    </footer>
  );
}
