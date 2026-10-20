"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Mail } from "lucide-react";
import { btnPrimary, btnSecondary, fieldClass } from "@/components/panel/ds/buttons";
import { formatDateTime } from "@/lib/panel/format";
import type { SerializedReport } from "@/lib/panel/brand-report";

type Frequency = "none" | "weekly" | "monthly";

/**
 * Müşteri raporu: ajans yorumu + dönem → PDF indir / e-posta gönder.
 * Otomatik gönderim sıklığı ve alıcıları burada ayarlanır.
 */
export default function BrandReportPanel({
  tenantSlug,
  defaultFrom,
  defaultTo,
  frequency: initialFrequency,
  emails: initialEmails,
  recent,
  canEdit,
}: {
  tenantSlug: string;
  defaultFrom: string;
  defaultTo: string;
  frequency: Frequency;
  emails: string[];
  recent: SerializedReport[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [comment, setComment] = useState("");
  const [frequency, setFrequency] = useState<Frequency>(initialFrequency);
  const [emails, setEmails] = useState(initialEmails.join(", "));
  const [pending, setPending] = useState<"send" | "settings" | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const base = `/api/panel/tenants/${encodeURIComponent(tenantSlug)}/report`;
  const downloadHref = `${base}?${new URLSearchParams({ from, to, comment })}`;

  async function send() {
    setPending("send");
    setMsg(null);
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, comment }),
      });
      const j = (await res.json().catch(() => null)) as
        | { sentTo?: string[]; error?: string }
        | null;
      if (!res.ok || !j?.sentTo) {
        setMsg({ tone: "err", text: j?.error || "Gönderilemedi" });
      } else {
        setMsg({ tone: "ok", text: `Gönderildi: ${j.sentTo.join(", ")}` });
        router.refresh();
      }
    } finally {
      setPending(null);
    }
  }

  async function saveSettings() {
    setPending("settings");
    setMsg(null);
    try {
      const res = await fetch(base, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportFrequency: frequency,
          reportEmails: emails.split(/[,;\s]+/).filter(Boolean),
        }),
      });
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      setMsg(
        res.ok
          ? { tone: "ok", text: "Otomatik rapor ayarı kaydedildi" }
          : { tone: "err", text: j?.error || "Kaydedilemedi" },
      );
      if (res.ok) router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">Müşteri raporu</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Dönem özeti PDF · ajans yorumu eklenir · e-posta ile gönderilir.
          Haftalık rapor Pazartesi (önceki hafta), aylık rapor ayın 1&apos;i (önceki ay) gider.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-zinc-600">
          Başlangıç
          <input type="date" className={`${fieldClass} mt-1 w-full`} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-xs text-zinc-600">
          Bitiş
          <input type="date" className={`${fieldClass} mt-1 w-full`} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="text-xs text-zinc-600 sm:col-span-2">
          Ajans yorumu
          <textarea
            className="mt-1 min-h-24 w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm text-[#141111] focus:border-[#141111] focus:outline-none"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Bu dönemde neler yaptık, ne öneriyoruz…"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <a href={downloadHref} target="_blank" rel="noopener" className={btnSecondary}>
          <Download className="size-4" aria-hidden />
          PDF indir
        </a>
        {canEdit ? (
          <button type="button" className={btnPrimary} disabled={pending === "send"} onClick={send}>
            <Mail className="size-4" aria-hidden />
            {pending === "send" ? "Gönderiliyor…" : "E-posta gönder"}
          </button>
        ) : null}
      </div>

      {canEdit ? (
        <div className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
          <label className="text-xs text-zinc-600">
            Otomatik rapor
            <select className={`${fieldClass} mt-1 w-full`} value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
              <option value="none">Kapalı</option>
              <option value="weekly">Haftalık</option>
              <option value="monthly">Aylık</option>
            </select>
          </label>
          <label className="text-xs text-zinc-600">
            Alıcılar (boş = müşteri kullanıcıları)
            <input className={`${fieldClass} mt-1 w-full`} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="ali@firma.com, ayse@firma.com" />
          </label>
          <button type="button" className={btnSecondary} disabled={pending === "settings"} onClick={saveSettings}>
            {pending === "settings" ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      ) : null}

      {msg ? (
        <p className={`text-xs ${msg.tone === "ok" ? "text-emerald-700" : "text-rose-600"}`}>{msg.text}</p>
      ) : null}

      {recent.length > 0 ? (
        <ul className="divide-y divide-zinc-100 text-xs">
          {recent.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="font-medium text-zinc-800">
                {r.from.slice(8, 10)}.{r.from.slice(5, 7)} – {r.to.slice(8, 10)}.{r.to.slice(5, 7)}.{r.to.slice(0, 4)}
              </span>
              <span className="text-zinc-500">{r.trigger === "cron" ? "otomatik" : r.createdBy || "elle"}</span>
              <span className={r.error ? "text-rose-600" : "text-emerald-700"}>
                {r.error ? `gönderilemedi — ${r.error}` : r.sentTo.length ? `→ ${r.sentTo.join(", ")}` : "—"}
              </span>
              <span className="ml-auto text-zinc-400">{formatDateTime(r.createdAt)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
