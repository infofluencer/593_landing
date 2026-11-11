"use client";

import { useState } from "react";

const MASK = "••••••••••";

async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  }
}

export default function BrandPanelPassword({ tenantSlug }: { tenantSlug: string }) {
  const [password, setPassword] = useState<string | null | undefined>(undefined);
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<string | null> {
    if (password !== undefined) return password;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/panel/tenants/${encodeURIComponent(tenantSlug)}/panel-password`,
        { cache: "no-store" },
      );
      const json = (await res.json().catch(() => ({}))) as {
        password?: string | null;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Şifre alınamadı");
      const value = json.password ?? null;
      setPassword(value);
      return value;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Şifre alınamadı");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function toggle() {
    if (visible) {
      setVisible(false);
      return;
    }
    await load();
    setVisible(true);
  }

  async function copy() {
    const value = await load();
    if (!value) return;
    await writeClipboard(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  const missing = password === null;
  const text = visible
    ? missing
      ? "Kayıtlı şifre yok"
      : password ?? MASK
    : MASK;

  const btn =
    "inline-flex h-7 w-7 items-center justify-center rounded-md transition hover:bg-zinc-100 disabled:opacity-40";

  return (
    <div className="mt-3 border-t border-zinc-100 pt-2.5">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-400">
        Şifre
      </p>
      <div className="mt-1 flex min-w-0 items-center gap-2">
        <span
          className={`min-w-0 break-all font-mono text-xs ${
            visible && missing ? "text-zinc-400" : "text-zinc-700"
          }`}
        >
          {text}
        </span>
        <span className="inline-flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={toggle}
            disabled={loading}
            title={visible ? "Gizle" : "Göster"}
            aria-label={visible ? "Şifreyi gizle" : "Şifreyi göster"}
            className={`${btn} text-zinc-500 hover:text-zinc-900`}
          >
            {visible ? (
              <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden>
                <path
                  d="M3 3l14 14M8.6 8.6a2 2 0 0 0 2.8 2.8M6.2 6.3C4.6 7.3 3.4 8.6 2.5 10c1.6 2.7 4.3 5 7.5 5 1.3 0 2.5-.4 3.6-1M9 5.1c.3 0 .7-.1 1-.1 3.2 0 5.9 2.3 7.5 5-.5.8-1.1 1.6-1.8 2.3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden>
                <path
                  d="M2.5 10c1.6-2.7 4.3-5 7.5-5s5.9 2.3 7.5 5c-1.6 2.7-4.3 5-7.5 5s-5.9-2.3-7.5-5Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={copy}
            disabled={loading || missing}
            title={copied ? "Kopyalandı" : "Şifreyi kopyala"}
            aria-label={copied ? "Şifre kopyalandı" : "Şifreyi kopyala"}
            className={`${btn} ${
              copied ? "text-emerald-600" : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            {copied ? (
              <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden>
                <path
                  d="M5 10.5 8.2 13.5 15 6.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden>
                <rect x="7" y="7" width="8" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="M13 7V5.2A1.2 1.2 0 0 0 11.8 4H5.2A1.2 1.2 0 0 0 4 5.2v6.6c0 .66.54 1.2 1.2 1.2H7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
        </span>
      </div>
      {error ? <p className="mt-1 text-[11px] text-red-600">{error}</p> : null}
    </div>
  );
}
