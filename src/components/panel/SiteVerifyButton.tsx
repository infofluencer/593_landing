"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SiteVerifyButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onClick() {
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch("/api/panel/site-verify", { method: "POST" });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        result?: { status?: string; summary?: string };
      };
      if (!res.ok) {
        setMessage(json.error || "Site testi başarısız");
      } else {
        setMessage(
          `${json.result?.status ?? "?"} · ${json.result?.summary ?? "Tamam"}`,
        );
      }
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Network error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 transition hover:bg-amber-500/25 disabled:opacity-50"
      >
        {pending ? (
          <span
            className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-200 border-t-amber-800"
            aria-hidden
          />
        ) : null}
        {pending ? "Site test ediliyor…" : "Sitede test et (Playwright)"}
      </button>
      {pending ? (
        <p className="max-w-sm text-right text-[11px] leading-4 text-amber-800/80">
          Playwright çalışıyor — bu işlem 30–90 sn sürebilir, sayfayı kapatmayın.
        </p>
      ) : null}
      {message ? (
        <p className="max-w-sm text-right text-[11px] leading-4 text-zinc-500">
          {message}
        </p>
      ) : null}
    </div>
  );
}
