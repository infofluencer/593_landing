"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import CursorDot from "./CursorDot";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import OutArrow from "./OutArrow";
import { CV_MAX_BYTES, type Position } from "@/data/positions";

const eyebrow =
  "text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40";
const label = "block text-[13px] font-medium text-[#f4f1ea]/85";
const field =
  "mt-2 w-full min-h-12 rounded-2xl border border-white/12 bg-white/[0.04] px-4 text-[15px] text-[#f4f1ea] outline-none transition placeholder:text-white/30 focus:border-[#e91825]/70";

export default function PositionPage({ position }: { position: Position }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <main className="relative min-h-screen bg-[#141111] text-[#f4f1ea]">
      <CursorDot />
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[#141111]" />
        <div className="absolute left-[-20%] top-[30%] h-[90vh] w-[80vw] rounded-full bg-[radial-gradient(circle_at_center,rgba(233,24,37,0.18)_0%,rgba(233,24,37,0.06)_40%,transparent_72%)] blur-[80px]" />
        <div className="absolute right-[-15%] top-[-10%] h-[70vh] w-[65vw] rounded-full bg-[radial-gradient(circle_at_center,rgba(244,241,234,0.05)_0%,transparent_68%)] blur-[90px]" />
      </div>

      <SiteHeader />

      {/* Opening */}
      <section className="relative z-10">
        <div className="page-x mx-auto max-w-7xl pt-10 pb-10 sm:pt-14 sm:pb-12 lg:pt-16">
          <div
            className={`transition duration-700 ease-out ${
              ready ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
            }`}
          >
            <Link
              href="/kariyer"
              className="inline-flex min-h-11 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40 transition hover:text-[#f4f1ea] lg:min-h-0"
            >
              <OutArrow className="size-3 rotate-180" />
              Tüm pozisyonlar
            </Link>
            <p className={`mt-6 ${eyebrow}`}>Açık pozisyon</p>
          </div>
        </div>
      </section>

      {/* Position */}
      <section className="relative z-10">
        <div className="page-x mx-auto max-w-7xl pb-20 sm:pb-28 lg:pb-32">
          <PositionDetail position={position} />
        </div>
      </section>

      {/* Application */}
      <section id="basvuru" className="relative z-10 scroll-mt-24">
        <div className="page-x mx-auto max-w-7xl border-t border-white/10 pb-24 pt-16 sm:pb-32 sm:pt-20">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:gap-20">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e91825]">
                Başvuru
              </p>
              <h2 className="mt-5 font-display text-[clamp(1.8rem,4vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.05em]">
                {position.title} için başvur.
              </h2>
              <p className="mt-6 text-[15px] leading-8 text-white/55 sm:text-[16px]">
                {position.applicationNote}
              </p>
              <p className="mt-4 text-[15px] leading-8 text-white/55 sm:text-[16px]">
                Ön eleme soruları kısa; dürüst yanıtlar hızlı dönüş demek.
                Başvurun doğrudan ekibimize e-posta olarak ulaşır.
              </p>
            </div>

            <ApplicationForm position={position} />
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function PositionDetail({ position }: { position: Position }) {
  const chips = [
    position.department,
    position.employment,
    position.workModel,
    position.location,
  ];

  return (
    <article className="mt-6 overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.025]">
      <div className="border-b border-white/10 px-6 py-8 sm:px-10 sm:py-10">
        <h2 className="font-display text-[clamp(1.9rem,4.5vw,3rem)] font-bold leading-[1.02] tracking-[-0.05em]">
          {position.title}
        </h2>
        <ul className="mt-6 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li
              key={chip}
              className="inline-flex min-h-9 items-center rounded-full border border-white/12 bg-white/[0.04] px-3.5 text-[12.5px] text-[#f4f1ea]/80"
            >
              {chip}
            </li>
          ))}
        </ul>
        <p className="mt-8 max-w-3xl text-[15px] leading-8 text-white/60 sm:text-[16px]">
          {position.intro}
        </p>
      </div>

      <div className="max-w-3xl space-y-12 px-6 py-10 sm:px-10 sm:py-12">
        <div>
          <p className={eyebrow}>Aradığımız yetkinlikler</p>
          <ul className="mt-5 space-y-4">
            {position.skills.map((item) => (
              <Bullet key={item}>{item}</Bullet>
            ))}
          </ul>
        </div>
        <div>
          <p className={eyebrow}>Bu rolde neler bekliyoruz</p>
          <ul className="mt-5 space-y-4">
            {position.expectations.map((item) => (
              <Bullet key={item}>{item}</Bullet>
            ))}
          </ul>
          <p className="mt-8 rounded-2xl border border-[#e91825]/30 bg-[#e91825]/8 px-5 py-4 text-[14px] leading-7 text-[#f4f1ea]/85">
            {position.bonus}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-white/10 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <p className="text-[14px] text-white/50">
          Çalışma modeli: {position.workModel}
        </p>
        <a
          href="#basvuru"
          className="inline-flex min-h-[3.25rem] items-center justify-center rounded-full bg-[#f4f1ea] px-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#141111] transition duration-300 hover:bg-[#e91825] hover:text-white lg:min-h-0 lg:py-3"
        >
          Başvur
        </a>
      </div>
    </article>
  );
}

