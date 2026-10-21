"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function BrandVisibilityToggle({
  tenantSlug,
  visible,
  variant = "card",
  onChanged,
}: {
  tenantSlug: string;
  visible: boolean;
  variant?: "card" | "settings" | "menu";
  onChanged?: (visible: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function setVisible(next: boolean) {
    if (next === visible || pending) return;
    setError(null);
    try {
      const res = await fetch("/api/panel/tenant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantSlug, visible: next }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Güncellenemedi");
        return;
      }
      onChanged?.(next);
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    }
  }

  if (variant === "settings") {
    return (
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium text-zinc-500">Durum</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={pending}
            onClick={() => setVisible(true)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
              visible
                ? "border-emerald-500/40 bg-emerald-50 text-emerald-800"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
            } disabled:opacity-60`}
          >
            Aktif
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setVisible(false)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
              !visible
                ? "border-zinc-500/40 bg-zinc-100 text-zinc-700"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
            } disabled:opacity-60`}
          >
            Devre dışı
          </button>
        </div>
        <p className="text-[11px] text-zinc-500">
          Devre dışı markalardan Meta / Google verisi çekilmez.
        </p>
        {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
      </div>
    );
  }

  if (variant === "menu") {
    return (
      <>
        <button
          type="button"
          role="menuitem"
          disabled={pending}
          onClick={() => setVisible(!visible)}
          className={`flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-xs hover:bg-zinc-100 disabled:opacity-60 ${
            visible ? "text-zinc-700" : "text-emerald-700"
          }`}
        >
          {pending
            ? "Kaydediliyor…"
            : visible
              ? "Devre dışı bırak"
              : "Aktifleştir"}
        </button>
        {error ? <p className="px-2.5 pb-1 text-[10px] text-red-600">{error}</p> : null}
      </>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => setVisible(!visible)}
        className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[10px] font-medium text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900 disabled:opacity-60"
      >
        {pending
          ? "Kaydediliyor…"
          : visible
            ? "Devre dışı bırak"
            : "Aktifleştir"}
      </button>
      {error ? <p className="text-[10px] text-red-600">{error}</p> : null}
    </div>
  );
}
