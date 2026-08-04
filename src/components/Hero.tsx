"use client";

import Image from "next/image";
import Link from "next/link";
import {
  motion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useCallback, useRef, useState } from "react";
import MenuOverlay from "./MenuOverlay";

/**
 * LaunchFolio scroll path:
 * Hero fan on the right → opens while traveling into a 3×2 grid.
 */
const PROJECTS = [
  {
    title: "Dijital Pazarlama",
    category: "Büyüme & performans",
    image: "/services/dijital-pazarlama.jpg",
    href: "https://593emarketing.com/hizmetlerimiz/",
    from: { x: 58, y: 20, w: 40, r: -6 },
    to: { x: 0, y: 10, w: 32.8, r: 0 },
    z: 60,
  },
  {
    title: "Web Tasarım",
    category: "UI/UX & geliştirme",
    image: "/services/web-tasarim.jpg",
    href: "https://593emarketing.com/hizmetlerimiz/",
    from: { x: 52, y: 14, w: 38, r: 13 },
    to: { x: 33.6, y: 10, w: 32.8, r: 0 },
    z: 30,
  },
  {
    title: "SEO",
    category: "Organik görünürlük",
    image: "/services/seo.jpg",
    href: "https://593emarketing.com/hizmetlerimiz/",
    from: { x: 64, y: 10, w: 36, r: -2 },
    to: { x: 67.2, y: 10, w: 32.8, r: 0 },
    z: 40,
  },
  {
    title: "İnfofluencer",
    category: "Influencer pazarlama",
    image: "/services/infofluencer.jpg",
    href: "https://593emarketing.com/hizmetlerimiz/",
    from: { x: 60, y: 26, w: 38, r: 7 },
    to: { x: 0, y: 52, w: 32.8, r: 0 },
    z: 50,
  },
  {
    title: "Sosyal Medya",
    category: "İçerik & yönetim",
    image: "/services/sosyal-medya.jpg",
    href: "https://593emarketing.com/hizmetlerimiz/",
    from: { x: 54, y: 28, w: 36, r: -15 },
    to: { x: 33.6, y: 52, w: 32.8, r: 0 },
    z: 20,
  },
  {
    title: "Kreatif İçerik",
    category: "Prodüksiyon & içerik",
    image: "/services/kreatif-icerik.jpg",
    href: "https://593emarketing.com/hizmetlerimiz/",
    from: { x: 66, y: 24, w: 36, r: 11 },
    to: { x: 67.2, y: 52, w: 32.8, r: 0 },
    z: 25,
  },
] as const;

