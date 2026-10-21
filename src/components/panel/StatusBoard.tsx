"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  defaultDropAnimationSideEffects,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertTriangle,
  Calendar,
  Clock,
  ChevronDown,
  GripVertical,
  ImagePlus,
  LayoutGrid,
  Rows3,
  Trash2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isCardOverdue, overdueDays } from "@/lib/panel/board";
import {
  TeamPlatformIcon,
  avatarTone,
  getColumnStatusMeta,
} from "@/components/panel/TeamPlatformIcon";

type StaffUser = {
  id: string;
  name: string | null;
  email: string;
  role?: string;
  avatarUrl?: string | null;
};

type TeamRef = {
  id: string;
  name: string;
  slug: string;
  color: string;
  members?: Array<{ userId: string }>;
};

type TenantRef = {
  id: string;
  name: string;
  slug: string;
};

type Activity = {
  id: string;
  type: string;
  message: string | null;
  createdAt: string;
  actor: StaffUser | null;
};

type Card = {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  position: number;
  priority: "low" | "normal" | "high" | "urgent";
  teamId: string | null;
  tenantId: string | null;
  dueAt: string | null;
  labels: string[];
  /** Referans görselleri; ilki kart kapağı. */
  images: string[];
  sourceAlertId: string | null;
  assignees: StaffUser[];
  assignee: StaffUser | null;
  createdBy: StaffUser | null;
  team: TeamRef | null;
  tenant: TenantRef | null;
  sourceAlert: {
    id: string;
    type: string;
    severity: string;
    message: string | null;
  } | null;
  activities?: Activity[];
};

type Column = {
  id: string;
  name: string;
  position: number;
  color: string | null;
  cards: Card[];
};

type Board = {
  id: string;
  name: string;
  columns: Column[];
};

const PRIORITY_LABEL: Record<Card["priority"], string> = {
  low: "Düşük",
  normal: "Normal",
  high: "Yüksek",
  urgent: "Acil",
};

const PRIORITY_STYLE: Record<Card["priority"], string> = {
  low: "bg-zinc-200 text-zinc-700",
  normal: "bg-amber-400 text-amber-950",
  high: "bg-orange-500 text-white",
  urgent: "bg-rose-600 text-white",
};

function displayName(u: StaffUser | null | undefined) {
  if (!u) return null;
  return u.name?.trim() || u.email;
}

