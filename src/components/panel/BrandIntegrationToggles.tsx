"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, CircleSlash, Link2Off } from "lucide-react";
import {
  INTEGRATIONS,
  type IntegrationKey,
} from "@/lib/panel/integrations";

/**
 * Marka bazında platform aç/kapat. Kapalı platform senkronlanmaz ve eksik
 * eşleşme / çekim hatası uyarı sayılmaz (örn. Google'ı hiç kullanmayan marka).
 */
export default function BrandIntegrationToggles({
  tenantSlug,
  disabled,
  connections,
  canEdit,
}: {
  tenantSlug: string;
  disabled: string[];
  /** Platform → eşleşen hesap kimliği (yoksa null). */
  connections: Record<IntegrationKey, string | null>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<string[]>(disabled);
  const [saving, setSaving] = useState<IntegrationKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function toggle(key: IntegrationKey) {
    const next = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key];
    const prev = current;
    setCurrent(next);
    setSaving(key);
    setError(null);
    try {
      const res = await fetch("/api/panel/tenant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantSlug, disabledIntegrations: next }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Kaydedilemedi");
      startTransition(() => router.refresh());
    } catch (err) {
      setCurrent(prev);
      setError(err instanceof Error ? err.message : "Kaydedilemedi");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
      <div>
        <h3 className="text-base font-semibold text-[#141111]">Platformlar</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Markanın kullanmadığı platformu kapatın: veri çekilmez, eksik kurulum
          ve çekim hataları uyarı olarak görünmez. Kapatınca o platformun eski
          hata kayıtları ve açık uyarıları temizlenir.
        </p>
      </div>
      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
      ) : null}
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {INTEGRATIONS.map((i) => {
          const off = current.includes(i.key);
          const conn = connections[i.key];
          return (
            <li
              key={i.key}
              className={`flex flex-col gap-3 rounded-xl border p-4 transition ${
                off ? "border-zinc-200 bg-zinc-50" : "border-zinc-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${off ? "text-zinc-500" : "text-[#141111]"}`}>
                    {i.label}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">{i.description}</p>
                </div>
                {off ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-semibold text-zinc-700">
                    <CircleSlash className="size-3.5" aria-hidden />
                    Kullanılmıyor
                  </span>
                ) : conn ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                    <CheckCircle2 className="size-3.5" aria-hidden />
                    Bağlı
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                    <Link2Off className="size-3.5" aria-hidden />
                    Eşleşme yok
                  </span>
                )}
              </div>
              <p className="truncate font-mono text-xs text-zinc-500" title={conn ?? undefined}>
                {conn ?? "—"}
              </p>
              <button
                type="button"
                role="switch"
                aria-checked={!off}
                disabled={!canEdit || saving !== null}
                onClick={() => toggle(i.key)}
                className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition disabled:opacity-50 ${
                  off
                    ? "bg-[#141111] text-[#f4f1ea] hover:bg-[#e91825] hover:text-white"
                    : "border border-zinc-300 bg-white text-[#141111] hover:border-[#141111]"
                }`}
              >
                {saving === i.key
                  ? "Kaydediliyor…"
                  : off
                    ? "Tekrar etkinleştir"
                    : "Bu markada kullanılmıyor"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
