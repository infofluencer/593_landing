"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDateTime } from "@/lib/panel/format";

type TenantStatus = {
  id: string;
  slug: string;
  name: string;
  status: "pending" | "running" | "success" | "error" | null;
  error: string | null;
  lastSuccessAt: string | null;
  updatedAt: string | null;
};

const LABEL: Record<NonNullable<TenantStatus["status"]>, string> = {
  pending: "Bekliyor",
  running: "Çalışıyor",
  success: "Dolduruldu",
  error: "Hata",
};

function statusClass(s: TenantStatus["status"]) {
  if (s === "success") return "text-emerald-600";
  if (s === "error") return "text-rose-600";
  if (s === "running") return "text-amber-700";
  return "text-zinc-400";
}

/**
 * Geriye dönük doldurma: aktif markalar için 720 gün kampanya + dönüşüm + GA4.
 * Doldurulanlar atlanır; "Hepsini yeniden" zorla tekrarlar.
 */
export function BackfillPanel({
  initial,
  initialRunning,
  version,
}: {
  initial: TenantStatus[];
  initialRunning: boolean;
  version: string;
}) {
  const [tenants, setTenants] = useState(initial);
  const [running, setRunning] = useState(initialRunning);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/panel/backfill", { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as {
      running: boolean;
      tenants: TenantStatus[];
    };
    setTenants(json.tenants);
    setRunning(json.running);
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => void refresh(), 5000);
    return () => clearInterval(id);
  }, [running, refresh]);

  async function start(force: boolean) {
    if (
      force &&
      !window.confirm(
        "Tüm aktif markalar 720 gün baştan çekilecek. Uzun sürebilir. Devam?",
      )
    ) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/panel/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const json = (await res.json()) as { message?: string; error?: string };
      setMessage(json.message || json.error || null);
      if (res.ok) {
        setRunning(true);
        setTimeout(() => void refresh(), 1500);
      }
    } finally {
      setBusy(false);
    }
  }

  const done = tenants.filter((t) => t.status === "success").length;

  return (
    <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">
            Geriye dönük doldurma
          </h3>
          <p className="mt-1 max-w-2xl text-xs text-zinc-500">
            Aktif markalar için son 720 gün: Meta kampanya, Google Ads kampanya +
            dönüşüm aksiyonları (günlük) ve GA4 günlük veriler yeni dönüşüm
            kurallarıyla yeniden yazılır. Markalar sırayla işlenir; doldurulmuş
            olanlar atlanır, yarıda kalırsa tekrar başlatmak kaldığı yerden
            devam eder.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Sürüm <span className="font-mono">{version}</span> · {done}/
            {tenants.length} marka dolduruldu
            {running ? " · çalışıyor…" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || running || done === tenants.length}
            onClick={() => void start(false)}
            className="rounded-md bg-[#e91825] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            Eksikleri doldur
          </button>
          <button
            type="button"
            disabled={busy || running}
            onClick={() => void start(true)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 disabled:opacity-50"
          >
            Hepsini yeniden
          </button>
        </div>
      </div>

      {message ? (
        <p className="rounded-md bg-zinc-100 px-3 py-2 text-xs text-zinc-700">
          {message}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-[11px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2">Marka</th>
              <th className="px-3 py-2">Durum</th>
              <th className="px-3 py-2">Son doldurma</th>
              <th className="px-3 py-2">Not</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {tenants.map((t) => (
              <tr key={t.id}>
                <td className="px-3 py-2 font-medium text-zinc-800">
                  {t.name}
                  <span className="ml-2 font-mono text-[11px] text-zinc-400">
                    {t.slug}
                  </span>
                </td>
                <td className={`px-3 py-2 ${statusClass(t.status)}`}>
                  {t.status ? LABEL[t.status] : "Yapılmadı"}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-zinc-500">
                  {formatDateTime(t.lastSuccessAt)}
                </td>
                <td className="max-w-md px-3 py-2 text-zinc-500">
                  {t.error ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