function initials(u: StaffUser) {
  const n = displayName(u) || "?";
  return n.slice(0, 2).toUpperCase();
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function findColumnId(board: Board, id: string): string | undefined {
  if (board.columns.some((c) => c.id === id)) return id;
  return board.columns.find((c) => c.cards.some((card) => card.id === id))?.id;
}

function normalizeCard(raw: Partial<Card> & { id: string }): Card {
  const assignees = Array.isArray(raw.assignees)
    ? raw.assignees
    : raw.assignee
      ? [raw.assignee]
      : [];
  return {
    id: raw.id,
    columnId: raw.columnId ?? "",
    title: raw.title ?? "",
    description: raw.description ?? null,
    position: raw.position ?? 0,
    priority: raw.priority ?? "normal",
    teamId: raw.teamId ?? null,
    tenantId: raw.tenantId ?? null,
    dueAt: raw.dueAt ?? null,
    labels: raw.labels ?? [],
    images: raw.images ?? [],
    sourceAlertId: raw.sourceAlertId ?? null,
    assignees,
    assignee: assignees[0] ?? null,
    createdBy: raw.createdBy ?? null,
    team: raw.team ?? null,
    tenant: raw.tenant ?? null,
    sourceAlert: raw.sourceAlert ?? null,
    activities: raw.activities ?? [],
  };
}

type BoardFilters = {
  team: string; // "" = tümü
  tenant: string;
  assignee: string;
  priority: string;
  overdue: boolean;
  group: "status" | "team";
};

function parseFilters(sp: URLSearchParams): BoardFilters {
  const group = sp.get("group") === "team" ? "team" : "status";
  const priority = sp.get("priority") ?? "";
  const validPriority = ["low", "normal", "high", "urgent"].includes(priority)
    ? priority
    : "";
  return {
    team: sp.get("team") ?? "",
    tenant: sp.get("tenant") ?? "",
    assignee: sp.get("assignee") ?? "",
    priority: validPriority,
    overdue: sp.get("overdue") === "1",
    group,
  };
}

function cardMatchesFilters(
  card: Card,
  filters: BoardFilters,
  columnName: string,
): boolean {
  if (filters.team) {
    if (filters.team === "none") {
      if (card.teamId) return false;
    } else if (card.teamId !== filters.team) {
      return false;
    }
  }
  if (filters.tenant && card.tenantId !== filters.tenant) return false;
  if (filters.assignee) {
    if (!card.assignees.some((a) => a.id === filters.assignee)) return false;
  }
  if (filters.priority && card.priority !== filters.priority) return false;
  if (filters.overdue) {
    if (!isCardOverdue({ dueAt: card.dueAt, columnName })) return false;
  }
  return true;
}

/** Ajans portalı durum tablosu — dnd-kit + zengin kart yüzü. */
export default function StatusBoard({
  initialBoard,
  staff,
  teams,
  tenants,
  canDeleteCards,
}: {
  initialBoard: Board;
  staff: StaffUser[];
  teams: TeamRef[];
  tenants: TenantRef[];
  canDeleteCards: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(
    () => parseFilters(searchParams),
    [searchParams],
  );

  const setFilters = useCallback(
    (patch: Partial<BoardFilters>) => {
      const next = { ...filters, ...patch };
      const params = new URLSearchParams();
      if (next.team) params.set("team", next.team);
      if (next.tenant) params.set("tenant", next.tenant);
      if (next.assignee) params.set("assignee", next.assignee);
      if (next.priority) params.set("priority", next.priority);
      if (next.overdue) params.set("overdue", "1");
      if (next.group === "team") params.set("group", "team");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [filters, pathname, router],
  );

  const [board, setBoard] = useState(initialBoard);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [composerColumnId, setComposerColumnId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Card | null>(null);
  const [uploadingImages, setUploadingImages] = useState(0);
  const reducedMotion = usePrefersReducedMotion();

  const [draftTitle, setDraftTitle] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [draftAssigneeIds, setDraftAssigneeIds] = useState<string[]>([]);
  const [draftTeamId, setDraftTeamId] = useState("");
  const [draftTenantId, setDraftTenantId] = useState("");
  const [draftPriority, setDraftPriority] =
    useState<Card["priority"]>("normal");
  const [draftDue, setDraftDue] = useState("");
  const [draftLabels, setDraftLabels] = useState("");

  const resetDraft = useCallback(() => {
    setDraftTitle("");
    setDraftDesc("");
    setDraftAssigneeIds([]);
    setDraftTeamId("");
    setDraftTenantId("");
    setDraftPriority("normal");
    setDraftDue("");
    setDraftLabels("");
  }, []);

  useEffect(() => {
    if (!editing) return;
    setDraftTitle(editing.title);
    setDraftDesc(editing.description ?? "");
    setDraftAssigneeIds(editing.assignees.map((a) => a.id));
    setDraftTeamId(editing.teamId ?? "");
    setDraftTenantId(editing.tenantId ?? "");
    setDraftPriority(editing.priority);
    setDraftDue(editing.dueAt ? editing.dueAt.slice(0, 10) : "");
    setDraftLabels((editing.labels ?? []).join(", "));
  }, [editing]);

  const columnIds = useMemo(
    () => board.columns.map((c) => c.id),
    [board.columns],
  );

  // Görsel yükleme `editing`i değiştirmez (taslak sıfırlanmasın); güncel liste board’dan.
  const editingImages = editing
    ? (board.columns
        .flatMap((c) => c.cards)
        .find((c) => c.id === editing.id)?.images ?? editing.images)
    : [];

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: reducedMotion
        ? { distance: 2 }
        : { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const dropAnimation: DropAnimation | null = reducedMotion
    ? null
    : {
        sideEffects: defaultDropAnimationSideEffects({
          styles: { active: { opacity: "0.5" } },
        }),
      };

  async function refreshBoard() {
    const fresh = await fetch("/api/panel/board");
    if (!fresh.ok) return;
    const data = (await fresh.json()) as { board: Board };
    setBoard({
      ...data.board,
      columns: data.board.columns.map((col) => ({
        ...col,
        cards: col.cards.map((c) => normalizeCard(c)),
      })),
    });
  }

  async function persistCardMove(
    cardId: string,
    columnId: string,
    position: number,
  ) {
    setError(null);
    const res = await fetch(`/api/panel/board/cards/${cardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columnId, position }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(j?.error || "Taşıma başarısız");
      await refreshBoard();
    }
  }

  async function persistColumnOrder(order: string[]) {
    setError(null);
    const res = await fetch("/api/panel/board", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columnOrder: order }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(j?.error || "Kolon sırası kaydedilemedi");
      await refreshBoard();
    }
  }

  function onDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    const col = board.columns.find((c) => c.id === id);
    if (col) {
      setActiveColumnId(id);
      setActiveCard(null);
      return;
    }
    for (const c of board.columns) {
      const card = c.cards.find((x) => x.id === id);
      if (card) {
        setActiveCard(card);
        setActiveColumnId(null);
        return;
      }
    }
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    if (board.columns.some((c) => c.id === activeId)) return;

    const fromColId = findColumnId(board, activeId);
    const toColId = findColumnId(board, overId);
    if (!fromColId || !toColId || fromColId === toColId) return;

    setBoard((prev) => {
      const next = prev.columns.map((col) => ({
        ...col,
        cards: [...col.cards],
      }));
      const fromCol = next.find((c) => c.id === fromColId);
      const toCol = next.find((c) => c.id === toColId);
      if (!fromCol || !toCol) return prev;

      const fromIndex = fromCol.cards.findIndex((c) => c.id === activeId);
      if (fromIndex < 0) return prev;
      const [moved] = fromCol.cards.splice(fromIndex, 1);

      const overIsColumn = toCol.id === overId;
      let toIndex = overIsColumn
        ? toCol.cards.length
        : toCol.cards.findIndex((c) => c.id === overId);
      if (toIndex < 0) toIndex = toCol.cards.length;

      toCol.cards.splice(toIndex, 0, { ...moved, columnId: toColId });
      for (const col of next) {
        col.cards = col.cards.map((c, i) => ({ ...c, position: i }));
      }
      return { ...prev, columns: next };
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveCard(null);
    setActiveColumnId(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Kolon sıralama
    if (board.columns.some((c) => c.id === activeId)) {
      if (activeId === overId) return;
      const oldIndex = board.columns.findIndex((c) => c.id === activeId);
      const newIndex = board.columns.findIndex((c) => c.id === overId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const nextCols = arrayMove(board.columns, oldIndex, newIndex).map(
        (c, i) => ({ ...c, position: i }),
      );
      setBoard((prev) => ({ ...prev, columns: nextCols }));
      startTransition(() => {
        void persistColumnOrder(nextCols.map((c) => c.id));
      });
      return;
    }

    // Kart — board state onDragOver ile güncel; son pozisyonu bul ve kaydet
    setBoard((prev) => {
      const colId = findColumnId(prev, activeId);
      if (!colId) return prev;

      // Aynı kolon içinde sıralama (onDragOver dokunmadıysa)
      const fromBefore = findColumnId(board, activeId);
      const overCol = findColumnId(prev, overId);
      if (fromBefore && overCol && fromBefore === overCol) {
        const col = prev.columns.find((c) => c.id === fromBefore);
        if (!col) return prev;
        const oldIndex = col.cards.findIndex((c) => c.id === activeId);
        const newIndex =
          overId === fromBefore
            ? col.cards.length - 1
            : col.cards.findIndex((c) => c.id === overId);
        if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
          const position = col.cards.findIndex((c) => c.id === activeId);
          if (position >= 0) {
            startTransition(() => {
              void persistCardMove(activeId, fromBefore, position);
            });
          }
          return prev;
        }
        const next = prev.columns.map((c) =>
          c.id !== fromBefore
            ? c
            : {
                ...c,
                cards: arrayMove(c.cards, oldIndex, newIndex).map((card, i) => ({
                  ...card,
                  position: i,
                })),
              },
        );
        const position = next
          .find((c) => c.id === fromBefore)!
          .cards.findIndex((c) => c.id === activeId);
        startTransition(() => {
          void persistCardMove(activeId, fromBefore, position);
        });
        return { ...prev, columns: next };
      }

      // Çapraz kolon — onDragOver zaten taşıdı
      const position = prev.columns
        .find((c) => c.id === colId)!
        .cards.findIndex((c) => c.id === activeId);
      if (position >= 0) {
        startTransition(() => {
          void persistCardMove(activeId, colId, position);
        });
      }
      return prev;
    });
  }

  async function createCard(columnId: string) {
    const title = draftTitle.trim();
    if (!title) return;
    setError(null);
    const labels = draftLabels
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);
    const res = await fetch("/api/panel/board/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        columnId,
        title,
        description: draftDesc.trim() || null,
        assigneeIds: draftAssigneeIds,
        teamId: draftTeamId || null,
        tenantId: draftTenantId || null,
        priority: draftPriority,
        dueAt: draftDue || null,
        labels,
      }),
    });
    const j = (await res.json().catch(() => null)) as
      | { card?: Card; error?: string }
      | null;
    if (!res.ok || !j?.card) {
      setError(j?.error || "Kart oluşturulamadı");
      return;
    }
    const card = normalizeCard(j.card);
    setBoard((prev) => ({
      ...prev,
      columns: prev.columns.map((col) =>
        col.id === columnId
          ? { ...col, cards: [...col.cards, card] }
          : col,
      ),
    }));
    resetDraft();
    setComposerColumnId(null);
  }

  async function saveEdit() {
    if (!editing) return;
    setError(null);
    const labels = draftLabels
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);
    const res = await fetch(`/api/panel/board/cards/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draftTitle.trim(),
        description: draftDesc.trim() || null,
        assigneeIds: draftAssigneeIds,
        teamId: draftTeamId || null,
        tenantId: draftTenantId || null,
        priority: draftPriority,
        dueAt: draftDue || null,
        labels,
      }),
    });
    const j = (await res.json().catch(() => null)) as
      | { card?: Card; error?: string }
      | null;
    if (!res.ok || !j?.card) {
      setError(j?.error || "Güncelleme başarısız");
      return;
    }
    const card = normalizeCard(j.card);
    setBoard((prev) => ({
      ...prev,
      columns: prev.columns.map((col) => ({
        ...col,
        cards: col.cards.map((c) => (c.id === card.id ? card : c)),
      })),
    }));
    setEditing(null);
    resetDraft();
  }

  async function deleteCard(cardId: string) {
    if (!confirm("Bu görev silinsin mi?")) return;
    setError(null);
    const res = await fetch(`/api/panel/board/cards/${cardId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(j?.error || "Silinemedi");
      return;
    }
    setBoard((prev) => ({
      ...prev,
      columns: prev.columns.map((col) => ({
        ...col,
        cards: col.cards.filter((c) => c.id !== cardId),
      })),
    }));
    setEditing(null);
  }

  function replaceCard(card: Card) {
    setBoard((prev) => ({
      ...prev,
      columns: prev.columns.map((col) => ({
        ...col,
        cards: col.cards.map((c) => (c.id === card.id ? card : c)),
      })),
    }));
  }

  async function uploadCardImages(cardId: string, files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    setError(null);
    for (const file of images) {
      setUploadingImages((n) => n + 1);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`/api/panel/board/cards/${cardId}/images`, {
          method: "POST",
          body: form,
        });
        const j = (await res.json().catch(() => null)) as {
          card?: Card;
          error?: string;
        } | null;
        if (!res.ok || !j?.card) {
          setError(j?.error || "Görsel yüklenemedi");
          return;
        }
        replaceCard(normalizeCard(j.card));
      } finally {
        setUploadingImages((n) => n - 1);
      }
    }
  }

  async function removeCardImage(cardId: string, url: string) {
    if (!confirm("Bu görsel kaldırılsın mı?")) return;
    setError(null);
    const res = await fetch(
      `/api/panel/board/cards/${cardId}/images?url=${encodeURIComponent(url)}`,
      { method: "DELETE" },
    );
    const j = (await res.json().catch(() => null)) as {
      card?: Card;
      error?: string;
    } | null;
    if (!res.ok || !j?.card) {
      setError(j?.error || "Görsel kaldırılamadı");
      return;
    }
    replaceCard(normalizeCard(j.card));
  }

  function toggleAssignee(userId: string) {
    setDraftAssigneeIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  }

  const columnNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of board.columns) m.set(c.id, c.name);
    return m;
  }, [board.columns]);

  const filteredColumns = useMemo(() => {
    return board.columns.map((col) => ({
      ...col,
      cards: col.cards.filter((card) =>
        cardMatchesFilters(card, filters, col.name),
      ),
    }));
  }, [board.columns, filters]);

  const filteredCount = useMemo(
    () => filteredColumns.reduce((n, c) => n + c.cards.length, 0),
    [filteredColumns],
  );

  const teamStrips = useMemo(() => {
    if (filters.group !== "team") return null;
    const strips: Array<{
      key: string;
      title: string;
      color: string;
      columns: Column[];
    }> = teams.map((t) => ({
      key: t.id,
      title: t.name,
      color: t.color,
      columns: filteredColumns.map((col) => ({
        ...col,
        cards: col.cards.filter((c) => c.teamId === t.id),
      })),
    }));
    const unassigned = filteredColumns.map((col) => ({
      ...col,
      cards: col.cards.filter((c) => !c.teamId),
    }));
    if (unassigned.some((c) => c.cards.length > 0)) {
      strips.push({
        key: "none",
        title: "Takımsız",
        color: "#a8a29e",
        columns: unassigned,
      });
    }
    return strips.filter((s) => s.columns.some((c) => c.cards.length > 0));
  }, [filteredColumns, filters.group, teams]);

  const displayColumns = filteredColumns;

  const hasActiveFilters =
    Boolean(filters.team) ||
    Boolean(filters.tenant) ||
    Boolean(filters.assignee) ||
    Boolean(filters.priority) ||
    filters.overdue;

  return (
    <div className="space-y-4">
      {/* Filtre barı */}
      <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilters({ team: "" })}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              !filters.team
                ? "border-[#e91825] bg-[#e91825] text-white shadow-sm"
                : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400"
            }`}
          >
            Tümü
          </button>
          {teams.map((t) => {
            const on = filters.team === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilters({ team: on ? "" : t.id })}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition ${
                  on
                    ? "border-transparent text-white shadow-sm"
                    : "bg-white text-zinc-800 hover:bg-zinc-50"
                }`}
                style={
                  on
                    ? { backgroundColor: t.color, borderColor: t.color }
                    : { borderColor: t.color, color: t.color }
                }
              >
                <TeamPlatformIcon
                  name={t.name}
                  slug={t.slug}
                  className={`size-3.5 ${on ? "brightness-0 invert" : ""}`}
                />
                {t.name}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
          <FilterSelect
            label="Marka"
            value={filters.tenant}
            onChange={(v) => setFilters({ tenant: v })}
            options={tenants.map((t) => ({ value: t.id, label: t.name }))}
          />
          <FilterSelect
            label="Atanan"
            value={filters.assignee}
            onChange={(v) => setFilters({ assignee: v })}
            options={staff.map((u) => ({ value: u.id, label: displayName(u) ?? u.email }))}
          />
          <FilterSelect
            label="Öncelik"
            value={filters.priority}
            onChange={(v) => setFilters({ priority: v })}
            options={(Object.keys(PRIORITY_LABEL) as Card["priority"][]).map((p) => ({
              value: p,
              label: PRIORITY_LABEL[p],
            }))}
          />
          <button
            type="button"
            aria-pressed={filters.overdue}
            onClick={() => setFilters({ overdue: !filters.overdue })}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition ${
              filters.overdue
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
            }`}
          >
            <Clock className="size-3.5" aria-hidden />
            Gecikenler
          </button>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={() =>
                setFilters({
                  team: "",
                  tenant: "",
                  assignee: "",
                  priority: "",
                  overdue: false,
                })
              }
              className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
            >
              <X className="size-3.5" aria-hidden />
              Temizle
            </button>
          ) : null}

          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs tabular-nums text-zinc-500">
              {pending ? "Kaydediliyor… · " : ""}
              {filteredCount} kart
            </span>
            <div
              className="flex h-8 items-center gap-0.5 rounded-lg bg-zinc-100 p-0.5"
              role="group"
              aria-label="Görünüm"
            >
              {(
                [
                  { key: "status", label: "Durum", Icon: LayoutGrid, title: "Durum kolonları" },
                  { key: "team", label: "Takım", Icon: Rows3, title: "Takıma göre grupla" },
                ] as const
              ).map(({ key, label, Icon, title }) => {
                const on = filters.group === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setFilters({ group: key })}
                    title={title}
                    className={`inline-flex h-full items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition ${
                      on
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    <Icon className="size-3.5" aria-hidden />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {filters.group === "team" ? (
        <div className="space-y-6">
          <p className="text-xs text-zinc-500">
            Takım görünümü — sürükle-bırak için “Durum” moduna geçin.
          </p>
          {(teamStrips?.length ?? 0) === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
              Bu filtrelerle kart yok.
            </p>
          ) : (
            teamStrips!.map((strip) => (
              <section key={strip.key} className="space-y-2">
                <header className="flex items-center gap-2">
                  <span
                    className="flex size-7 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: strip.color }}
                  >
                    <TeamPlatformIcon
                      name={strip.title}
                      className="size-3.5 brightness-0 invert"
                    />
                  </span>
                  <h3 className="text-sm font-semibold text-zinc-800">
                    {strip.title}
                  </h3>
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-white">
                    {strip.columns.reduce((n, c) => n + c.cards.length, 0)}
                  </span>
                </header>
                <div className="-mx-1 flex gap-3 overflow-x-auto pb-2">
                  {strip.columns.map((col) => (
                    <div
                      key={`${strip.key}-${col.id}`}
                      className="flex w-64 shrink-0 flex-col rounded-xl border border-zinc-200 bg-white"
                      style={{ boxShadow: `inset 0 3px 0 ${strip.color}` }}
                    >
                      <div className="flex items-center gap-2 px-3 py-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            backgroundColor: col.color || "#a1a1aa",
                          }}
                        />
                        <span className="text-xs font-semibold text-zinc-700">
                          {col.name}
                        </span>
                        <span className="ml-auto text-[10px] text-zinc-400">
                          {col.cards.length}
                        </span>
                      </div>
                      <ul className="flex min-h-[48px] flex-col gap-2 px-2 pb-2">
                        {col.cards.map((card) => (
                          <li key={card.id}>
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => setEditing(card)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setEditing(card);
                                }
                              }}
                              className="w-full cursor-pointer text-left"
                            >
                              <CardFace
                                card={card}
                                columnName={col.name}
                                onDelete={
                                  canDeleteCards
                                    ? () => void deleteCard(card.id)
                                    : undefined
                                }
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      ) : (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={columnIds}
          strategy={horizontalListSortingStrategy}
        >
          <div className="-mx-1 flex gap-3 overflow-x-auto pb-4 pt-1">
            {displayColumns.map((col) => (
              <BoardColumn
                key={col.id}
                column={col}
                reducedMotion={reducedMotion}
                composerOpen={composerColumnId === col.id}
                onOpenComposer={() => {
                  resetDraft();
                  setComposerColumnId(col.id);
                }}
                onCloseComposer={() => {
                  setComposerColumnId(null);
                  resetDraft();
                }}
                onCreate={() => void createCard(col.id)}
                onEditCard={setEditing}
                onDeleteCard={
                  canDeleteCards ? (id) => void deleteCard(id) : undefined
                }
                draftTitle={draftTitle}
                setDraftTitle={setDraftTitle}
                draftDesc={draftDesc}
                setDraftDesc={setDraftDesc}
                draftAssigneeIds={draftAssigneeIds}
                toggleAssignee={toggleAssignee}
                draftTeamId={draftTeamId}
                setDraftTeamId={setDraftTeamId}
                draftTenantId={draftTenantId}
                setDraftTenantId={setDraftTenantId}
                draftPriority={draftPriority}
                setDraftPriority={setDraftPriority}
                draftDue={draftDue}
                setDraftDue={setDraftDue}
                draftLabels={draftLabels}
                setDraftLabels={setDraftLabels}
                staff={staff}
                teams={teams}
                tenants={tenants}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeCard ? (
            <div
              className={
                reducedMotion
                  ? "w-72 opacity-95 shadow-lg"
                  : "w-72 origin-center rotate-1 scale-[1.02] opacity-95 shadow-xl"
              }
            >
              <CardFace
                card={activeCard}
                columnName={columnNameById.get(activeCard.columnId)}
                dragging
              />
            </div>
          ) : activeColumnId ? (
            <div className="w-72 rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm font-semibold shadow-lg">
              {board.columns.find((c) => c.id === activeColumnId)?.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      )}

      {editing ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => setEditing(null)}
        >
          <div
            role="dialog"
            aria-modal
            aria-labelledby="card-edit-title"
            className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="card-edit-title" className="text-base font-semibold">
              Görevi düzenle
            </h3>
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-[#e91825]"
            />
            <textarea
              value={draftDesc}
              onChange={(e) => setDraftDesc(e.target.value)}
              onPaste={(e) => {
                const files = Array.from(e.clipboardData.files);
                if (files.some((f) => f.type.startsWith("image/"))) {
                  e.preventDefault();
                  void uploadCardImages(editing.id, files);
                }
              }}
              rows={4}
              placeholder="Açıklama (görsel yapıştırabilirsiniz)"
              className="w-full resize-none rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-[#e91825]"
            />
            <CardImagesField
              images={editingImages}
              uploading={uploadingImages > 0}
              onAdd={(files) => void uploadCardImages(editing.id, files)}
              onRemove={(url) => void removeCardImage(editing.id, url)}
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="col-span-2 text-[11px] font-medium text-zinc-500">
                Takım
                <select
                  value={draftTeamId}
                  onChange={(e) => setDraftTeamId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-200 px-2.5 py-2 text-sm text-zinc-900"
                >
                  <option value="">Takım yok</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="col-span-2 text-[11px] font-medium text-zinc-500">
                Marka
                <select
                  value={draftTenantId}
                  onChange={(e) => setDraftTenantId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-200 px-2.5 py-2 text-sm text-zinc-900"
                >
                  <option value="">Marka yok</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <select
                value={draftPriority}
                onChange={(e) =>
                  setDraftPriority(e.target.value as Card["priority"])
                }
                className="rounded-md border border-zinc-200 px-2.5 py-2 text-sm"
              >
                {(Object.keys(PRIORITY_LABEL) as Card["priority"][]).map(
                  (p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </option>
                  ),
                )}
              </select>
              <input
                type="date"
                value={draftDue}
                onChange={(e) => setDraftDue(e.target.value)}
                className="rounded-md border border-zinc-200 px-2.5 py-2 text-sm"
              />
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-medium text-zinc-500">
                Atananlar (çoklu)
              </p>
              <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                {staff.map((u) => {
                  const on = draftAssigneeIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleAssignee(u.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-xs ${
                        on
                          ? "border-[#e91825]/40 bg-[#e91825]/10 text-[#e91825]"
                          : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                      }`}
                    >
                      <StaffAvatar user={u} className="h-6 w-6 text-[9px]" />
                      {displayName(u)}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="block text-[11px] font-medium text-zinc-500">
              Etiketler (virgülle)
              <input
                value={draftLabels}
                onChange={(e) => setDraftLabels(e.target.value)}
                placeholder="acil, sync, creative"
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-[#e91825]"
              />
            </label>

            {(editing.activities?.length ?? 0) > 0 ? (
              <div>
                <p className="mb-1.5 text-[11px] font-medium text-zinc-500">
                  Aktivite
                </p>
                <ul className="max-h-36 space-y-1.5 overflow-y-auto rounded-md border border-zinc-100 bg-zinc-50 p-2 text-xs text-zinc-600">
                  {editing.activities!.map((a) => (
                    <li key={a.id} className="leading-snug">
                      <span className="font-medium text-zinc-800">
                        {displayName(a.actor) || "Sistem"}
                      </span>
                      {" · "}
                      {a.message || a.type}
                      <span className="text-zinc-400">
                        {" "}
                        ·{" "}
                        {new Date(a.createdAt).toLocaleString("tr-TR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => void saveEdit()}
                className="rounded-md bg-[#e91825] px-3 py-2 text-sm font-medium text-white hover:bg-[#c91420]"
              >
                Kaydet
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
              >
                Kapat
              </button>
              {canDeleteCards ? (
                <button
                  type="button"
                  onClick={() => void deleteCard(editing.id)}
                  className="ml-auto rounded-md px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                >
                  Sil
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BoardColumn({
  column,
  reducedMotion,
  composerOpen,
  onOpenComposer,
  onCloseComposer,
  onCreate,
  onEditCard,
  onDeleteCard,
  draftTitle,
  setDraftTitle,
  draftDesc,
  setDraftDesc,
  draftAssigneeIds,
  toggleAssignee,
  draftTeamId,
  setDraftTeamId,
  draftTenantId,
  setDraftTenantId,
  draftPriority,
  setDraftPriority,
  draftDue,
  setDraftDue,
  draftLabels,
  setDraftLabels,
  staff,
  teams,
  tenants,
}: {
  column: Column;
  reducedMotion: boolean;
  composerOpen: boolean;
  onOpenComposer: () => void;
  onCloseComposer: () => void;
  onCreate: () => void;
  onEditCard: (card: Card) => void;
  onDeleteCard?: (cardId: string) => void;
  draftTitle: string;
  setDraftTitle: (v: string) => void;
  draftDesc: string;
  setDraftDesc: (v: string) => void;
  draftAssigneeIds: string[];
  toggleAssignee: (id: string) => void;
  draftTeamId: string;
  setDraftTeamId: (v: string) => void;
  draftTenantId: string;
  setDraftTenantId: (v: string) => void;
  draftPriority: Card["priority"];
  setDraftPriority: (v: Card["priority"]) => void;
  draftDue: string;
  setDraftDue: (v: string) => void;
  draftLabels: string;
  setDraftLabels: (v: string) => void;
  staff: StaffUser[];
  teams: TeamRef[];
  tenants: TenantRef[];
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id, data: { type: "column" } });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column" },
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: reducedMotion ? undefined : transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const cardIds = column.cards.map((c) => c.id);

  return (
    <section
      ref={(node) => {
        setSortableRef(node);
        setDropRef(node);
      }}
      style={style}
      className="flex max-h-[calc(100dvh-19rem)] min-h-[24rem] w-72 shrink-0 flex-col gap-2"
    >
      <header className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-2 py-2.5 shadow-sm">
        <button
          type="button"
          className="cursor-grab touch-none rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 active:cursor-grabbing"
          aria-label={`${column.name} kolonunu taşı`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
        {(() => {
          const meta = getColumnStatusMeta(column.name);
          const Icon = meta.Icon;
          return (
            <span
              className={`flex size-6 items-center justify-center rounded-full ${meta.bg} ${meta.tone}`}
            >
              <Icon
                className={`size-3.5 ${column.name.toLocaleLowerCase("tr").includes("devam") && !reducedMotion ? "animate-spin" : ""}`}
                aria-hidden
                strokeWidth={2.25}
              />
            </span>
          );
        })()}
        <h3 className="text-sm font-semibold text-zinc-800">{column.name}</h3>
        <span className="ml-auto rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white">
          {column.cards.length}
        </span>
      </header>

      {/* Kartların durduğu alan — ayrı çerçeve; üzerine sürüklenince vurgulanır. */}
      <div
        className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-white transition ${
          isOver
            ? "border-[#e91825]/60 bg-rose-50/40 ring-2 ring-[#e91825]/20"
            : "border-zinc-200"
        }`}
      >
      <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
        <ul className="flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-2">
          {column.cards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              columnName={column.name}
              reducedMotion={reducedMotion}
              onEdit={() => onEditCard(card)}
              onDelete={onDeleteCard ? () => onDeleteCard(card.id) : undefined}
            />
          ))}
        </ul>
      </SortableContext>

      {composerOpen ? (
        <div className="space-y-2 border-t border-zinc-200 bg-white p-3">
          <input
            autoFocus
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="Görev başlığı"
            className="w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-sm outline-none focus:border-[#e91825]"
          />
          <textarea
            value={draftDesc}
            onChange={(e) => setDraftDesc(e.target.value)}
            placeholder="Açıklama (isteğe bağlı)"
            rows={2}
            className="w-full resize-none rounded-md border border-zinc-200 px-2.5 py-1.5 text-sm outline-none focus:border-[#e91825]"
          />
          <select
            value={draftTeamId}
            onChange={(e) => setDraftTeamId(e.target.value)}
            className="w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-sm"
          >
            <option value="">Takım yok</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            value={draftTenantId}
            onChange={(e) => setDraftTenantId(e.target.value)}
            className="w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-sm"
          >
            <option value="">Marka yok</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <div className="flex max-h-20 flex-wrap gap-1 overflow-y-auto">
            {staff.map((u) => {
              const on = draftAssigneeIds.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleAssignee(u.id)}
                  className={`inline-flex items-center gap-1 rounded-full border py-0.5 pl-0.5 pr-2 text-[11px] ${
                    on
                      ? "border-[#e91825]/40 bg-[#e91825]/10 text-[#e91825]"
                      : "border-zinc-200 text-zinc-600"
                  }`}
                >
                  <StaffAvatar user={u} className="h-5 w-5 text-[8px]" />
                  {displayName(u)}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <select
              value={draftPriority}
              onChange={(e) =>
                setDraftPriority(e.target.value as Card["priority"])
              }
              className="flex-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-sm"
            >
              {(Object.keys(PRIORITY_LABEL) as Card["priority"][]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={draftDue}
              onChange={(e) => setDraftDue(e.target.value)}
              className="flex-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-sm"
            />
          </div>
          <input
            value={draftLabels}
            onChange={(e) => setDraftLabels(e.target.value)}
            placeholder="Etiketler (virgülle)"
            className="w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCreate}
              className="rounded-md bg-[#e91825] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#c91420]"
            >
              Ekle
            </button>
            <button
              type="button"
              onClick={onCloseComposer}
              className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
            >
              İptal
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onOpenComposer}
          className="mx-2 mb-2 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-left text-sm text-zinc-500 hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-700"
        >
          + Görev ekle
        </button>
      )}
      </div>
    </section>
  );
}

function SortableCard({
  card,
  columnName,
  reducedMotion,
  onEdit,
  onDelete,
}: {
  card: Card;
  columnName: string;
  reducedMotion: boolean;
  onEdit: () => void;
  onDelete?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, data: { type: "card", card } });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: reducedMotion ? undefined : transition,
    opacity: isDragging ? 0.25 : 1,
  };

  return (
    <li ref={setNodeRef} style={style}>
      <div
        {...attributes}
        {...listeners}
        onClick={onEdit}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onEdit();
          }
        }}
        className="cursor-grab touch-none rounded-2xl text-left outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-[#e91825]/40 focus-visible:ring-offset-1"
        aria-label={`${card.title} — sürükle veya düzenle`}
      >
        <CardFace
          card={card}
          columnName={columnName}
          dragging={isDragging}
          onDelete={onDelete}
        />
      </div>
    </li>
  );
}

/** Filtre çubuğu seçimi — boşken etiket, seçiliyken değer koyu görünür. */
function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  const active = value !== "";
  return (
    <label className="relative inline-flex">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-8 max-w-[11rem] cursor-pointer appearance-none truncate rounded-lg border pl-3 pr-7 text-xs font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-zinc-300 ${
          active
            ? "border-zinc-800 bg-zinc-800 text-white"
            : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
        }`}
      >
        <option value="">{label}: tümü</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className={`pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 ${
          active ? "text-white/70" : "text-zinc-400"
        }`}
        aria-hidden
      />
    </label>
  );
}

/** Profil fotoğrafı varsa onu, yoksa baş harfleri gösterir. */
function StaffAvatar({
  user,
  className = "",
  style,
}: {
  user: StaffUser;
  className?: string;
  style?: CSSProperties;
}) {
  const label = displayName(user) || undefined;
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt={label ?? ""}
        title={label}
        draggable={false}
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={style}
      />
    );
  }
  return (
    <span
      title={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ${avatarTone(user.id)} ${className}`}
      style={style}
    >
      {initials(user)}
    </span>
  );
}

/** Hex zemin üstünde okunur yazı için açık mı? (WCAG göreli parlaklık) */
function isLightColor(hex: string): boolean {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return true;
  const h =
    m[1].length === 3
      ? m[1]
          .split("")
          .map((c) => c + c)
          .join("")
      : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4;
}

function CardFace({
  card,
  columnName,
  dragging,
  onDelete,
}: {
  card: Card;
  columnName?: string;
  dragging?: boolean;
  onDelete?: () => void;
}) {
  // Ekip rengi kartın zemini olur; ekipsiz kart beyaz kalır.
  const bg = card.team?.color ?? "#ffffff";
  const light = isLightColor(bg);
  const fg = light ? "text-zinc-900" : "text-white";
  const muted = light ? "text-zinc-900/60" : "text-white/70";
  const chip = light ? "bg-black/[0.07]" : "bg-white/20";
  const overdue =
    card.dueAt &&
    isCardOverdue({ dueAt: card.dueAt, columnName: columnName ?? null });
  const days = overdue && card.dueAt ? overdueDays(card.dueAt) : 0;
  const subtitle = [card.tenant?.name, card.team?.name]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      className={[
        "group relative overflow-hidden rounded-2xl p-3.5 transition",
        fg,
        card.team ? "" : "border border-zinc-200",
        dragging
          ? "rotate-2 shadow-2xl"
          : "shadow-sm hover:-translate-y-0.5 hover:shadow-md",
        "motion-reduce:rotate-0 motion-reduce:hover:translate-y-0",
      ].join(" ")}
      style={{ backgroundColor: bg }}
    >
      {card.images.length > 0 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.images[0]}
          alt=""
          loading="lazy"
          draggable={false}
          className="-mx-3.5 -mt-3.5 mb-3 block max-h-40 w-[calc(100%+1.75rem)] max-w-none object-cover"
        />
      ) : null}

      <div className="flex min-h-7 items-center gap-2">
        {card.dueAt ? (
          overdue ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">
              <Clock className="size-3" aria-hidden />
              {days} gün gecikti
            </span>
          ) : (
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${muted}`}>
              <Calendar className="size-3" aria-hidden />
              Son{" "}
              {new Date(card.dueAt).toLocaleDateString("tr-TR", {
                day: "numeric",
                month: "short",
              })}
            </span>
          )
        ) : card.team ? (
          <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${muted}`}>
            <TeamPlatformIcon
              name={card.team.name}
              slug={card.team.slug}
              className={`size-3 ${light ? "" : "brightness-0 invert"}`}
            />
            {card.team.name}
          </span>
        ) : null}
        {card.sourceAlertId || card.sourceAlert ? (
          <AlertTriangle
            className={`size-3.5 shrink-0 ${light ? "text-amber-700" : "text-amber-300"}`}
            aria-label="Uyarıdan türedi"
          />
        ) : null}
        {onDelete ? (
          <button
            type="button"
            title="Kartı sil"
            aria-label={`${card.title} kartını sil`}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className={[
              "ml-auto inline-flex size-7 shrink-0 items-center justify-center rounded-full border opacity-0 transition focus-visible:opacity-100 group-hover:opacity-100",
              light
                ? "border-black/15 hover:border-rose-600 hover:bg-rose-600 hover:text-white"
                : "border-white/30 hover:border-rose-600 hover:bg-rose-600",
            ].join(" ")}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>

      <p className="mt-1.5 text-[15px] font-semibold leading-snug">
        {card.title}
      </p>
      {subtitle ? (
        <p className={`mt-0.5 truncate text-xs ${muted}`}>{subtitle}</p>
      ) : null}

      <div className="mt-3 flex items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${PRIORITY_STYLE[card.priority]}`}
          >
            {PRIORITY_LABEL[card.priority]}
          </span>
          {(card.labels ?? []).map((label) => (
            <span
              key={label}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${chip}`}
            >
              {label}
            </span>
          ))}
        </div>
        {card.assignees.length > 0 ? (
          <div className="flex shrink-0 -space-x-1.5">
            {card.assignees.slice(0, 4).map((u) => (
              <StaffAvatar
                key={u.id}
                user={u}
                className="h-7 w-7 text-[10px]"
                style={{ boxShadow: `0 0 0 2px ${bg}` }}
              />
            ))}
            {card.assignees.length > 4 ? (
              <span
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-300 text-[10px] font-bold text-zinc-700"
                style={{ boxShadow: `0 0 0 2px ${bg}` }}
              >
                +{card.assignees.length - 4}
              </span>
            ) : null}
          </div>
        ) : (
          <span className={`shrink-0 text-[11px] ${muted}`}>Atanmadı</span>
        )}
      </div>
    </article>
  );
}

function CardImagesField({
  images,
  uploading,
  onAdd,
  onRemove,
}: {
  images: string[];
  uploading: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onAdd(Array.from(e.dataTransfer.files));
      }}
      className={[
        "rounded-md border border-dashed p-2",
        dragOver ? "border-[#e91825] bg-rose-50/50" : "border-zinc-200",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium text-zinc-500">
          Referans görselleri
        </span>
        <span className="text-[10px] text-zinc-400">
          İlk görsel kart kapağı olur
        </span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          <ImagePlus className="size-3.5" aria-hidden />
          {uploading ? "Yükleniyor…" : "Görsel ekle"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          hidden
          onChange={(e) => {
            onAdd(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>
      {images.length > 0 ? (
        <ul className="mt-2 grid grid-cols-3 gap-2">
          {images.map((url, i) => (
            <li key={url} className="group relative">
              <a href={url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Referans görseli ${i + 1}`}
                  className="aspect-video w-full rounded border border-zinc-200 object-cover"
                />
              </a>
              {i === 0 ? (
                <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[9px] font-semibold text-white">
                  Kapak
                </span>
              ) : null}
              <button
                type="button"
                title="Görseli kaldır"
                aria-label="Görseli kaldır"
                onClick={() => onRemove(url)}
                className="absolute right-1 top-1 rounded bg-black/60 p-0.5 text-white opacity-0 transition hover:bg-rose-600 focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Trash2 className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-[11px] text-zinc-400">
          Sürükleyip bırakın, açıklamaya yapıştırın veya “Görsel ekle”ye tıklayın.
        </p>
      )}
    </div>
  );
}
