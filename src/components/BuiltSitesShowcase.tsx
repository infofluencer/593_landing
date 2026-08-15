import type { BuiltSite } from "@/data/builtSites";
import { builtSites } from "@/data/builtSites";

function SiteTile({
  site,
  size,
}: {
  site: BuiltSite;
  size: "lg" | "sm";
}) {
  const tall = size === "lg";
  const contain = site.fit === "contain";

  return (
    <a
      href={site.href}
      target="_blank"
      rel="noopener noreferrer"
      className={`group relative block h-full overflow-hidden ${
        contain ? "bg-[#0c0b0b]" : "bg-[#111]"
      } ${
        tall
          ? "min-h-[min(62vh,34rem)]"
          : "min-h-[min(30vh,16rem)]"
      }`}
    >
      <img
        src={`${site.image}?v=3`}
        alt={`${site.brand} web sitesi`}
        className={`absolute inset-0 h-full w-full transition duration-700 group-hover:scale-[1.02] ${
          contain
            ? "object-contain object-center"
            : "object-cover object-top"
        }`}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 transition duration-500 ${
          contain
            ? "bg-gradient-to-t from-[#141111] via-[#141111]/45 to-transparent"
            : "bg-gradient-to-t from-[#141111] via-[#141111]/35 to-transparent opacity-90 group-hover:opacity-95"
        }`}
      />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 sm:p-6">
        <div>
          <h3
            className={`font-display font-bold tracking-[-0.04em] text-[#f4f1ea] ${
              tall
                ? "text-[clamp(1.4rem,2.8vw,2.1rem)]"
                : "text-[clamp(1.15rem,2vw,1.45rem)]"
            }`}
          >
            {site.brand}
          </h3>
          <p className="mt-1 text-[13px] leading-6 text-white/55 sm:text-[14px]">
            {site.note}
          </p>
        </div>
        <span
          aria-hidden
          className="mb-1 shrink-0 text-[1.15rem] text-white/40 transition group-hover:translate-x-0.5 group-hover:text-[#e91825]"
        >
          ↗
        </span>
      </div>
    </a>
  );
}

export default function BuiltSitesShowcase({
  className = "",
}: {
  className?: string;
}) {
  const [a, b, c, d, e, f] = builtSites;

  return (
    <section className={`relative border-t border-white/8 ${className}`}>
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
          Canlıda
        </p>
        <h2 className="mt-3 max-w-3xl font-display text-[clamp(1.9rem,4.2vw,3.1rem)] font-bold leading-[1.05] tracking-[-0.05em]">
          Yaptığımız sitelerden bazıları
        </h2>
        <p className="mt-4 max-w-xl text-[15px] leading-7 text-white/50">
          Tasarım, teknik ve dönüşüm aynı ritimde. Her biri yayında — gerçek
          markalar, gerçek sonuç.
        </p>

        <div className="mt-10 grid items-stretch gap-4 lg:mt-12 lg:grid-cols-12 lg:gap-5">
          <div className="h-full lg:col-span-7">
            {a ? <SiteTile site={a} size="lg" /> : null}
          </div>
          <div className="grid h-full gap-4 lg:col-span-5 lg:grid-rows-2 lg:gap-5">
            {b ? <SiteTile site={b} size="sm" /> : null}
            {c ? <SiteTile site={c} size="sm" /> : null}
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:mt-5 lg:gap-5">
          {d ? <SiteTile site={d} size="sm" /> : null}
          {e ? <SiteTile site={e} size="sm" /> : null}
          {f ? <SiteTile site={f} size="sm" /> : null}
        </div>

        <p className="mt-10 font-display text-[clamp(1.35rem,3vw,2rem)] font-bold tracking-[-0.04em] text-[#f4f1ea]/85 sm:mt-12">
          Ve daha niceleri.
          <span className="mt-2 block text-[15px] font-normal leading-7 tracking-normal text-white/45 sm:mt-3 sm:text-[16px]">
            Kampanyalar, e-ticaret sistemleri, kurumsal siteler — liste burada
            bitmiyor.
          </span>
        </p>
      </div>
    </section>
  );
}
