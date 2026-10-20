"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ClipboardList, Plus, Trash2, X } from "lucide-react";
import type { ContentPostStatus } from "@prisma/client";
import { btnPrimary, btnSecondary, chipClass, fieldClass } from "@/components/panel/ds/buttons";
import {
  CONTENT_PLATFORMS,
  CONTENT_STATUSES,
  PLATFORM_LABEL,
  STATUS_LABEL,
  type ContentPlatform,
  type SerializedPost,
} from "@/lib/panel/content-posts";

const WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const TR_MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

const STATUS_TONE: Record<ContentPostStatus, string> = {
  draft: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  design: "bg-violet-50 text-violet-800 ring-violet-200",
  review: "bg-amber-50 text-amber-800 ring-amber-200",
  published: "bg-emerald-50 text-emerald-800 ring-emerald-200",
};

const PLATFORM_DOT: Record<ContentPlatform, string> = {
  instagram: "#E1306C",
  facebook: "#0866FF",
  tiktok: "#111111",
  linkedin: "#0A66C2",
  x: "#111111",
  youtube: "#FF0000",
};

type TenantOpt = { id: string; name: string; slug: string };
type StaffOpt = { id: string; label: string; teams: string[] };

type Draft = {
  id: string | null;
  tenantId: string;
  title: string;
  platform: ContentPlatform;
  scheduledAt: string; // datetime-local
  status: ContentPostStatus;
  brief: string;
  caption: string;
  mediaUrls: string;
  assigneeId: string;
  designerId: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function dayKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function shiftMonth(month: string, dir: -1 | 1): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y!, m! - 1 + dir, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
function monthGrid(month: string): Date[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y!, m! - 1, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  // Son satır tamamen sonraki aya aitse düş.
  const last = cells.slice(35);
  return last.every((d) => d.getMonth() !== m! - 1) ? cells.slice(0, 35) : cells;
}

function emptyDraft(tenantId: string, date: Date): Draft {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return {
    id: null,
    tenantId,
    title: "",
    platform: "instagram",
    scheduledAt: toLocalInput(d.toISOString()),
    status: "draft",
    brief: "",
    caption: "",
    mediaUrls: "",
    assigneeId: "",
    designerId: "",
  };
}

function draftFromPost(p: SerializedPost): Draft {
  return {
    id: p.id,
    tenantId: p.tenantId,
    title: p.title,
    platform: (CONTENT_PLATFORMS as readonly string[]).includes(p.platform)
      ? (p.platform as ContentPlatform)
      : "instagram",
    scheduledAt: toLocalInput(p.scheduledAt),
    status: p.status,
    brief: p.brief,
    caption: p.caption,
    mediaUrls: p.mediaUrls.join("\n"),
    assigneeId: p.assigneeId ?? "",
    designerId: p.designerId ?? "",
  };
}

/**
 * Aylık içerik takvimi — gün hücresinde marka + platform + durum; karta
 * tıklayınca brief / metin / görsel / sorumlu / durum detayı açılır.
 */
export default function ContentCalendar({
  month: initialMonth,
  initialPosts,
  tenants,
  staff,
  initialTenantId,
  canEdit,
}: {
  month: string;
  initialPosts: SerializedPost[];
  tenants: TenantOpt[];
  staff: StaffOpt[];
  initialTenantId: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [month, setMonth] = useState(initialMonth);
  const [posts, setPosts] = useState(initialPosts);
  const [tenantId, setTenantId] = useState(initialTenantId ?? "");
  const [platform, setPlatform] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (m: string, t: string) => {
      setLoading(true);
      try {
        const [y, mm] = m.split("-").map(Number);
        const from = new Date(Date.UTC(y!, mm! - 1, 1) - 7 * 86_400_000).toISOString();
        const to = new Date(Date.UTC(y!, mm!, 0) + 8 * 86_400_000).toISOString();
        const q = new URLSearchParams({ from, to });
        if (t) q.set("tenantId", t);
        const res = await fetch(`/api/panel/content-posts?${q}`);
        const j = (await res.json().catch(() => null)) as { posts?: SerializedPost[] } | null;
        if (res.ok && j?.posts) setPosts(j.posts);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Yükleme efekt değil olay kaynaklı: ay / marka değişince çağrılır.
  const changeMonth = useCallback(
    (dir: -1 | 1) => {
      const next = shiftMonth(month, dir);
      setMonth(next);
      void load(next, tenantId);
    },
    [month, tenantId, load],
  );
  const changeTenant = useCallback(
    (next: string) => {
      setTenantId(next);
      void load(month, next);
    },
    [month, load],
  );

  const filtered = useMemo(
    () =>
      posts.filter(
        (p) =>
          (!platform || p.platform === platform) && (!status || p.status === status),
      ),
    [posts, platform, status],
  );
  const byDay = useMemo(() => {
    const m = new Map<string, SerializedPost[]>();
    for (const p of filtered) {
      const k = dayKey(new Date(p.scheduledAt));
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    return m;
  }, [filtered]);

  const cells = useMemo(() => monthGrid(month), [month]);
  const [y, m] = month.split("-").map(Number);
  const todayKey = dayKey(new Date());
  const designers = staff.filter((s) => s.teams.includes("grafik-tasarim"));
  const social = staff.filter((s) => s.teams.includes("sosyal-medya"));

  async function save() {
    if (!draft) return;
    if (!draft.tenantId) {
      setError("Marka seçin");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const payload = {
        tenantId: draft.tenantId,
        title: draft.title,
        platform: draft.platform,
        scheduledAt: new Date(draft.scheduledAt).toISOString(),
        status: draft.status,
        brief: draft.brief,
        caption: draft.caption,
        mediaUrls: draft.mediaUrls.split(/\n+/).map((s) => s.trim()).filter(Boolean),
        assigneeId: draft.assigneeId || null,
        designerId: draft.designerId || null,
      };
      const res = await fetch(
        draft.id ? `/api/panel/content-posts/${draft.id}` : "/api/panel/content-posts",
        {
          method: draft.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const j = (await res.json().catch(() => null)) as
        | { post?: SerializedPost | null; error?: string }
        | null;
      if (!res.ok || !j?.post) {
        setError(j?.error || "Kaydedilemedi");
        return;
      }
      const saved = j.post;
      setPosts((prev) =>
        prev.some((p) => p.id === saved.id)
          ? prev.map((p) => (p.id === saved.id ? saved : p))
          : [...prev, saved],
      );
      setDraft(null);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function convert() {
    if (!draft?.id) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/panel/content-posts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ convertToCard: true }),
      });
      const j = (await res.json().catch(() => null)) as
        | { post?: SerializedPost | null; error?: string }
        | null;
      if (!res.ok || !j?.post) {
        setError(j?.error || "Görev oluşturulamadı");
        return;
      }
      const saved = j.post;
      setPosts((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      setDraft(draftFromPost(saved));
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!draft?.id || !confirm("İçerik silinsin mi?")) return;
    const res = await fetch(`/api/panel/content-posts/${draft.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Silinemedi");
      return;
    }
    setPosts((prev) => prev.filter((p) => p.id !== draft.id));
    setDraft(null);
    router.refresh();
  }

  const current = draft?.id ? posts.find((p) => p.id === draft.id) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Sosyal medya yayın takvimi</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Hangi gün, hangi platformda ne paylaşılacak · Grafik Tasarım ve
            Sosyal Medya aynı kartta
          </p>
        </div>
        {canEdit ? (
          <button
            type="button"
            className={btnPrimary}
            onClick={() => setDraft(emptyDraft(tenantId || tenants[0]?.id || "", new Date()))}
          >
            <Plus className="size-4" aria-hidden />
            Yeni içerik
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-full p-2 text-zinc-600 hover:bg-zinc-100"
            onClick={() => changeMonth(-1)}
            aria-label="Önceki ay"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-[9rem] text-center text-sm font-semibold text-zinc-900">
            {TR_MONTHS[m! - 1]} {y}
          </span>
          <button
            type="button"
            className="rounded-full p-2 text-zinc-600 hover:bg-zinc-100"
            onClick={() => changeMonth(1)}
            aria-label="Sonraki ay"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <select className={fieldClass} value={tenantId} onChange={(e) => changeTenant(e.target.value)}>
          <option value="">Tüm markalar</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select className={fieldClass} value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="">Tüm platformlar</option>
          {CONTENT_PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {PLATFORM_LABEL[p]}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={chipClass(status === "")} onClick={() => setStatus("")}>
            Tümü
          </button>
          {CONTENT_STATUSES.map((s) => (
            <button key={s} type="button" className={chipClass(status === s)} onClick={() => setStatus(s)}>
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        {loading ? <span className="text-xs text-zinc-500">Yükleniyor…</span> : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d) => {
            const k = dayKey(d);
            const inMonth = d.getMonth() === m! - 1;
            const items = byDay.get(k) ?? [];
            return (
              <div
                key={k}
                className={`min-h-[112px] border-b border-r border-zinc-100 p-1.5 ${
                  inMonth ? "bg-white" : "bg-zinc-50/60"
                }`}
                onDoubleClick={() => canEdit && setDraft(emptyDraft(tenantId || tenants[0]?.id || "", d))}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[11px] font-semibold ${
                      k === todayKey
                        ? "rounded-full bg-[#e91825] px-1.5 text-white"
                        : inMonth
                          ? "text-zinc-700"
                          : "text-zinc-400"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  {canEdit ? (
                    <button
                      type="button"
                      className="rounded p-0.5 text-zinc-300 hover:bg-zinc-100 hover:text-zinc-700"
                      onClick={() => setDraft(emptyDraft(tenantId || tenants[0]?.id || "", d))}
                      aria-label="Bu güne içerik ekle"
                    >
                      <Plus className="size-3" />
                    </button>
                  ) : null}
                </div>
                <ul className="mt-1 space-y-1">
                  {items.slice(0, 4).map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setDraft(draftFromPost(p))}
                        className={`flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-left text-[11px] ring-1 ${STATUS_TONE[p.status]}`}
                        title={`${p.tenantName} · ${PLATFORM_LABEL[p.platform as ContentPlatform] ?? p.platform} · ${STATUS_LABEL[p.status]}`}
                      >
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: PLATFORM_DOT[p.platform as ContentPlatform] ?? "#71717a" }}
                        />
                        <span className="truncate font-medium">
                          {tenantId ? p.title || PLATFORM_LABEL[p.platform as ContentPlatform] : p.tenantName}
                        </span>
                        <span className="ml-auto shrink-0 tabular-nums opacity-70">{fmtTime(p.scheduledAt)}</span>
                      </button>
                    </li>
                  ))}
                  {items.length > 4 ? (
                    <li className="text-[10px] text-zinc-500">+{items.length - 4} daha</li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-zinc-500">
        {CONTENT_PLATFORMS.map((p) => (
          <span key={p} className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: PLATFORM_DOT[p] }} />
            {PLATFORM_LABEL[p]}
          </span>
        ))}
      </div>

      {draft ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-zinc-900">
                  {draft.id ? "İçerik detayı" : "Yeni içerik"}
                </h3>
                {current?.boardCard ? (
                  <a href="/board" className="mt-1 inline-flex items-center gap-1 text-xs text-[#e91825] hover:underline">
                    <ClipboardList className="size-3.5" aria-hidden />
                    Tasarım görevi panoda · {current.boardCard.column}
                  </a>
                ) : null}
              </div>
              <button type="button" className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100" onClick={() => setDraft(null)} aria-label="Kapat">
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-zinc-600">
                Marka
                <select
                  className={`${fieldClass} mt-1 w-full`}
                  value={draft.tenantId}
                  disabled={!canEdit || Boolean(draft.id)}
                  onChange={(e) => setDraft({ ...draft, tenantId: e.target.value })}
                >
                  <option value="">Seçin</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-zinc-600">
                Platform
                <select
                  className={`${fieldClass} mt-1 w-full`}
                  value={draft.platform}
                  disabled={!canEdit}
                  onChange={(e) => setDraft({ ...draft, platform: e.target.value as ContentPlatform })}
                >
                  {CONTENT_PLATFORMS.map((p) => (
                    <option key={p} value={p}>
                      {PLATFORM_LABEL[p]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-zinc-600 sm:col-span-2">
                Başlık
                <input
                  className={`${fieldClass} mt-1 w-full`}
                  value={draft.title}
                  disabled={!canEdit}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="Örn. Hafta sonu kampanya görseli"
                />
              </label>
              <label className="text-xs text-zinc-600">
                Paylaşım tarihi ve saati
                <input
                  type="datetime-local"
                  className={`${fieldClass} mt-1 w-full`}
                  value={draft.scheduledAt}
                  disabled={!canEdit}
                  onChange={(e) => setDraft({ ...draft, scheduledAt: e.target.value })}
                />
              </label>
              <label className="text-xs text-zinc-600">
                Durum
                <select
                  className={`${fieldClass} mt-1 w-full`}
                  value={draft.status}
                  disabled={!canEdit}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value as ContentPostStatus })}
                >
                  {CONTENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-zinc-600">
                Sorumlu (Sosyal Medya)
                <select
                  className={`${fieldClass} mt-1 w-full`}
                  value={draft.assigneeId}
                  disabled={!canEdit}
                  onChange={(e) => setDraft({ ...draft, assigneeId: e.target.value })}
                >
                  <option value="">—</option>
                  {(social.length ? social : staff).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-zinc-600">
                Tasarımcı (Grafik Tasarım)
                <select
                  className={`${fieldClass} mt-1 w-full`}
                  value={draft.designerId}
                  disabled={!canEdit}
                  onChange={(e) => setDraft({ ...draft, designerId: e.target.value })}
                >
                  <option value="">—</option>
                  {(designers.length ? designers : staff).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-zinc-600 sm:col-span-2">
                Brief
                <textarea
                  className="mt-1 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm text-[#141111] focus:border-[#141111] focus:outline-none"
                  value={draft.brief}
                  disabled={!canEdit}
                  onChange={(e) => setDraft({ ...draft, brief: e.target.value })}
                  placeholder="Tasarımcıya / içerik üreticisine not"
                />
              </label>
              <label className="text-xs text-zinc-600 sm:col-span-2">
                İçerik metni
                <textarea
                  className="mt-1 min-h-24 w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm text-[#141111] focus:border-[#141111] focus:outline-none"
                  value={draft.caption}
                  disabled={!canEdit}
                  onChange={(e) => setDraft({ ...draft, caption: e.target.value })}
                  placeholder="Paylaşım metni / hashtag'ler"
                />
              </label>
              <label className="text-xs text-zinc-600 sm:col-span-2">
                Görsel / video bağlantıları (her satıra bir URL)
                <textarea
                  className="mt-1 min-h-16 w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 font-mono text-xs text-[#141111] focus:border-[#141111] focus:outline-none"
                  value={draft.mediaUrls}
                  disabled={!canEdit}
                  onChange={(e) => setDraft({ ...draft, mediaUrls: e.target.value })}
                  placeholder="https://drive.google.com/…"
                />
              </label>
            </div>

            {current?.mediaUrls.length ? (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {current.mediaUrls.map((u) =>
                  /\.(png|jpe?g|webp|gif)(\?|$)/i.test(u) ? (
                    <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </a>
                  ) : (
                    <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="flex aspect-square items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 px-2 text-center text-[11px] text-zinc-600 hover:underline">
                      {u.replace(/^https?:\/\//, "").slice(0, 40)}
                    </a>
                  ),
                )}
              </div>
            ) : null}

            {error ? <p className="mt-3 text-xs text-rose-600">{error}</p> : null}

            {canEdit ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button type="button" className={btnPrimary} disabled={pending} onClick={save}>
                  {pending ? "Kaydediliyor…" : "Kaydet"}
                </button>
                {draft.id && !current?.boardCard ? (
                  <button type="button" className={btnSecondary} disabled={pending} onClick={convert}>
                    <ClipboardList className="size-4" aria-hidden />
                    Tasarım görevi oluştur
                  </button>
                ) : null}
                {draft.id ? (
                  <button type="button" className="ml-auto inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50" onClick={remove}>
                    <Trash2 className="size-4" aria-hidden />
                    Sil
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
