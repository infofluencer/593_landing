"use client";

import { useState } from "react";

/**
 * Kreatif görseli — kırpmadan sığdırır (dikey story, kare, yatay link
 * görseli hepsi tam görünür); boşluk aynı görselin bulanık kopyasıyla dolar.
 * Link süresi dolmuşsa küçük resme, o da yoksa yer tutucuya düşer.
 */
export default function CreativeImage({
  src,
  fallback,
  href,
  title,
}: {
  src: string | null;
  fallback?: string | null;
  href?: string | null;
  title?: string;
}) {
  const [current, setCurrent] = useState<string | null>(src ?? fallback ?? null);

  function onError() {
    if (fallback && current !== fallback) setCurrent(fallback);
    else setCurrent(null);
  }

  const body = current ? (
    <span className="relative block aspect-square w-full overflow-hidden bg-zinc-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={current}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-xl"
        referrerPolicy="no-referrer"
        loading="lazy"
        decoding="async"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={current}
        alt=""
        className="relative h-full w-full object-contain"
        referrerPolicy="no-referrer"
        loading="lazy"
        decoding="async"
        onError={onError}
      />
    </span>
  ) : (
    <span className="flex aspect-square w-full items-center justify-center bg-zinc-100 text-xs text-zinc-400">
      Görsel alınamadı
    </span>
  );

  if (href && current) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block transition hover:opacity-95"
        title={title ?? "Yayındaki içeriği aç"}
      >
        {body}
      </a>
    );
  }
  return body;
}
