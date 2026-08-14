import Link from "next/link";

export default function SiteHeader({
  contactHref = "/#contact",
}: {
  contactHref?: string;
}) {
  return (
    <header className="relative z-30 flex w-full items-center justify-between pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(1rem,env(safe-area-inset-top))] sm:pr-6 lg:pr-8">
      <Link
        href="/"
        className="font-logo text-[clamp(1.35rem,3.4vw,2.1rem)] font-bold leading-none tracking-[-0.02em] text-[#f4f1ea]"
      >
        593 E-MARKETİNG
      </Link>
      <nav className="flex items-center gap-5 sm:gap-7">
        <Link
          href="/hizmetlerimiz"
          className="inline-flex items-center gap-1.5 border-b border-[#f4f1ea]/70 pb-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f4f1ea] transition hover:border-[#e91825] hover:text-[#e91825]"
        >
          Hizmetler
          <span aria-hidden className="text-[12px] leading-none">
            ↗
          </span>
        </Link>
        <Link
          href={contactHref}
          className="rounded-full bg-[#f4f1ea] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#141111] transition duration-300 hover:bg-[#e91825] hover:text-white sm:px-6 sm:py-3"
        >
          İletişim
        </Link>
      </nav>
    </header>
  );
}
