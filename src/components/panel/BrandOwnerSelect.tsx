"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type StaffOption = { id: string; label: string };

/** Marka sorumlusu — ajans içi tek kişi (tablo filtresi + bildirim alıcısı). */
export default function BrandOwnerSelect({
  tenantSlug,
  ownerId,
  staff,
  disabled = false,
}: {
  tenantSlug: string;
  ownerId: string | null;
  staff: StaffOption[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(ownerId ?? "");
  const [saving, setSaving] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function save(next: string) {
    const prev = value;
    setValue(next);
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/panel/tenant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantSlug, ownerId: next || null }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setValue(prev);
        setError(json.error || "Kaydedilemedi");
        return;
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setValue(prev);
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <label className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
      Sorumlu
      <select
        value={value}
        disabled={disabled || saving || refreshing}
        onChange={(e) => void save(e.target.value)}
        className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-800 disabled:opacity-60"
      >
        <option value="">— Atanmadı</option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      {error ? <span className="text-rose-600">{error}</span> : null}
    </label>
  );
}
