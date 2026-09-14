"use client";

import { useState } from "react";

export default function BrandPanelLinkActions({
  panelHost,
  panelUrl,
}: {
  panelHost: string;
  panelUrl: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyDomain() {
    try {
      await navigator.clipboard.writeText(panelHost);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback
      const el = document.createElement("textarea");
      el.value = panelHost;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <span className="inline-flex items-center gap-0.5">
      <a
        href={panelUrl}
        target="_blank"
        rel="noreferrer"
        title="Paneli aç"
        aria-label={`${panelHost} panelini aç`}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          className="h-3.5 w-3.5"
          aria-hidden
        >
          <path
            d="M8.5 4.5H5.2A1.2 1.2 0 0 0 4 5.7v9.1c0 .66.54 1.2 1.2 1.2h9.1c.66 0 1.2-.54 1.2-1.2V12.5M11.5 4.5H16v4.5M16 4.5 10 10.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </a>
      <button
        type="button"
        onClick={copyDomain}
        title={copied ? "Kopyalandı" : "Domaini kopyala"}
        aria-label={
          copied ? `${panelHost} kopyalandı` : `${panelHost} kopyala`
        }
        className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition hover:bg-zinc-100 ${
          copied
            ? "text-emerald-600"
            : "text-zinc-500 hover:text-zinc-900"
        }`}
      >
        {copied ? (
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className="h-3.5 w-3.5"
            aria-hidden
          >
            <path
              d="M5 10.5 8.2 13.5 15 6.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className="h-3.5 w-3.5"
            aria-hidden
          >
            <rect
              x="7"
              y="7"
              width="8"
              height="9"
              rx="1.2"
              stroke="currentColor"
              strokeWidth="1.5"
            />
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
  );
}
