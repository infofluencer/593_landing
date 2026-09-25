"use client";

import { useEffect, useRef, useState } from "react";
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localCover, setLocalCover] = useState(coverUrl ?? null);
  const [objectPreview, setObjectPreview] = useState<string | null>(null);

  useEffect(() => {
    setLocalCover(coverUrl ?? null);
  }, [coverUrl]);

  useEffect(() => {
    return () => {
      if (objectPreview) URL.revokeObjectURL(objectPreview);
    };
  }, [objectPreview]);

  const preview = objectPreview || localCover || fallbackSrc || null;

  async function readJson(res: Response): Promise<{
    error?: string;
    coverUrl?: string | null;
  }> {
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text) as { error?: string; coverUrl?: string | null };
    } catch {
      return { error: res.ok ? undefined : "Yüklenemedi" };
    }
  }

  async function upload(file: File) {
    setError(null);
    setBusy(true);
    const objectUrl = URL.createObjectURL(file);
    setObjectPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return objectUrl;
    });
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch(
        `/api/panel/tenants/${encodeURIComponent(tenantSlug)}/cover`,
        { method: "POST", body },
      );
      const json = await readJson(res);
      if (!res.ok) {
        setError(json.error || "Yüklenemedi");
        return;
      }
      const next = json.coverUrl ?? null;
      setLocalCover(next);
      onChanged?.(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setBusy(false);
      URL.revokeObjectURL(objectUrl);
      setObjectPreview(null);
    }
  }

  async function removeCover() {
    if (!localCover || busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(
        `/api/panel/tenants/${encodeURIComponent(tenantSlug)}/cover`,
        { method: "DELETE" },
      );
      const json = await readJson(res);
      if (!res.ok) {
        setError(json.error || "Silinemedi");
        return;
      }
      setLocalCover(null);
      onChanged?.(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif,image/*"
      className="sr-only"
      disabled={busy}
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
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[10px] font-medium text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900 disabled:opacity-60"
        >
          {busy ? "Yükleniyor…" : localCover ? "Kapağı değiştir" : "Kapak ekle"}
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
                localCover || objectPreview
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
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
          >
            {busy
              ? "Yükleniyor…"
              : localCover
                ? "Fotoğrafı değiştir"
                : "Fotoğraf seç"}
          </button>
          {localCover ? (
            <button
              type="button"
              disabled={busy}
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
