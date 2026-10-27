"use client";

import {
  AlertTriangle,
  Clock,
  DatabaseBackup,
  Download,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { btnGhost, btnPrimary } from "@/components/panel/ds/buttons";
import type { RestoreResult, SerializedBackup } from "@/lib/panel/backup";

const SECTION_LABELS: Array<{ key: string; label: string }> = [
  { key: "cards", label: "kart" },
  { key: "notes", label: "not" },
  { key: "meetings", label: "toplantı" },
  { key: "contentPosts", label: "içerik" },
  { key: "suggestions", label: "öneri" },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function countsSummary(counts: Record<string, number>): string {
  return SECTION_LABELS.filter((s) => (counts[s.key] ?? 0) > 0)
    .map((s) => `${counts[s.key]} ${s.label}`)
    .join(" · ");
}

export default function BackupManager({
  initial,
  s3,
}: {
  initial: SerializedBackup[];
  s3: boolean;
}) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function create() {
    setError(null);
    setNotice(null);
    setBusy("create");
    try {
      const res = await fetch("/api/panel/backups", { method: "POST" });
      const j = (await res.json().catch(() => null)) as {
        backup?: SerializedBackup;
        error?: string;
      } | null;
      if (!res.ok || !j?.backup) {
        setError(j?.error || "Yedek alınamadı");
        return;
      }
      setItems((prev) => [j.backup!, ...prev]);
      setNotice(`Yedek alındı: ${countsSummary(j.backup.counts)}`);
    } finally {
      setBusy(null);
    }
  }

  async function restore(b: SerializedBackup) {
    const ok = confirm(
      `${formatDate(b.createdAt)} tarihli yedekteki pano kartları geri yüklensin mi?\n\n` +
        "Yalnızca silinmiş kolon ve kartlar geri gelir; mevcut kartlar değişmez.",
    );
    if (!ok) return;
    setError(null);
    setNotice(null);
    setBusy(`restore:${b.id}`);
    try {
      const res = await fetch(`/api/panel/backups/${b.id}/restore`, {
        method: "POST",
      });
      const j = (await res.json().catch(() => null)) as {
        result?: RestoreResult;
        error?: string;
      } | null;
      if (!res.ok || !j?.result) {
        setError(j?.error || "Geri yüklenemedi");
        return;
      }
      const r = j.result;
      setNotice(
        r.createdCards === 0 && r.createdColumns === 0
          ? "Panoda eksik kart yok, değişiklik yapılmadı."
          : `${r.createdCards} kart${r.createdColumns ? ` ve ${r.createdColumns} kolon` : ""} geri yüklendi (${r.skippedCards} kart zaten vardı).`,
      );
    } finally {
      setBusy(null);
    }
  }

  async function remove(b: SerializedBackup) {
    if (!confirm(`${formatDate(b.createdAt)} tarihli yedek silinsin mi?`)) return;
    setError(null);
    setNotice(null);
    setBusy(`delete:${b.id}`);
    try {
      const res = await fetch(`/api/panel/backups/${b.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(j?.error || "Silinemedi");
        return;
      }
      setItems((prev) => prev.filter((x) => x.id !== b.id));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#e91825]/10 text-[#e91825]">
              <DatabaseBackup className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Yedekler</h2>
              <p className="mt-0.5 max-w-xl text-sm text-zinc-500">
                Durum panosu, marka notları, toplantılar, içerik takvimi ve
                öneriler JSON olarak kaydedilir. Her gece otomatik yedek alınır
                ve son 30 tanesi tutulur; elle alınanlar silinmez.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={create}
            disabled={busy !== null}
            className={btnPrimary}
          >
            <DatabaseBackup className="size-4" aria-hidden />
            {busy === "create" ? "Alınıyor…" : "Şimdi yedek al"}
          </button>
        </div>

        {!s3 && (
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            S3 tanımlı değil: yedekler sunucu diskine yazılıyor ve yeniden
            dağıtımda kaybolabilir.
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {notice}
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        {items.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-zinc-500">
            Henüz yedek yok.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200">
            {items.map((b) => {
              const restoring = busy === `restore:${b.id}`;
              const deleting = busy === `delete:${b.id}`;
              return (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-zinc-900">
                        {formatDate(b.createdAt)}
                      </span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                          b.trigger === "cron"
                            ? "bg-zinc-100 text-zinc-600"
                            : "bg-sky-50 text-sky-800"
                        }`}
                      >
                        {b.trigger === "cron" ? (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3" aria-hidden /> Otomatik
                          </span>
                        ) : (
                          "Elle"
                        )}
                      </span>
                      <span className="font-mono text-[11px] text-zinc-400">
                        {formatSize(b.sizeBytes)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {countsSummary(b.counts) || "Boş"}
                      {b.createdByEmail ? ` · ${b.createdByEmail}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <a
                      href={`/api/panel/backups/${b.id}`}
                      className={btnGhost}
                      title="JSON indir"
                    >
                      <Download className="size-4" aria-hidden />
                      İndir
                    </a>
                    <button
                      type="button"
                      onClick={() => restore(b)}
                      disabled={busy !== null}
                      className={btnGhost}
                      title="Silinmiş pano kartlarını geri getir"
                    >
                      <RotateCcw className="size-4" aria-hidden />
                      {restoring ? "Yükleniyor…" : "Panoyu geri yükle"}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(b)}
                      disabled={busy !== null}
                      className={`${btnGhost} text-rose-600 hover:bg-rose-50 hover:text-rose-700`}
                      title="Yedeği sil"
                    >
                      <Trash2 className="size-4" aria-hidden />
                      {deleting ? "Siliniyor…" : "Sil"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
