"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  ExternalLink,
  FileText,
  Link2,
  MessageSquare,
  Pin,
  PinOff,
  Trash2,
  Users,
} from "lucide-react";
import type { BrandNoteKind } from "@prisma/client";
import { btnPrimary, btnSecondary, fieldClass } from "@/components/panel/ds/buttons";
import { formatDateTime } from "@/lib/panel/format";
import type { SerializedNote } from "@/lib/panel/brand-notes";

const KIND_LABEL: Record<BrandNoteKind, string> = {
  general: "Not",
  request: "İstek",
  meeting: "Toplantı notu",
  document: "Doküman",
  link: "Bağlantı",
};

const KIND_ICON: Record<BrandNoteKind, typeof FileText> = {
  general: FileText,
  request: MessageSquare,
  meeting: Users,
  document: FileText,
  link: Link2,
};

type TeamOpt = { id: string; name: string; color: string };

/**
 * Marka notları: toplantıda gelen istekler, genel notlar, doküman / URL.
 * Her not tarihli + yazarlı; istek "Göreve çevir" ile Durum panosuna düşer.
 */
export default function BrandNotes({
  tenantSlug,
  initialNotes,
  teams,
  canEdit,
}: {
  tenantSlug: string;
  initialNotes: SerializedNote[];
  teams: TeamOpt[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [kind, setKind] = useState<BrandNoteKind>("request");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [teamId, setTeamId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/panel/tenants/${encodeURIComponent(tenantSlug)}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          title,
          body,
          url: url || null,
          teamId: teamId || null,
        }),
      });
      const j = (await res.json().catch(() => null)) as
        | { note?: SerializedNote; error?: string }
        | null;
      if (!res.ok || !j?.note) {
        setError(j?.error || "Not eklenemedi");
        return;
      }
      setNotes((prev) => [j.note!, ...prev]);
      setTitle("");
      setBody("");
      setUrl("");
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function patch(id: string, payload: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/panel/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = (await res.json().catch(() => null)) as
      | { note?: SerializedNote | null; error?: string }
      | null;
    if (!res.ok || !j?.note) {
      setError(j?.error || "Güncellenemedi");
      return;
    }
    setNotes((prev) => prev.map((n) => (n.id === id ? j.note! : n)));
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Not silinsin mi? (Pano kartı silinmez)")) return;
    const res = await fetch(`/api/panel/notes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Silinemedi");
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== id));
    router.refresh();
  }

  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Notlar, istekler ve dokümanlar</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Toplantıda gelen istekleri buraya yazın; tüm ekip görür. İstekler
            &quot;Göreve çevir&quot; ile Durum panosuna düşer.
          </p>
        </div>
        {canEdit ? (
          <button type="button" className={btnSecondary} onClick={() => setOpen((v) => !v)}>
            {open ? "Vazgeç" : "Yeni not"}
          </button>
        ) : null}
      </div>

      {open && canEdit ? (
        <div className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 sm:grid-cols-2">
          <label className="text-xs text-zinc-600">
            Tür
            <select
              className={`${fieldClass} mt-1 w-full`}
              value={kind}
              onChange={(e) => setKind(e.target.value as BrandNoteKind)}
            >
              {(Object.keys(KIND_LABEL) as BrandNoteKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-zinc-600">
            İlgili ekip
            <select
              className={`${fieldClass} mt-1 w-full`}
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
            >
              <option value="">—</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-zinc-600 sm:col-span-2">
            Başlık
            <input
              className={`${fieldClass} mt-1 w-full`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Kısa başlık"
            />
          </label>
          <label className="text-xs text-zinc-600 sm:col-span-2">
            Metin
            <textarea
              className="mt-1 min-h-24 w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm text-[#141111] focus:border-[#141111] focus:outline-none"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="İstek / not metni"
            />
          </label>
          <label className="text-xs text-zinc-600 sm:col-span-2">
            Bağlantı (doküman, Drive, URL)
            <input
              className={`${fieldClass} mt-1 w-full`}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </label>
          <div className="flex items-center gap-3 sm:col-span-2">
            <button type="button" className={btnPrimary} disabled={pending} onClick={submit}>
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </button>
            {error ? <p className="text-xs text-rose-600">{error}</p> : null}
          </div>
        </div>
      ) : null}

      {error && !open ? <p className="text-xs text-rose-600">{error}</p> : null}

      {notes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500">
          Henüz not yok.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {notes.map((n) => {
            const Icon = KIND_ICON[n.kind];
            return (
              <li key={n.id} className="flex flex-wrap items-start gap-3 py-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-500">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
                      {KIND_LABEL[n.kind]}
                    </span>
                    {n.teamName ? (
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                        style={{ background: n.teamColor ?? "#71717a" }}
                      >
                        {n.teamName}
                      </span>
                    ) : null}
                    {n.pinned ? (
                      <span className="text-[10px] font-semibold text-amber-700">Sabit</span>
                    ) : null}
                    {n.title ? (
                      <span className="text-sm font-medium text-zinc-900">{n.title}</span>
                    ) : null}
                  </div>
                  {n.body ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">{n.body}</p>
                  ) : null}
                  {n.url ? (
                    <a
                      href={n.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-[#e91825] hover:underline"
                    >
                      <ExternalLink className="size-3" aria-hidden />
                      {n.url.length > 60 ? `${n.url.slice(0, 58)}…` : n.url}
                    </a>
                  ) : null}
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {n.authorLabel} · {formatDateTime(n.createdAt)}
                    {n.boardCard ? (
                      <>
                        {" · "}
                        <a href="/board" className="inline-flex items-center gap-1 text-zinc-700 hover:underline">
                          <ClipboardList className="size-3" aria-hidden />
                          Panoda: {n.boardCard.column}
                        </a>
                      </>
                    ) : null}
                  </p>
                </div>
                {canEdit ? (
                  <div className="flex shrink-0 items-center gap-1">
                    {!n.boardCard ? (
                      <button
                        type="button"
                        onClick={() => patch(n.id, { convertToCard: true })}
                        className="inline-flex min-h-8 items-center gap-1 rounded-full border border-zinc-300 bg-white px-2.5 text-[11px] font-semibold text-[#141111] hover:border-[#141111]"
                        title="Durum panosunda kart aç"
                      >
                        <ClipboardList className="size-3.5" aria-hidden />
                        Göreve çevir
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => patch(n.id, { pinned: !n.pinned })}
                      className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                      title={n.pinned ? "Sabitlemeyi kaldır" : "Sabitle"}
                    >
                      {n.pinned ? <PinOff className="size-4" aria-hidden /> : <Pin className="size-4" aria-hidden />}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(n.id)}
                      className="rounded-full p-1.5 text-zinc-500 hover:bg-rose-50 hover:text-rose-600"
                      title="Sil"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