function ProjectCard({
  project,
  progress,
}: {
  project: (typeof PROJECTS)[number];
  progress: MotionValue<number>;
}) {
  // Tek akış: fan → açılırken grid’e süzülür (önce dock, sonra flatten yok)
  const left = useTransform(
    progress,
    [0, 0.1, 0.55, 1],
    [
      `${project.from.x}%`,
      `${project.from.x}%`,
      `${project.to.x}%`,
      `${project.to.x}%`,
    ],
  );
  const top = useTransform(
    progress,
    [0, 0.1, 0.55, 1],
    [
      `${project.from.y}%`,
      `${project.from.y}%`,
      `${project.to.y}%`,
      `${project.to.y}%`,
    ],
  );
  const width = useTransform(
    progress,
    [0, 0.1, 0.55, 1],
    [
      `${project.from.w}%`,
      `${project.from.w}%`,
      `${project.to.w}%`,
      `${project.to.w}%`,
    ],
  );
  // Rotate opens in sync with travel — “açılarak hareket”
  const rotate = useTransform(
    progress,
    [0, 0.1, 0.55, 1],
    [project.from.r, project.from.r, 0, 0],
  );
  const metaOpacity = useTransform(progress, [0.48, 0.62, 1], [0, 1, 1]);

  return (
    <motion.article
      style={{
        left,
        top,
        width,
        rotate,
        zIndex: project.z,
      }}
      className="absolute origin-center will-change-transform"
    >
      <div className="relative aspect-[5/4] overflow-hidden rounded-[22px] border border-black/[0.05] bg-[#111] shadow-[0_30px_70px_rgba(0,0,0,0.2)] sm:rounded-[28px]">
        <Image
          src={project.image}
          alt={project.title}
          fill
          sizes="(max-width: 768px) 90vw, 36vw"
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
      </div>

      <motion.div
        style={{ opacity: metaOpacity }}
        className="mt-2.5 flex items-end justify-between gap-2 px-0.5"
      >
        <div className="min-w-0">
          <h3 className="truncate font-display text-[13px] font-bold uppercase tracking-[-0.03em] text-black sm:text-[15px]">
            {project.title}
          </h3>
          <p className="truncate text-[11px] text-black/45 sm:text-[12px]">
            {project.category}
          </p>
        </div>
        <Link
          href={project.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-black/50 hover:text-[var(--accent)] sm:text-[12px]"
        >
          İncele <span aria-hidden="true">→</span>
        </Link>
      </motion.div>
    </motion.article>
  );
}

export default function Hero() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const trackRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  });

  const pageY = useTransform(scrollYProgress, [0, 0.36], ["0%", "-70%"]);
  const pageOpacity = useTransform(scrollYProgress, [0, 0.12, 0.32], [1, 0.5, 0]);
  const pageVisibility = useTransform(scrollYProgress, (v) =>
    v > 0.34 ? "hidden" : "visible",
  );

  // Title fades in as the stack opens into place
  const titleOpacity = useTransform(scrollYProgress, [0.12, 0.28, 1], [0, 1, 1]);
  const titleY = useTransform(scrollYProgress, [0.12, 0.28], [28, 0]);

  return (
    <>
      <div className="relative z-40 bg-white px-4 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <header className="mx-auto flex max-w-3xl items-center justify-between rounded-full bg-[#efefec] px-3 py-2 sm:px-4">
            <Link
              href="/"
              className="flex items-center gap-2.5 rounded-full bg-white/80 py-1.5 pl-1.5 pr-3"
            >
              <Image
                src="/593-logo.png"
                alt="593 EMarketing"
                width={28}
                height={28}
                className="h-7 w-7 rounded-full object-contain"
                priority
              />
              <span className="font-display text-[14px] font-semibold tracking-[-0.03em] text-black">
                593 E-Marketing
              </span>
            </Link>

            <nav className="hidden items-center gap-6 md:flex">
              {[
                { href: "#hizmetler", label: "Hizmetler" },
                { href: "#projeler", label: "Projeler" },
                { href: "#fiyat", label: "Fiyatlar" },
                { href: "#blog", label: "Blog" },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="text-[14px] font-medium text-black/70 hover:text-black"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <Link
                href="#iletisim"
                className="hidden rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-black shadow-sm sm:inline-flex"
              >
                İletişim
              </Link>
              <button
                type="button"
                aria-label="Menüyü aç"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white md:hidden"
              >
                <span className="flex flex-col gap-[4px]">
                  <span className="block h-[1.5px] w-4 bg-black" />
                  <span className="block h-[1.5px] w-4 bg-black" />
                </span>
              </button>
            </div>
          </header>
        </div>
      </div>

      <section
        id="hizmetler"
        ref={trackRef}
        className="relative h-[300vh] bg-white"
      >
        <div className="launch-grid pointer-events-none absolute inset-0 opacity-45" />

        <div className="sticky top-0 h-screen overflow-hidden">
          <div className="relative mx-auto h-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <motion.div
              style={{
                y: pageY,
                opacity: pageOpacity,
                visibility: pageVisibility,
              }}
              className="pointer-events-none absolute left-4 top-[10%] z-40 w-[min(100%,24rem)] sm:left-6 sm:top-[8%] lg:left-8"
            >
              <div className="pointer-events-auto">
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-black/45 sm:text-[13px]">
                  Dijital dünyada yol arkadaşınız
                </p>

                <h1 className="mt-4 font-display text-[clamp(2.2rem,5.2vw,4rem)] font-bold leading-[0.98] tracking-[-0.06em] text-black">
                  Dijitali tasarlıyoruz
                  <br />
                  geleceği şekillendiriyoruz.
                </h1>

                <p className="mt-4 max-w-[22rem] text-[15px] leading-7 text-black/55 sm:text-[16px]">
                  Veriye dayalı stratejilerimizle reklam bütçenizi en verimli
                  şekilde kullanarak markanızı dijitalde rakiplerinizin önüne
                  taşıyoruz.
                </p>

                <Link
                  href="#hizmetler"
                  className="mt-7 inline-flex items-center gap-3 rounded-full bg-black py-2 pl-2 pr-5 text-[14px] font-semibold text-white shadow-[0_12px_30px_rgba(0,0,0,0.16)]"
                >
                  <Image
                    src="/593-logo.png"
                    alt=""
                    width={34}
                    height={34}
                    className="h-9 w-9 rounded-full bg-white object-contain p-1"
                  />
                  Hemen keşfedin
                </Link>
              </div>
            </motion.div>

            <motion.h2
              style={{ opacity: titleOpacity, y: titleY }}
              className="pointer-events-none absolute left-4 top-6 z-20 font-display text-[clamp(1.85rem,4vw,3.1rem)] font-bold tracking-[-0.06em] text-black sm:left-6 sm:top-8 lg:left-8"
            >
              Hizmetlerimiz
            </motion.h2>

            <div className="absolute inset-0 z-30 pb-28">
              {PROJECTS.map((project) => (
                <ProjectCard
                  key={project.title}
                  project={project}
                  progress={scrollYProgress}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <MenuOverlay open={menuOpen} onClose={closeMenu} />
    </>
  );
}
