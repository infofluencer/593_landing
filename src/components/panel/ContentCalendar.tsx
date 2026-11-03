"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  PanelLeft,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { ContentPostStatus } from "@prisma/client";
import { btnPrimary, btnSecondary, fieldClass } from "@/components/panel/ds/buttons";
import {
  CONTENT_PLATFORMS,
  CONTENT_STATUSES,
  PLATFORM_LABEL,
  STATUS_LABEL,
  type ContentPlatform,
  type SerializedPost,
} from "@/lib/panel/content-posts";

/* ───────────────────────── sabitler ───────────────────────── */

const WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const WEEKDAYS_LONG = [
  "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar",
];
const TR_MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const TR_MONTHS_SHORT = [
  "Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
];

/** Marka renkleri — Google Takvim paletine yakın; 24 ayrı ton, sıra markaya göre sabit. */
const BRAND_PALETTE = [
  "#039be5", "#0b8043", "#8e24aa", "#f4511e", "#3f51b5", "#e67c73",
  "#33b679", "#f6bf26", "#7986cb", "#d50000", "#616161", "#009688",
  "#ad1457", "#ef6c00", "#4285f4", "#7cb342", "#5e35b1", "#c0ca33",
  "#00acc1", "#8d6e63", "#f09300", "#1e88e5", "#43a047", "#d81b60",
];

const PLATFORM_DOT: Record<ContentPlatform, string> = {
  instagram: "#E1306C",
  facebook: "#0866FF",
  tiktok: "#111111",
  linkedin: "#0A66C2",
  x: "#111111",
  youtube: "#FF0000",
};

const STATUS_GLYPH: Record<ContentPostStatus, string> = {
  draft: "○",
  design: "◐",
  review: "◑",
  published: "●",
};

type View = "month" | "week" | "day";
const VIEW_LABEL: Record<View, string> = { month: "Ay", week: "Hafta", day: "Gün" };

const HOUR_PX = 56;
const EVENT_MIN = 60; // dakika — içeriğin zaman ızgarasında kapladığı süre
const SCROLL_TO_HOUR = 8;

type TenantOpt = { id: string; name: string; slug: string; visible?: boolean };
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

/* ───────────────────────── tarih yardımcıları ───────────────────────── */

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function dayKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fromKey(k: string): Date {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function addMonths(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth() + n, 1);
  // Ay sonu taşmasını önlemek için gün sınırlanır.
  const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(d.getDate(), last));
  return x;
}
/** Pazartesi başlangıçlı hafta. */
function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
function monthGrid(y: number, m: number): Date[] {
  const first = new Date(y, m, 1);
  const start = startOfWeek(first);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) cells.push(addDays(start, i));
  const last = cells.slice(35);
  return last.every((d) => d.getMonth() !== m) ? cells.slice(0, 35) : cells;
}

/* ───────────────────────── taslak yardımcıları ───────────────────────── */

