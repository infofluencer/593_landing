"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AlertActions({
  alertId,
  assignee,
}: {
  alertId: string;
  assignee: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(assignee ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, string>) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/panel/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(json?.error ?? `İşlem başarısız (HTTP ${res.status})`);
        return;
      }
      router.refresh();
    } catch {
      setError("Bağlantı hatası, tekrar deneyin");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="sorumlu@…"
        className="w-40 rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-800"
      />
      <button
        type="button"
        disabled={pending || !value.trim()}
        onClick={() => patch({ action: "assign", assignee: value.trim() })}
        className="rounded px-2 py-1 text-[11px] text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50 disabled:opacity-40"
      >
        Ata
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => patch({ action: "resolve", note: "panel" })}
        title="Uyarıyı kapatır; sorun sürse de bu tür için 24 saat bildirim gitmez"
        className="rounded px-2 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-600/40 hover:bg-emerald-50 disabled:opacity-40"
      >
        {pending ? "…" : "Çözüldü"}
      </button>
      {error ? (
        <span role="alert" className="text-[11px] text-red-600">
          {error}
        </span>
      ) : null}
    </div>
  );
}
