"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { brandInitials } from "@/lib/panel/brand-logos";

export default function BrandCoverUpload({
  tenantSlug,
  brandName,
  coverUrl,
  fallbackSrc,
  variant = "settings",
  onChanged,
}: {
  tenantSlug: string;
  brandName: string;
  coverUrl?: string | null;
  fallbackSrc?: string | null;
  variant?: "settings" | "card";
  onChanged?: (coverUrl: string | null) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const preview = coverUrl || fallbackSrc || null;

  async function upload(file: File) {
    setError(null);
    const body = new FormData();
    body.set("file", file);
    try {
      const res = await fetch(
        `/api/panel/tenants/${encodeURIComponent(tenantSlug)}/cover`,
        { method: "POST", body },
      );
      const json = (await res.json()) as { error?: string; coverUrl?: string | null };
      if (!res.ok) {
        setError(json.error || "Yüklenemedi");
        return;
      }
      onChanged?.(json.coverUrl ?? null);
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    }
  }

  async function removeCover() {
    if (!coverUrl || pending) return;
    setError(null);
    try {
      const res = await fetch(
        `/api/panel/tenants/${encodeURIComponent(tenantSlug)}/cover`,
        { method: "DELETE" },
      );
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Silinemedi");
        return;
      }
      onChanged?.(null);
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    }
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      className="sr-only"
      disabled={pending}
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) void upload(file);
      }}
    />
  );

  if (variant === "card") {
    return (
      <div className="flex flex-col items-center gap-1">
        {fileInput}
        <button
          type="button"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
          className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[10px] font-medium text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900 disabled:opacity-60"
        >
          {pending ? "Yükleniyor…" : coverUrl ? "Kapağı değiştir" : "Kapak ekle"}
        </button>
        {error ? <p className="text-[10px] text-red-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-zinc-800">Kapak fotoğrafı</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Bilgisayardan JPG, PNG veya WebP yükleyin. Görsel kare 1024×1024
          olarak kırpılıp kaydedilir.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="size-28 overflow-hidden rounded-[1.1rem] border border-zinc-200 bg-[#f4f1ea]">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt=""
              className={
                coverUrl
                  ? "h-full w-full object-cover"
                  : "h-full w-full object-contain p-3"
              }
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-zinc-400">
              {brandInitials(brandName)}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {fileInput}
          <button
            type="button"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
          >
            {pending ? "Yükleniyor…" : coverUrl ? "Fotoğrafı değiştir" : "Fotoğraf seç"}
          </button>
          {coverUrl ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void removeCover()}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-800 disabled:opacity-50"
            >
              Kapağı kaldır
            </button>
          ) : null}
        </div>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </section>
  );
}