function emptyDraft(tenantId: string, date: Date): Draft {
  return {
    id: null,
    tenantId,
    title: "",
    platform: "instagram",
    scheduledAt: toLocalInput(date.toISOString()),
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

/** Marka seçenek etiketi — pasif markalar işaretli ama seçilebilir. */
function tenantLabel(t: TenantOpt): string {
  return t.visible === false ? `${t.name} · pasif` : t.name;
}

function hexAlpha(hex: string, alpha: string): string {
  return `${hex}${alpha}`;
}

/* ───────────────────────── istemci saati (hidrasyon güvenli) ───────────────────────── */

const noopSubscribe = () => () => {};
function useTodayKey(): string | null {
  return useSyncExternalStore(
    noopSubscribe,
    () => dayKey(new Date()),
    () => null,
  );
}
function subscribeMinute(cb: () => void) {
  const id = window.setInterval(cb, 60_000);
  return () => window.clearInterval(id);
}
/** Dakika hassasiyetinde "şimdi" — zaman ızgarasındaki kırmızı çizgi. */
function useNowMinutes(): number | null {
  return useSyncExternalStore(
    subscribeMinute,
    () => {
      const d = new Date();
      return d.getHours() * 60 + d.getMinutes();
    },
    () => null,
  );
}

/* ───────────────────────── zaman ızgarası yerleşimi ───────────────────────── */

type Placed = { post: SerializedPost; col: number; cols: number; topMin: number };

/** Çakışan içerikleri yan yana dizer (Google Takvim benzeri sütun paylaşımı). */
function layoutDay(items: SerializedPost[]): Placed[] {
  const sorted = items
    .map((post) => {
      const d = new Date(post.scheduledAt);
      return { post, topMin: d.getHours() * 60 + d.getMinutes() };
    })
    .sort((a, b) => a.topMin - b.topMin);
  const out: Placed[] = [];
  let cluster: typeof sorted = [];
  let clusterEnd = -1;
  const flush = () => {
    if (cluster.length === 0) return;
    const colEnds: number[] = [];
    const placed = cluster.map((it) => {
      let col = colEnds.findIndex((end) => end <= it.topMin);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(0);
      }
      colEnds[col] = it.topMin + EVENT_MIN;
      return { ...it, col };
    });
    for (const p of placed) out.push({ ...p, cols: colEnds.length });
    cluster = [];
    clusterEnd = -1;
  };
  for (const it of sorted) {
    if (cluster.length > 0 && it.topMin >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.topMin + EVENT_MIN);
  }
  flush();
  return out;
}

/* ═══════════════════════════ bileşen ═══════════════════════════ */

/**
 * İçerik takvimi — Google Takvim düzeni: ekranı dolduran ızgara, Ay / Hafta /
 * Gün görünümleri, sol kenarda mini takvim ve marka/platform filtreleri,
 * boş alana tıklayınca yeni içerik, sürükle-bırak ile tarih değiştirme.
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
  const todayKey = useTodayKey();
  const nowMin = useNowMinutes();

  const [view, setView] = useState<View>("month");
  const [anchor, setAnchor] = useState<Date>(() => {
    // Sunucu-istemci aynı başlasın diye ayın 1'i; bugün o aydaysa ilk
    // "bugün" tıklaması / hafta geçişi doğal olarak bugüne iner.
    const [y, m] = initialMonth.split("-").map(Number);
    return new Date(y!, m! - 1, 1);
  });
  const [posts, setPosts] = useState(initialPosts);
  // Seçim kümeleri — boş küme "tümü" demek. Tıkla: yalnızca o; tekrar tıkla:
  // tümüne dön; başka birine tıkla: seçime ekle.
  const [selectedTenants, setSelectedTenants] = useState<Set<string>>(
    () => new Set(initialTenantId ? [initialTenantId] : []),
  );
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(() => new Set());
  const toggleIn = (prev: Set<string>, id: string) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  };
  const [status, setStatus] = useState<string>("");
  const [query, setQuery] = useState("");
  // auto: masaüstünde açık, mobilde kapalı (hidrasyon için ekran ölçmeden).
  const [sidebar, setSidebar] = useState<"auto" | "open" | "closed">("auto");
  const sidebarVisibleDesktop = sidebar !== "closed";
  const toggleSidebar = () =>
    setSidebar((s) =>
      s === "auto" ? (window.innerWidth >= 1024 ? "closed" : "open") : s === "open" ? "closed" : "open",
    );
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const [miniMonth, setMiniMonth] = useState<Date>(() => {
    const [y, m] = initialMonth.split("-").map(Number);
    return new Date(y!, m! - 1, 1);
  });

  const tenantColor = useMemo(() => {
    const m = new Map<string, string>();
    tenants.forEach((t, i) => m.set(t.id, BRAND_PALETTE[i % BRAND_PALETTE.length]!));
    return m;
  }, [tenants]);
  const colorOf = useCallback(
    (tenantId: string) => tenantColor.get(tenantId) ?? "#616161",
    [tenantColor],
  );

  /* ── görünür aralık ── */
  const range = useMemo(() => {
    if (view === "month") {
      const cells = monthGrid(anchor.getFullYear(), anchor.getMonth());
      return { days: cells, from: cells[0]!, to: addDays(cells[cells.length - 1]!, 1) };
    }
    if (view === "week") {
      const start = startOfWeek(anchor);
      const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
      return { days, from: start, to: addDays(start, 7) };
    }
    const start = startOfDay(anchor);
    return { days: [start], from: start, to: addDays(start, 1) };
  }, [view, anchor]);

  /* ── veri yükleme (olay kaynaklı) ── */
  const load = useCallback(async (from: Date, to: Date) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
      const res = await fetch(`/api/panel/content-posts?${q}`);
      const j = (await res.json().catch(() => null)) as { posts?: SerializedPost[] } | null;
      if (res.ok && j?.posts) setPosts(j.posts);
    } finally {
      setLoading(false);
    }
  }, []);

  const navigate = useCallback(
    (nextView: View, nextAnchor: Date) => {
      setView(nextView);
      setAnchor(nextAnchor);
      setMiniMonth(new Date(nextAnchor.getFullYear(), nextAnchor.getMonth(), 1));
      let from: Date;
      let to: Date;
      if (nextView === "month") {
        const cells = monthGrid(nextAnchor.getFullYear(), nextAnchor.getMonth());
        from = cells[0]!;
        to = addDays(cells[cells.length - 1]!, 1);
      } else if (nextView === "week") {
        from = startOfWeek(nextAnchor);
        to = addDays(from, 7);
      } else {
        from = startOfDay(nextAnchor);
        to = addDays(from, 1);
      }
      void load(from, to);
    },
    [load],
  );

  const step = useCallback(
    (dir: -1 | 1) => {
      if (view === "month") navigate("month", addMonths(anchor, dir));
      else if (view === "week") navigate("week", addDays(anchor, 7 * dir));
      else navigate("day", addDays(anchor, dir));
    },
    [view, anchor, navigate],
  );
  const goToday = useCallback(() => navigate(view, new Date()), [view, navigate]);

  /* ── klavye kısayolları: t bugün, ← → gezin, m/w/d görünüm ── */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (draft || dayOpen) return;
      const el = document.activeElement;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      )
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case "t":
        case "T":
          goToday();
          break;
        case "ArrowLeft":
        case "j":
          step(-1);
          break;
        case "ArrowRight":
        case "k":
          step(1);
          break;
        case "m":
          navigate("month", anchor);
          break;
        case "w":
          navigate("week", anchor);
          break;
        case "d":
          navigate("day", anchor);
          break;
        default:
          return;
      }
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draft, dayOpen, goToday, step, navigate, anchor]);

  /* ── filtre ── */
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    return posts.filter(
      (p) =>
        (selectedTenants.size === 0 || selectedTenants.has(p.tenantId)) &&
        (selectedPlatforms.size === 0 || selectedPlatforms.has(p.platform)) &&
        (!status || p.status === status) &&
        (!q ||
          p.title.toLocaleLowerCase("tr").includes(q) ||
          p.tenantName.toLocaleLowerCase("tr").includes(q) ||
          p.caption.toLocaleLowerCase("tr").includes(q)),
    );
  }, [posts, selectedTenants, selectedPlatforms, status, query]);

  const byDay = useMemo(() => {
    const m = new Map<string, SerializedPost[]>();
    for (const p of filtered) {
      const k = dayKey(new Date(p.scheduledAt));
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    for (const list of m.values()) list.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    return m;
  }, [filtered]);

  const defaultTenantId = selectedTenants.size === 1 ? [...selectedTenants][0]! : "";
  const designers = staff.filter((s) => s.teams.includes("grafik-tasarim"));
  const social = staff.filter((s) => s.teams.includes("sosyal-medya"));

  /* ── oluştur / kaydet / sil ── */
  function openNew(date: Date) {
    if (!canEdit) return;
    setError(null);
    setDraft(emptyDraft(defaultTenantId, date));
  }

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

  /** Sürükle-bırak: yeni tarihe/saat dilimine taşır (iyimser güncelleme). */
  async function reschedule(postId: string, next: Date) {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const prevIso = post.scheduledAt;
    const nextIso = next.toISOString();
    if (prevIso === nextIso) return;
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, scheduledAt: nextIso } : p)));
    const res = await fetch(`/api/panel/content-posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt: nextIso }),
    });
    const j = (await res.json().catch(() => null)) as
      | { post?: SerializedPost | null; error?: string }
      | null;
    if (!res.ok || !j?.post) {
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, scheduledAt: prevIso } : p)));
      setError(j?.error || "Taşınamadı");
      return;
    }
    const saved = j.post;
    setPosts((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
  }

  function onDragStartPost(e: DragEvent, post: SerializedPost) {
    if (!canEdit) return;
    e.dataTransfer.setData("text/plain", post.id);
    e.dataTransfer.effectAllowed = "move";
    setDragId(post.id);
  }
  function onDragEndPost() {
    setDragId(null);
    setDropKey(null);
  }

  /* ── başlık ── */
  const title = (() => {
    if (view === "month") return `${TR_MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;
    if (view === "week") {
      const a = range.days[0]!;
      const b = range.days[6]!;
      if (a.getMonth() === b.getMonth())
        return `${a.getDate()} – ${b.getDate()} ${TR_MONTHS[a.getMonth()]} ${a.getFullYear()}`;
      return `${a.getDate()} ${TR_MONTHS_SHORT[a.getMonth()]} – ${b.getDate()} ${TR_MONTHS_SHORT[b.getMonth()]} ${b.getFullYear()}`;
    }
    return `${anchor.getDate()} ${TR_MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}, ${WEEKDAYS_LONG[(anchor.getDay() + 6) % 7]}`;
  })();

  const current = draft?.id ? posts.find((p) => p.id === draft.id) : null;
  const toolbarBtn =
    "inline-flex h-9 items-center justify-center rounded-full border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50";
  const iconBtn =
    "inline-flex size-9 items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900";

  return (
    <div className="flex h-[calc(100dvh-var(--panel-header-h)-1.5rem)] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white sm:h-[calc(100dvh-var(--panel-header-h)-2rem)]">
      {/* ── araç çubuğu ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-3 py-2 sm:px-4">
        <button
          type="button"
          className={iconBtn}
          onClick={toggleSidebar}
          aria-label={sidebarVisibleDesktop ? "Kenar çubuğunu gizle" : "Kenar çubuğunu göster"}
          aria-pressed={sidebarVisibleDesktop}
        >
          <PanelLeft className="size-5" />
        </button>
        <button type="button" className={toolbarBtn} onClick={goToday} title="Bugün (T)">
          Bugün
        </button>
        <div className="flex items-center">
          <button type="button" className={iconBtn} onClick={() => step(-1)} aria-label="Önceki" title="Önceki (←)">
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" className={iconBtn} onClick={() => step(1)} aria-label="Sonraki" title="Sonraki (→)">
            <ChevronRight className="size-5" />
          </button>
        </div>
        <h2 className="min-w-0 truncate text-lg font-semibold tracking-tight text-zinc-900 sm:text-xl">
          {title}
        </h2>
        {loading ? <span className="text-xs text-zinc-400">Yükleniyor…</span> : null}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="relative hidden md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ara"
              className="h-9 w-44 rounded-full border border-zinc-300 bg-white pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none"
            />
          </label>
          <div className="inline-flex h-9 overflow-hidden rounded-full border border-zinc-300 bg-white p-0.5" role="tablist" aria-label="Görünüm">
            {(["month", "week", "day"] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => navigate(v, focusDateFor(v, anchor))}
                className={`rounded-full px-3 text-sm font-medium transition ${
                  view === v ? "bg-[#141111] text-white" : "text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {VIEW_LABEL[v]}
              </button>
            ))}
          </div>
          {canEdit ? (
            <button
              type="button"
              className={`${btnPrimary} !min-h-9 lg:hidden`}
              onClick={() => openNew(defaultNewDate(anchor, view))}
            >
              <Plus className="size-4" aria-hidden />
              Yeni
            </button>
          ) : null}
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* ── kenar çubuğu ── */}
        {sidebar !== "closed" ? (
          <>
            {sidebar === "open" ? (
              <button
                type="button"
                aria-label="Kenar çubuğunu kapat"
                className="absolute inset-0 z-20 bg-black/30 lg:hidden"
                onClick={() => setSidebar("closed")}
              />
            ) : null}
            <aside
              className={`absolute inset-y-0 left-0 z-30 w-72 shrink-0 flex-col gap-5 overflow-y-auto border-r border-zinc-200 bg-white p-4 shadow-xl lg:static lg:z-auto lg:flex lg:w-64 lg:shadow-none ${
                sidebar === "open" ? "flex" : "hidden"
              }`}
            >
              {canEdit ? (
                <button
                  type="button"
                  className="inline-flex h-12 items-center gap-3 self-start rounded-full border border-zinc-200 bg-white pl-3 pr-5 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 hover:shadow"
                  onClick={() => openNew(defaultNewDate(anchor, view))}
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-[#141111] text-white">
                    <Plus className="size-4" aria-hidden />
                  </span>
                  Yeni içerik
                </button>
              ) : null}

              <MiniCalendar
                month={miniMonth}
                anchor={anchor}
                view={view}
                todayKey={todayKey}
                onMonthChange={setMiniMonth}
                onPick={(d) => {
                  navigate(view === "month" ? "month" : view, d);
                  if (window.innerWidth < 1024) setSidebar("closed");
                }}
              />

              <SidebarSection
                title="Markalar"
                actions={
                  selectedTenants.size > 0 ? (
                    <button type="button" className="hover:underline" onClick={() => setSelectedTenants(new Set())}>
                      Tümünü göster
                    </button>
                  ) : (
                    <span>Tıkla → yalnızca o</span>
                  )
                }
              >
                <ul className="space-y-0.5">
                  {tenants.map((t) => {
                    const all = selectedTenants.size === 0;
                    const on = all || selectedTenants.has(t.id);
                    const color = colorOf(t.id);
                    return (
                      <li key={t.id}>
                        <label
                          className={`group/row flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-zinc-100 ${
                            t.visible === false ? "text-zinc-400" : "text-zinc-800"
                          } ${!all && on ? "bg-zinc-100 font-medium" : ""}`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={on}
                            onChange={() => setSelectedTenants((prev) => toggleIn(prev, t.id))}
                          />
                          <span
                            className="flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
                            style={{
                              background: on ? color : "transparent",
                              borderColor: color,
                              opacity: all ? 0.55 : 1,
                            }}
                            aria-hidden
                          >
                            {on ? <Check className="size-3 text-white" strokeWidth={3} /> : null}
                          </span>
                          <span className="truncate">{t.name}</span>
                          {t.visible === false ? (
                            <span className="ml-auto text-[10px] uppercase tracking-wide">pasif</span>
                          ) : null}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </SidebarSection>

              <SidebarSection
                title="Platformlar"
                actions={
                  selectedPlatforms.size > 0 ? (
                    <button type="button" className="hover:underline" onClick={() => setSelectedPlatforms(new Set())}>
                      Tümünü göster
                    </button>
                  ) : null
                }
              >
                <ul className="space-y-0.5">
                  {CONTENT_PLATFORMS.map((p) => {
                    const all = selectedPlatforms.size === 0;
                    const on = all || selectedPlatforms.has(p);
                    return (
                      <li key={p}>
                        <label
                          className={`flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-zinc-800 hover:bg-zinc-100 ${
                            !all && on ? "bg-zinc-100 font-medium" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={on}
                            onChange={() => setSelectedPlatforms((prev) => toggleIn(prev, p))}
                          />
                          <span
                            className="flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
                            style={{
                              background: on ? PLATFORM_DOT[p] : "transparent",
                              borderColor: PLATFORM_DOT[p],
                              opacity: all ? 0.55 : 1,
                            }}
                            aria-hidden
                          >
                            {on ? <Check className="size-3 text-white" strokeWidth={3} /> : null}
                          </span>
                          {PLATFORM_LABEL[p]}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </SidebarSection>

              <SidebarSection title="Durum">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    className={miniChip(status === "")}
                    onClick={() => setStatus("")}
                  >
                    Tümü
                  </button>
                  {CONTENT_STATUSES.map((s) => (
                    <button key={s} type="button" className={miniChip(status === s)} onClick={() => setStatus(s)}>
                      {STATUS_GLYPH[s]} {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
                  Renk = marka · dolu = paylaşıldı · kesik = taslak
                  <br />
                  Marka / platforma tıkla: yalnızca o · tekrar tıkla: tümü
                  <br />
                  Kısayollar: T bugün · ← → gezin · M/W/D görünüm
                </p>
              </SidebarSection>
            </aside>
          </>
        ) : null}

        {/* ── ana görünüm ── */}
        <div className="flex min-w-0 flex-1 flex-col">
          {view === "month" ? (
            <MonthView
              days={range.days}
              month={anchor.getMonth()}
              byDay={byDay}
              todayKey={todayKey}
              canEdit={canEdit}
              colorOf={colorOf}
              dragId={dragId}
              dropKey={dropKey}
              setDropKey={setDropKey}
              onOpenPost={(p) => setDraft(draftFromPost(p))}
              onCreate={(d) => openNew(withHour(d, 12))}
              onOpenDay={(d) => navigate("day", d)}
              onMore={(k) => setDayOpen(k)}
              onDragStart={onDragStartPost}
              onDragEnd={onDragEndPost}
              onDrop={(postId, day) => {
                const post = posts.find((p) => p.id === postId);
                if (!post) return;
                const src = new Date(post.scheduledAt);
                const next = new Date(day);
                next.setHours(src.getHours(), src.getMinutes(), 0, 0);
                void reschedule(postId, next);
              }}
            />
          ) : (
            <TimeGridView
              days={range.days}
              byDay={byDay}
              todayKey={todayKey}
              nowMin={nowMin}
              canEdit={canEdit}
              colorOf={colorOf}
              dragId={dragId}
              onOpenPost={(p) => setDraft(draftFromPost(p))}
              onCreate={(d) => openNew(d)}
              onOpenDay={(d) => navigate("day", d)}
              onDragStart={onDragStartPost}
              onDragEnd={onDragEndPost}
              onDrop={(postId, at) => void reschedule(postId, at)}
            />
          )}
        </div>
      </div>

      {filtered.length === 0 && posts.length > 0 ? (
        <div className="flex items-center gap-3 border-t border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          Bu dönemde seçili marka / platform / durum filtrelerine uyan içerik yok.
          <button
            type="button"
            className="ml-auto font-semibold underline"
            onClick={() => {
              setSelectedTenants(new Set());
              setSelectedPlatforms(new Set());
              setStatus("");
              setQuery("");
            }}
          >
            Filtreleri temizle
          </button>
        </div>
      ) : null}

      {error && !draft ? (
        <div className="flex items-center gap-3 border-t border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-700">
          {error}
          <button type="button" className="ml-auto underline" onClick={() => setError(null)}>
            Kapat
          </button>
        </div>
      ) : null}

      {/* ── gün listesi ("+N daha") ── */}
      {dayOpen && !draft ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          role="presentation"
          onClick={() => setDayOpen(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Günün içerikleri"
            className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const d = fromKey(dayOpen);
              const dayItems = byDay.get(dayOpen) ?? [];
              return (
                <>
                  <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3">
                    <div>
                      <h3 className="text-base font-semibold text-zinc-900">
                        {d.getDate()} {TR_MONTHS[d.getMonth()]} {d.getFullYear()},{" "}
                        {WEEKDAYS_LONG[(d.getDay() + 6) % 7]}
                      </h3>
                      <p className="text-xs text-zinc-500">{dayItems.length} içerik</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {canEdit ? (
                        <button
                          type="button"
                          className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100"
                          aria-label="Bu güne içerik ekle"
                          onClick={() => {
                            setDayOpen(null);
                            openNew(withHour(d, 12));
                          }}
                        >
                          <Plus className="size-5" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100"
                        onClick={() => setDayOpen(null)}
                        aria-label="Kapat"
                      >
                        <X className="size-5" />
                      </button>
                    </div>
                  </div>
                  <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
                    {dayItems.map((p) => (
                      <li key={p.id}>
                        <EventChip
                          post={p}
                          color={colorOf(p.tenantId)}
                          size="lg"
                          onClick={() => {
                            setDayOpen(null);
                            setDraft(draftFromPost(p));
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}

      {/* ── içerik detayı / yeni içerik ── */}
      {draft ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          role="presentation"
          onClick={() => setDraft(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setDraft(null);
            }}
          >
            <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-3">
              <div className="flex items-center gap-3">
                <span
                  className="size-3 rounded-full"
                  style={{ background: draft.tenantId ? colorOf(draft.tenantId) : "#d4d4d8" }}
                  aria-hidden
                />
                <div>
                  <h3 className="text-base font-semibold text-zinc-900">
                    {draft.id ? "İçerik detayı" : "Yeni içerik"}
                  </h3>
                  {draft.id && current?.title ? (
                    <p className="mt-0.5 break-words text-sm leading-snug text-zinc-600">
                      {current.title}
                    </p>
                  ) : null}
                  {current?.boardCard ? (
                    <a href="/board" className="mt-0.5 inline-flex items-center gap-1 text-xs text-[#e91825] hover:underline">
                      <ClipboardList className="size-3.5" aria-hidden />
                      Tasarım görevi panoda · {current.boardCard.column}
                    </a>
                  ) : null}
                </div>
              </div>
              <button type="button" className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100" onClick={() => setDraft(null)} aria-label="Kapat">
                <X className="size-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-zinc-600 sm:col-span-2">
                  Başlık
                  <input
                    className={`${fieldClass} mt-1 w-full`}
                    value={draft.title}
                    disabled={!canEdit}
                    autoFocus={!draft.id}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder="Örn. Hafta sonu kampanya görseli"
                  />
                </label>
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
                        {tenantLabel(t)}
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
                  <BriefField
                    value={draft.brief}
                    disabled={!canEdit}
                    onChange={(brief) => setDraft({ ...draft, brief })}
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
            </div>

            {canEdit ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 px-5 py-3">
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

/* ───────────────────────── küçük yardımcılar ───────────────────────── */

function withHour(d: Date, hour: number, minute = 0): Date {
  const x = new Date(d);
  x.setHours(hour, minute, 0, 0);
  return x;
}

/** "Yeni içerik" düğmesi için makul varsayılan: görünümün odağındaki gün, 12:00. */
function defaultNewDate(anchor: Date, view: View): Date {
  if (view === "month") {
    const now = new Date();
    const d = now.getMonth() === anchor.getMonth() && now.getFullYear() === anchor.getFullYear() ? now : anchor;
    return withHour(d, 12);
  }
  return withHour(anchor, 12);
}

/** Ay görünümünden hafta/güne geçerken anlamlı gün: ay bugünün ayıysa bugün. */
function focusDateFor(view: View, anchor: Date): Date {
  if (view === "month") return anchor;
  const now = new Date();
  if (now.getFullYear() === anchor.getFullYear() && now.getMonth() === anchor.getMonth()) return now;
  return anchor;
}

function miniChip(active: boolean): string {
  return active
    ? "rounded-full border border-[#141111] bg-[#141111] px-2.5 py-1 text-[11px] font-semibold text-white"
    : "rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 hover:border-[#141111]";
}

/**
 * Metne göre boyutlanan brief alanı: görünmez kopya yüksekliği belirler, textarea onu doldurur.
 * Tıklanınca büyür ve pencere kapanana kadar büyük kalır; blur'da küçülseydi altındaki
 * alanlar tıklama sırasında yer değiştirirdi.
 */
function BriefField({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const box = "rounded-xl border px-4 py-3 text-sm leading-relaxed [grid-area:1/1]";
  return (
    <span className="mt-1 grid">
      <span
        aria-hidden
        className={`${box} invisible block overflow-hidden whitespace-pre-wrap break-words border-transparent transition-[min-height,max-height] duration-200 ${
          expanded ? "min-h-80" : "min-h-44"
        } ${expanded || disabled ? "max-h-[60vh]" : "max-h-72"}`}
      >
        {value}{" "}
      </span>
      <textarea
        rows={1}
        className={`${box} h-full min-h-0 w-full resize-none border-zinc-300 bg-white text-[#141111] focus:border-[#141111] focus:outline-none`}
        value={value}
        disabled={disabled}
        onFocus={() => setExpanded(true)}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Tasarımcıya / içerik üreticisine not"
      />
    </span>
  );
}

function SidebarSection({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between px-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
        {actions ? <div className="flex items-center gap-1 text-[11px] text-zinc-500">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

/* ───────────────────────── mini takvim ───────────────────────── */

function MiniCalendar({
  month,
  anchor,
  view,
  todayKey,
  onMonthChange,
  onPick,
}: {
  month: Date;
  anchor: Date;
  view: View;
  todayKey: string | null;
  onMonthChange: (d: Date) => void;
  onPick: (d: Date) => void;
}) {
  const cells = monthGrid(month.getFullYear(), month.getMonth());
  const weekStart = view === "week" ? dayKey(startOfWeek(anchor)) : null;
  const weekEnd = view === "week" ? dayKey(addDays(startOfWeek(anchor), 6)) : null;
  const anchorKey = dayKey(anchor);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-sm font-semibold text-zinc-900">
          {TR_MONTHS[month.getMonth()]} {month.getFullYear()}
        </span>
        <div className="flex">
          <button
            type="button"
            className="rounded-full p-1 text-zinc-500 hover:bg-zinc-100"
            onClick={() => onMonthChange(addMonths(month, -1))}
            aria-label="Önceki ay"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            className="rounded-full p-1 text-zinc-500 hover:bg-zinc-100"
            onClick={() => onMonthChange(addMonths(month, 1))}
            aria-label="Sonraki ay"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-zinc-400">
        {WEEKDAYS.map((d) => (
          <span key={d} className="py-1">
            {d[0]}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d) => {
          const k = dayKey(d);
          const inMonth = d.getMonth() === month.getMonth();
          const isToday = k === todayKey;
          const isAnchor = view === "day" && k === anchorKey;
          const inWeek = weekStart && weekEnd ? k >= weekStart && k <= weekEnd : false;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onPick(d)}
              className={`relative mx-auto my-0.5 flex size-7 items-center justify-center rounded-full text-[11px] transition ${
                isToday
                  ? "bg-[#e91825] font-bold text-white"
                  : isAnchor
                    ? "bg-zinc-900 font-semibold text-white"
                    : inWeek
                      ? "bg-zinc-100 font-medium text-zinc-900"
                      : inMonth
                        ? "text-zinc-800 hover:bg-zinc-100"
                        : "text-zinc-300 hover:bg-zinc-100"
              }`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────── içerik çipi ───────────────────────── */

const EventChip = memo(function EventChip({
  post,
  color,
  size = "sm",
  dragging,
  draggable,
  onClick,
  onDragStart,
  onDragEnd,
  style,
  className = "",
}: {
  post: SerializedPost;
  color: string;
  size?: "sm" | "md" | "lg";
  dragging?: boolean;
  draggable?: boolean;
  onClick: () => void;
  onDragStart?: (e: DragEvent) => void;
  onDragEnd?: () => void;
  style?: CSSProperties;
  className?: string;
}) {
  const published = post.status === "published";
  const draft = post.status === "draft";
  const platform = PLATFORM_LABEL[post.platform as ContentPlatform] ?? post.platform;
  const label = post.title || platform;
  const base: CSSProperties = published
    ? { background: color, color: "#fff", borderColor: color }
    : {
        background: hexAlpha(color, "22"),
        color: "#18181b",
        borderColor: draft ? color : "transparent",
        borderStyle: draft ? "dashed" : "solid",
        boxShadow: `inset 3px 0 0 ${color}`,
      };
  const titleAttr = `${post.tenantName} · ${platform} · ${STATUS_LABEL[post.status]} · ${fmtTime(post.scheduledAt)}${
    post.title ? `\n${post.title}` : ""
  }`;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      title={titleAttr}
      style={{ ...base, ...style }}
      className={[
        "group/chip flex w-full items-start gap-1.5 overflow-hidden rounded-md border text-left transition",
        draggable ? "cursor-grab active:cursor-grabbing" : "",
        dragging ? "opacity-40" : "hover:brightness-95",
        size === "sm" ? "px-1.5 py-[2px] text-[11px] leading-[16px]" : size === "md" ? "px-2 py-1 text-xs leading-4" : "px-3 py-2 text-sm",
        className,
      ].join(" ")}
    >
      <span
        className="mt-[5px] size-2 shrink-0 rounded-full ring-1 ring-white/70"
        style={{ background: PLATFORM_DOT[post.platform as ContentPlatform] ?? "#71717a" }}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className={`block ${size === "lg" ? "whitespace-normal break-words font-semibold leading-snug" : "truncate font-medium"}`}>
          {size === "sm" ? (
            <>
              <span className={published ? "opacity-80" : "text-zinc-500"}>{fmtTime(post.scheduledAt)}</span>{" "}
              {label}
            </>
          ) : (
            label
          )}
        </span>
        {size !== "sm" ? (
          <span className={`block ${size === "lg" ? "mt-0.5 whitespace-normal break-words text-xs" : "truncate text-[10px]"} ${published ? "opacity-85" : "text-zinc-600"}`}>
            {fmtTime(post.scheduledAt)} · {post.tenantName} · {platform}
            {size === "lg" ? ` · ${STATUS_LABEL[post.status]}` : ""}
          </span>
        ) : null}
      </span>
    </button>
  );
});

/* ───────────────────────── ay görünümü ───────────────────────── */

function MonthView({
  days,
  month,
  byDay,
  todayKey,
  canEdit,
  colorOf,
  dragId,
  dropKey,
  setDropKey,
  onOpenPost,
  onCreate,
  onOpenDay,
  onMore,
  onDragStart,
  onDragEnd,
  onDrop,
}: {
  days: Date[];
  month: number;
  byDay: Map<string, SerializedPost[]>;
  todayKey: string | null;
  canEdit: boolean;
  colorOf: (tenantId: string) => string;
  dragId: string | null;
  dropKey: string | null;
  setDropKey: (k: string | null) => void;
  onOpenPost: (p: SerializedPost) => void;
  onCreate: (d: Date) => void;
  onOpenDay: (d: Date) => void;
  onMore: (k: string) => void;
  onDragStart: (e: DragEvent, p: SerializedPost) => void;
  onDragEnd: () => void;
  onDrop: (postId: string, day: Date) => void;
}) {
  const rows = days.length / 7;
  const gridRef = useRef<HTMLDivElement>(null);
  // Hücre yüksekliğine göre kaç içerik sığar — gerisi "+N daha".
  const [cellH, setCellH] = useState(0);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setCellH(entry.contentRect.height / rows);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [rows]);
  const ROW_PX = 22; // çip (20px) + boşluk
  const HEAD_PX = 30;
  const maxPerCell = cellH ? Math.max(1, Math.floor((cellH - HEAD_PX - 6) / ROW_PX)) : 3;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid shrink-0 grid-cols-7 border-b border-zinc-200 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div
        ref={gridRef}
        className="grid min-h-0 flex-1 grid-cols-7"
        style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
      >
        {days.map((d, i) => {
          const k = dayKey(d);
          const inMonth = d.getMonth() === month;
          const items = byDay.get(k) ?? [];
          const isToday = k === todayKey;
          const overflow = items.length > maxPerCell;
          const shown = overflow ? items.slice(0, Math.max(0, maxPerCell - 1)) : items;
          const hidden = items.length - shown.length;
          const isDrop = dropKey === k && dragId;
          return (
            <div
              key={k}
              role={canEdit ? "button" : undefined}
              tabIndex={canEdit ? -1 : undefined}
              onClick={() => canEdit && onCreate(d)}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dropKey !== k) setDropKey(k);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                if (dropKey === k) setDropKey(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || dragId;
                setDropKey(null);
                if (id) onDrop(id, d);
              }}
              className={[
                "flex min-h-0 flex-col overflow-hidden border-b border-r border-zinc-100 px-1 pb-1 transition-colors",
                i % 7 === 6 ? "border-r-0" : "",
                inMonth ? "bg-white" : "bg-zinc-50/70",
                canEdit ? "cursor-cell hover:bg-zinc-50" : "",
                isDrop ? "bg-sky-50 ring-2 ring-inset ring-sky-300" : "",
              ].join(" ")}
            >
              <div className="flex h-[30px] shrink-0 items-center justify-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDay(d);
                  }}
                  title="Gün görünümü"
                  className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs transition ${
                    isToday
                      ? "bg-[#e91825] font-bold text-white"
                      : inMonth
                        ? "font-medium text-zinc-700 hover:bg-zinc-200"
                        : "text-zinc-400 hover:bg-zinc-200"
                  }`}
                >
                  {d.getDate() === 1 ? `${d.getDate()} ${TR_MONTHS_SHORT[d.getMonth()]}` : d.getDate()}
                </button>
              </div>
              <ul className="flex min-h-0 flex-col gap-[2px]">
                {shown.map((p) => (
                  <li key={p.id}>
                    <EventChip
                      post={p}
                      color={colorOf(p.tenantId)}
                      size="sm"
                      draggable={canEdit}
                      dragging={dragId === p.id}
                      onClick={() => onOpenPost(p)}
                      onDragStart={(e) => onDragStart(e, p)}
                      onDragEnd={onDragEnd}
                    />
                  </li>
                ))}
                {hidden > 0 ? (
                  <li>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMore(k);
                      }}
                      className="w-full rounded-md px-1.5 py-[2px] text-left text-[11px] font-semibold leading-4 text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900"
                    >
                      +{hidden} daha
                    </button>
                  </li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────── hafta / gün görünümü (zaman ızgarası) ───────────────────────── */

function TimeGridView({
  days,
  byDay,
  todayKey,
  nowMin,
  canEdit,
  colorOf,
  dragId,
  onOpenPost,
  onCreate,
  onOpenDay,
  onDragStart,
  onDragEnd,
  onDrop,
}: {
  days: Date[];
  byDay: Map<string, SerializedPost[]>;
  todayKey: string | null;
  nowMin: number | null;
  canEdit: boolean;
  colorOf: (tenantId: string) => string;
  dragId: string | null;
  onOpenPost: (p: SerializedPost) => void;
  onCreate: (d: Date) => void;
  onOpenDay: (d: Date) => void;
  onDragStart: (e: DragEvent, p: SerializedPost) => void;
  onDragEnd: () => void;
  onDrop: (postId: string, at: Date) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hoverSlot, setHoverSlot] = useState<{ key: string; min: number } | null>(null);

  // Açılışta iş saatlerine kaydır.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = SCROLL_TO_HOUR * HOUR_PX - 8;
  }, [days.length]);

  function minutesFromEvent(e: ReactMouseEvent | DragEvent, snap: number): number {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = Math.max(0, Math.min(rect.height - 1, e.clientY - rect.top));
    const min = (y / HOUR_PX) * 60;
    return Math.min(24 * 60 - snap, Math.floor(min / snap) * snap);
  }

  const single = days.length === 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* gün başlıkları */}
      <div
        className="grid shrink-0 border-b border-zinc-200"
        style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}
      >
        <div />
        {days.map((d) => {
          const k = dayKey(d);
          const isToday = k === todayKey;
          const count = (byDay.get(k) ?? []).length;
          return (
            <div key={k} className="flex flex-col items-center py-2">
              <span className={`text-[11px] font-semibold uppercase tracking-wide ${isToday ? "text-[#e91825]" : "text-zinc-500"}`}>
                {WEEKDAYS[(d.getDay() + 6) % 7]}
              </span>
              <button
                type="button"
                onClick={() => onOpenDay(d)}
                className={`mt-0.5 flex size-9 items-center justify-center rounded-full text-lg font-semibold transition ${
                  isToday ? "bg-[#e91825] text-white" : "text-zinc-800 hover:bg-zinc-100"
                }`}
                title="Gün görünümü"
              >
                {d.getDate()}
              </button>
              {single ? (
                <span className="text-[11px] text-zinc-500">{count} içerik</span>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* saat ızgarası */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div
          className="relative grid"
          style={{
            gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))`,
            height: 24 * HOUR_PX,
          }}
        >
          {/* saat etiketleri */}
          <div className="relative border-r border-zinc-100">
            {Array.from({ length: 24 }, (_, h) => (
              <span
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-zinc-400"
                style={{ top: h * HOUR_PX }}
              >
                {h === 0 ? "" : `${pad(h)}:00`}
              </span>
            ))}
          </div>

          {days.map((d) => {
            const k = dayKey(d);
            const isToday = k === todayKey;
            const placed = layoutDay(byDay.get(k) ?? []);
            return (
              <div
                key={k}
                className={`relative border-r border-zinc-100 last:border-r-0 ${isToday ? "bg-rose-50/30" : ""} ${
                  canEdit ? "cursor-cell" : ""
                }`}
                onClick={(e) => {
                  if (!canEdit) return;
                  const min = minutesFromEvent(e, 30);
                  onCreate(withHour(d, Math.floor(min / 60), min % 60));
                }}
                onMouseMove={(e) => {
                  if (!canEdit || dragId) return;
                  const min = minutesFromEvent(e, 30);
                  if (hoverSlot?.key !== k || hoverSlot.min !== min) setHoverSlot({ key: k, min });
                }}
                onMouseLeave={() => setHoverSlot((s) => (s?.key === k ? null : s))}
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  const min = minutesFromEvent(e, 15);
                  if (hoverSlot?.key !== k || hoverSlot.min !== min) setHoverSlot({ key: k, min });
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain") || dragId;
                  const min = minutesFromEvent(e, 15);
                  setHoverSlot(null);
                  if (id) onDrop(id, withHour(d, Math.floor(min / 60), min % 60));
                }}
              >
                {/* saat çizgileri */}
                {Array.from({ length: 24 }, (_, h) => (
                  <div
                    key={h}
                    className="absolute inset-x-0 border-t border-zinc-100"
                    style={{ top: h * HOUR_PX }}
                  >
                    <div className="border-t border-dashed border-zinc-100/80" style={{ marginTop: HOUR_PX / 2 }} />
                  </div>
                ))}

                {/* imleç dilimi (oluştur / bırak önizlemesi) */}
                {hoverSlot?.key === k && canEdit ? (
                  <div
                    className={`pointer-events-none absolute inset-x-1 z-10 flex items-center rounded-md px-2 text-[10px] font-semibold ${
                      dragId ? "bg-sky-100/80 text-sky-800 ring-1 ring-sky-300" : "bg-zinc-100/80 text-zinc-500"
                    }`}
                    style={{ top: (hoverSlot.min / 60) * HOUR_PX, height: dragId ? (EVENT_MIN / 60) * HOUR_PX : HOUR_PX / 2 }}
                  >
                    {pad(Math.floor(hoverSlot.min / 60))}:{pad(hoverSlot.min % 60)}
                    {dragId ? "" : " · tıkla, ekle"}
                  </div>
                ) : null}

                {/* içerikler */}
                {placed.map(({ post, col, cols, topMin }) => {
                  const width = 100 / cols;
                  return (
                    <EventChip
                      key={post.id}
                      post={post}
                      color={colorOf(post.tenantId)}
                      size="md"
                      draggable={canEdit}
                      dragging={dragId === post.id}
                      onClick={() => onOpenPost(post)}
                      onDragStart={(e) => onDragStart(e, post)}
                      onDragEnd={onDragEnd}
                      className="absolute z-20 shadow-sm"
                      style={{
                        top: (topMin / 60) * HOUR_PX + 1,
                        height: (EVENT_MIN / 60) * HOUR_PX - 3,
                        left: `calc(${col * width}% + 2px)`,
                        width: `calc(${width}% - 4px)`,
                      }}
                    />
                  );
                })}

                {/* şimdi çizgisi */}
                {isToday && nowMin != null ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-30 flex items-center"
                    style={{ top: (nowMin / 60) * HOUR_PX }}
                  >
                    <span className="-ml-1 size-2.5 rounded-full bg-[#e91825]" />
                    <span className="h-[2px] flex-1 bg-[#e91825]" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