function Bullet({ children }: { children: string }) {
  return (
    <li className="flex gap-3.5 text-[15px] leading-7 text-white/60">
      <span
        aria-hidden
        className="mt-[0.7rem] size-1.5 shrink-0 rounded-full bg-[#e91825]"
      />
      <span>{children}</span>
    </li>
  );
}

type Status = "idle" | "sending" | "done" | "error";

function ApplicationForm({ position }: { position: Position }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [cvName, setCvName] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    const form = e.currentTarget;
    const data = new FormData(form);

    const cv = data.get("cv");
    if (cv instanceof File && cv.size > CV_MAX_BYTES) {
      setError("CV en fazla 5 MB olabilir.");
      return;
    }

    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/career", { method: "POST", body: data });
      const json = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) throw new Error(json?.error || "Gönderilemedi.");
      setStatus("done");
      form.reset();
      setCvName("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Bir sorun oluştu. Tekrar deneyin.",
      );
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.025] px-6 py-12 text-center sm:px-10 sm:py-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e91825]">
          Başvurun ulaştı
        </p>
        <h3 className="mt-5 font-display text-[clamp(1.6rem,3.5vw,2.25rem)] font-bold leading-[1.1] tracking-[-0.04em]">
          Teşekkürler.
        </h3>
        <p className="mx-auto mt-5 max-w-md text-[15px] leading-8 text-white/55">
          Başvurunu inceleyip uygun görürsek e-posta ile sana döneceğiz.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-11 items-center gap-1.5 text-[14px] text-white/45 transition hover:text-[#f4f1ea]"
        >
          Ana sayfaya dön
          <OutArrow className="size-3.5" />
        </Link>
      </div>
    );
  }

  const required = position.screening.filter((q) => q.required);
  const preferred = position.screening.filter((q) => !q.required);

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-10"
    >
      <input type="hidden" name="position" value={position.slug} />
      <div aria-hidden className="hidden">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" name="website" />
        </label>
      </div>

      <fieldset className="space-y-5">
        <legend className={eyebrow}>İletişim bilgileri</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className={label}>
              Ad Soyad <Req />
            </label>
            <input
              id="name"
              name="name"
              required
              maxLength={120}
              autoComplete="name"
              className={field}
            />
          </div>
          <div>
            <label htmlFor="email" className={label}>
              E-posta <Req />
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              maxLength={160}
              autoComplete="email"
              className={field}
            />
          </div>
          <div>
            <label htmlFor="phone" className={label}>
              Telefon <Req />
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              maxLength={40}
              autoComplete="tel"
              className={field}
            />
          </div>
          <div>
            <label htmlFor="link" className={label}>
              LinkedIn veya portfolyo
            </label>
            <input
              id="link"
              name="link"
              type="url"
              placeholder="https://"
              maxLength={300}
              autoComplete="url"
              className={field}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className={eyebrow}>Ön eleme</legend>
        {required.map((q) => (
          <Question key={q.id} id={q.id} label={q.label} kind={q.kind} required />
        ))}
      </fieldset>

      <fieldset className="space-y-5">
        <legend className={eyebrow}>Tercih edilen nitelikler</legend>
        {preferred.map((q) => (
          <Question key={q.id} id={q.id} label={q.label} kind={q.kind} />
        ))}
      </fieldset>

      <fieldset className="space-y-5">
        <legend className={eyebrow}>Özgeçmiş</legend>
        <div>
          <label htmlFor="summary" className={label}>
            Yönettiğin sektörler ve doğrudan sorumluluk aldığın işler <Req />
          </label>
          <textarea
            id="summary"
            name="summary"
            required
            rows={5}
            maxLength={2000}
            placeholder="Örn. 2 yıl sağlık, 3 yıl e-ticaret; Meta ve Google hesaplarının günlük yönetimi, GTM ve CAPI kurulumları…"
            className={`${field} resize-y py-3 leading-7`}
          />
        </div>
        <div>
          <span className={label}>
            CV (PDF, en fazla 5 MB) <Req />
          </span>
          <label
            htmlFor="cv"
            className="mt-2 flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-2xl border border-dashed border-white/20 bg-white/[0.03] px-4 py-3 text-[14px] transition hover:border-[#e91825]/60"
          >
            <span className={cvName ? "truncate text-[#f4f1ea]" : "text-white/40"}>
              {cvName || "PDF seç"}
            </span>
            <span className="shrink-0 rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70">
              Dosya seç
            </span>
          </label>
          <input
            id="cv"
            name="cv"
            type="file"
            accept="application/pdf,.pdf"
            required
            className="sr-only"
            onChange={(e) => setCvName(e.target.files?.[0]?.name ?? "")}
          />
        </div>
      </fieldset>

      <label className="flex gap-3 text-[13px] leading-6 text-white/55">
        <input
          type="checkbox"
          name="consent"
          required
          className="mt-1 size-4 shrink-0 accent-[#e91825]"
        />
        <span>
          Başvurum kapsamında paylaştığım kişisel verilerin, 593 E-Marketing
          tarafından işe alım sürecinin yürütülmesi amacıyla işlenmesini ve
          e-posta ile ekibe iletilmesini kabul ediyorum. <Req />
        </span>
      </label>

      <div className="space-y-3">
        <button
          type="submit"
          disabled={status === "sending"}
          className="flex min-h-[3.25rem] w-full items-center justify-center rounded-full bg-[#f4f1ea] px-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#141111] transition duration-300 hover:bg-[#e91825] hover:text-white disabled:opacity-50 sm:w-auto sm:px-10"
        >
          {status === "sending" ? "Gönderiliyor…" : "Başvuruyu gönder"}
        </button>
        {error ? (
          <p role="alert" className="text-[13px] text-[#e91825]">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function Req() {
  return (
    <span aria-hidden className="text-[#e91825]">
      *
    </span>
  );
}

function Question({
  id,
  label: text,
  kind,
  required = false,
}: {
  id: string;
  label: string;
  kind: "years" | "yesno";
  required?: boolean;
}) {
  const name = `q_${id}`;

  if (kind === "years") {
    return (
      <div>
        <label htmlFor={name} className={label}>
          {text} {required ? <Req /> : null}
        </label>
        <input
          id={name}
          name={name}
          type="number"
          inputMode="numeric"
          min={0}
          max={60}
          step={1}
          required={required}
          placeholder="Yıl"
          className={`${field} sm:max-w-[10rem]`}
        />
      </div>
    );
  }

  return (
    <fieldset>
      <legend className={label}>
        {text} {required ? <Req /> : null}
      </legend>
      <div className="mt-2 flex gap-2">
        {(["yes", "no"] as const).map((v) => (
          <label
            key={v}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 text-[14px] text-[#f4f1ea]/80 transition has-[:checked]:border-[#e91825] has-[:checked]:bg-[#e91825]/15 has-[:checked]:text-[#f4f1ea] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#e91825]/60"
          >
            <input
              type="radio"
              name={name}
              value={v}
              required={required}
              className="sr-only"
            />
            {v === "yes" ? "Evet" : "Hayır"}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
