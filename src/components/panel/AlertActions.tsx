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

  async function patch(body: Record<string, string>) {
    setPending(true);
    try {
      await fetch(`/api/panel/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      router.refresh();
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
        className="rounded px-2 py-1 text-[11px] text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/10 disabled:opacity-40"
      >
        Çözüldü
      </button>
    </div>
  );
}
