"use client";

import {
  ArrowUpRight,
  CalendarDays,
  CalendarRange,
  LayoutGrid,
  List,
  Check,
  ClipboardList,
  MapPin,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/panel/ds/EmptyState";
import {
  CalendarLegend,
  CalendarToolbar,
  MonthView,
  WeekView,
} from "@/components/panel/MeetingsCalendar";
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  chipClass,
  fieldClass,
} from "@/components/panel/ds/buttons";
import type {
  MeetingScope,
  SerializedActionItem,
  SerializedMeeting,
} from "@/lib/panel/meetings";

type StaffUser = { id: string; name: string | null; email: string; role: string };
type TeamOpt = {
  id: string;
  name: string;
  slug: string;
  color: string;
  members: Array<{ userId: string }>;
};
type TenantOpt = { id: string; name: string; slug: string; ownerId: string | null };

type MeetingStatus = SerializedMeeting["status"];

const STATUS_LABEL: Record<MeetingStatus, string> = {
  planned: "Planlandı",
  done: "Yapıldı",
  cancelled: "İptal",
};

const STATUS_PILL: Record<MeetingStatus, string> = {
  planned: "bg-blue-50 text-blue-700",
  done: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-zinc-100 text-zinc-500 line-through",
};

const SCOPE_LABEL: Record<MeetingScope, string> = {
  brand: "Marka",
  team: "Ekip",
  agency: "Ajans geneli",
};

type Tab = "upcoming" | "past" | "all";
type ViewMode = "month" | "week" | "list";

function userLabel(u: { name: string | null; email: string }) {
  return u.name?.trim() || u.email;
}

function teamColor(c?: string | null) {
  return c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : "#71717a";
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** ISO → <input type="datetime-local"> değeri (tarayıcı yerel saati). */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function toLocalDateInput(iso: string | null): string {
  return toLocalInput(iso).slice(0, 10);
}

function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", { timeStyle: "short" }).format(
    new Date(iso),
  );
}

function fmtDay(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function defaultStart(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

type Draft = {
  title: string;
  scope: MeetingScope;
  tenantId: string;
  teamId: string;
  startsAt: string; // ISO
  endsAt: string | null; // ISO
  location: string;
  status: MeetingStatus;
  agenda: string;
  notes: string;
  decisions: string;
  attendeeIds: string[];
};

function draftFrom(m: SerializedMeeting | null, seed: Partial<Draft>): Draft {
  if (!m) {
    const scope: MeetingScope = seed.tenantId
      ? "brand"
      : seed.teamId
        ? "team"
        : "agency";
    return {
      title: "",
      scope,
      tenantId: seed.tenantId ?? "",
      teamId: seed.teamId ?? "",
      startsAt: seed.startsAt ?? defaultStart(),
      endsAt: seed.endsAt ?? null,
      location: "",
      status: "planned",
      agenda: "",
      notes: "",
      decisions: "",
      attendeeIds: seed.attendeeIds ?? [],
    };
  }
  return {
    title: m.title,
    scope: m.scope,
    tenantId: m.tenantId ?? "",
    teamId: m.teamId ?? "",
    startsAt: m.startsAt,
    endsAt: m.endsAt,
    location: m.location ?? "",
    status: m.status,
    agenda: m.agenda,
    notes: m.notes,
    decisions: m.decisions,
    attendeeIds: m.attendees.map((a) => a.userId),
  };
}

function ScopeBadge({ m }: { m: SerializedMeeting }) {
  if (m.scope === "brand" && m.tenant) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
        {m.tenant.name}
      </span>
    );
  }
  if (m.scope === "team" && m.team) {
    const c = teamColor(m.team.color);
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold"
        style={{ backgroundColor: `${c}1a`, color: c }}
      >
        <span className="size-1.5 rounded-full" style={{ backgroundColor: c }} />
        {m.team.name}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md bg-[#141111] px-2 py-0.5 text-[11px] font-semibold text-white">
      Ajans geneli
    </span>
  );
}

export default function MeetingsManager({
  initialMeetings,
  staff,
  teams,
  tenants,
  currentUserId,
  canManage,
  canDelete,
  initialTenantId,
  initialTeamId,
  openNew,
}: {
  initialMeetings: SerializedMeeting[];
  staff: StaffUser[];
  teams: TeamOpt[];
  tenants: TenantOpt[];
  currentUserId: string | null;
  canManage: boolean;
  canDelete: boolean;
  initialTenantId?: string | null;
  initialTeamId?: string | null;
  openNew?: boolean;
}) {
  const [meetings, setMeetings] = useState(initialMeetings);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [scopeFilter, setScopeFilter] = useState<"all" | MeetingScope>(
    initialTenantId ? "brand" : initialTeamId ? "team" : "all",
  );
  const [tenantFilter, setTenantFilter] = useState(initialTenantId ?? "");
  const [teamFilter, setTeamFilter] = useState(initialTeamId ?? "");
  const [query, setQuery] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(Boolean(openNew && canManage));
  const [error, setError] = useState<string | null>(null);
  /** Sayfa açılış anı — "yaklaşan / geçmiş" ayrımı için sabit referans. */
  const [now] = useState(() => Date.now());
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(() => new Date(now));
  const [createAt, setCreateAt] = useState<Date | null>(null);

  const selected = useMemo(
    () => meetings.find((m) => m.id === selectedId) ?? null,
    [meetings, selectedId],
  );

  const baseFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return meetings.filter((m) => {
      if (scopeFilter !== "all" && m.scope !== scopeFilter) return false;
      if (tenantFilter && m.tenantId !== tenantFilter) return false;
      if (teamFilter && m.teamId !== teamFilter) return false;
      if (q) {
        const hay = [
          m.title,
          m.tenant?.name,
          m.team?.name,
          m.agenda,
          m.notes,
          m.decisions,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [meetings, scopeFilter, tenantFilter, teamFilter, query]);

  const filtered = useMemo(() => {
    const list = baseFiltered.filter((m) => {
      const t = new Date(m.startsAt).getTime();
      if (tab === "upcoming" && (t < now - 60 * 60 * 1000 || m.status === "cancelled"))
        return false;
      if (tab === "past" && t >= now - 60 * 60 * 1000 && m.status !== "done")
        return false;
      return true;
    });
    list.sort((a, b) => {
      const ta = new Date(a.startsAt).getTime();
      const tb = new Date(b.startsAt).getTime();
      return tab === "upcoming" ? ta - tb : tb - ta;
    });
    return list;
  }, [baseFiltered, tab, now]);

  const grouped = useMemo(() => {
    const map = new Map<string, SerializedMeeting[]>();
    for (const m of filtered) {
      const k = dayKey(m.startsAt);
      const arr = map.get(k);
      if (arr) arr.push(m);
      else map.set(k, [m]);
    }
    return [...map.entries()];
  }, [filtered]);

  function upsert(m: SerializedMeeting) {
    setMeetings((prev) => {
      const i = prev.findIndex((x) => x.id === m.id);
      if (i === -1) return [m, ...prev];
      const next = prev.slice();
      next[i] = m;
      return next;
    });
  }

  function remove(id: string) {
    setMeetings((prev) => prev.filter((m) => m.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function openCreate(at: Date | null) {
    setError(null);
    setSelectedId(null);
    setCreateAt(at);
    setCreating(true);
  }

  const openActionTotal = filtered.reduce(
    (acc, m) => acc + m.actionItems.filter((a) => !a.done).length,
    0,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
            Toplantılar
          </h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            Marka, ekip ve ajans geneli toplantı notları, kararlar ve aksiyonlar.
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => openCreate(null)}
            className={btnPrimary}
          >
            <Plus className="size-4" aria-hidden />
            Yeni toplantı
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {view === "list" ? (
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["upcoming", "Yaklaşan"],
                ["past", "Geçmiş"],
                ["all", "Tümü"],
              ] as Array<[Tab, string]>
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={chipClass(tab === k)}
              >
                {l}
              </button>
            ))}
          </div>
        ) : (
          <CalendarToolbar view={view} cursor={cursor} onCursor={setCursor} />
        )}
        <div
          role="tablist"
          aria-label="Görünüm"
          className="inline-flex rounded-full border border-zinc-300 bg-white p-1"
        >
          {(
            [
              ["month", "Ay", LayoutGrid],
              ["week", "Hafta", CalendarRange],
              ["list", "Liste", List],
            ] as const
          ).map(([k, l, Icon]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={view === k}
              onClick={() => setView(k)}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition ${
                view === k
                  ? "bg-[#141111] text-white"
                  : "text-zinc-600 hover:text-[#141111]"
              }`}
            >
              <Icon className="size-3.5" aria-hidden />
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["all", "Her kapsam"],
            ["brand", "Marka"],
            ["team", "Ekip"],
            ["agency", "Ajans"],
          ] as Array<["all" | MeetingScope, string]>
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setScopeFilter(k);
              if (k !== "brand") setTenantFilter("");
              if (k !== "team") setTeamFilter("");
            }}
            className={chipClass(scopeFilter === k)}
          >
            {l}
          </button>
        ))}
        {scopeFilter === "brand" ? (
          <select
            value={tenantFilter}
            onChange={(e) => setTenantFilter(e.target.value)}
            className={fieldClass}
            aria-label="Marka filtresi"
          >
            <option value="">Tüm markalar</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        ) : null}
        {scopeFilter === "team" ? (
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className={fieldClass}
            aria-label="Ekip filtresi"
          >
            <option value="">Tüm ekipler</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        ) : null}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Başlık, not, karar ara…"
          className={`${fieldClass} ml-auto w-full sm:w-64`}
        />
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {view !== "list" ? (
        <div className="space-y-3">
          {view === "month" ? (
            <MonthView
              meetings={baseFiltered}
              cursor={cursor}
              today={new Date(now)}
              onSelect={(id) => {
                setError(null);
                setCreating(false);
                setSelectedId(id);
              }}
              onCreateAt={canManage ? (d) => openCreate(d) : undefined}
              onOpenDay={(d) => {
                setCursor(d);
                setView("week");
              }}
            />
          ) : (
            <WeekView
              meetings={baseFiltered}
              cursor={cursor}
              now={new Date(now)}
              onSelect={(id) => {
                setError(null);
                setCreating(false);
                setSelectedId(id);
              }}
              onCreateAt={canManage ? (d) => openCreate(d) : undefined}
            />
          )}
          <CalendarLegend teams={teams} />
        </div>
      ) : (
      <>
      <p className="text-xs text-zinc-500">
        {filtered.length} toplantı · {openActionTotal} açık aksiyon
      </p>

      {grouped.length === 0 ? (
        <EmptyState
          title="Toplantı yok"
          description={
            tab === "upcoming"
              ? "Yaklaşan toplantı bulunmuyor. Yeni toplantı ekleyerek başlayın."
              : "Bu filtreyle eşleşen toplantı bulunmuyor."
          }
          action={
            canManage ? (
              <button
                type="button"
                onClick={() => openCreate(null)}
                className={btnSecondary}
              >
                <Plus className="size-4" aria-hidden />
                Yeni toplantı
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, items]) => (
            <section key={day} className="space-y-2">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                <CalendarDays className="size-3.5" aria-hidden />
                {fmtDay(items[0].startsAt)}
              </h3>
              <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
                {items.map((m) => {
                  const open = m.actionItems.filter((a) => !a.done).length;
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setCreating(false);
                          setSelectedId(m.id);
                        }}
                        className="flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-zinc-50"
                      >
                        <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-zinc-900">
                          {fmtTime(m.startsAt)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-medium text-zinc-900">
                              {m.title}
                            </span>
                            <ScopeBadge m={m} />
                            <span
                              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${STATUS_PILL[m.status]}`}
                            >
                              {STATUS_LABEL[m.status]}
                            </span>
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                            <span className="inline-flex items-center gap-1">
                              <Users className="size-3.5" aria-hidden />
                              {m.attendees.length > 0
                                ? m.attendees
                                    .slice(0, 3)
                                    .map((a) => userLabel(a.user).split(" ")[0])
                                    .join(", ") +
                                  (m.attendees.length > 3
                                    ? ` +${m.attendees.length - 3}`
                                    : "")
                                : "Katılımcı yok"}
                            </span>
                            {m.location ? (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="size-3.5" aria-hidden />
                                {m.location}
                              </span>
                            ) : null}
                            {m.actionItems.length > 0 ? (
                              <span className="inline-flex items-center gap-1">
                                <ClipboardList className="size-3.5" aria-hidden />
                                {open > 0
                                  ? `${open} açık aksiyon`
                                  : "Aksiyonlar tamam"}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
      </>
      )}

      {creating || selected ? (
        <MeetingDrawer
          key={creating ? `new-${createAt?.getTime() ?? 0}` : selected?.id}
          meeting={creating ? null : selected}
          seed={{
            startsAt: createAt ? createAt.toISOString() : undefined,
            endsAt: createAt
              ? new Date(createAt.getTime() + 60 * 60 * 1000).toISOString()
              : undefined,
            tenantId: tenantFilter || undefined,
            teamId: teamFilter || undefined,
            attendeeIds: currentUserId ? [currentUserId] : [],
          }}
          staff={staff}
          teams={teams}
          tenants={tenants}
          canManage={canManage}
          canDelete={canDelete}
          onClose={() => {
            setCreating(false);
            setSelectedId(null);
          }}
          onSaved={(m) => {
            upsert(m);
            setCreating(false);
            setSelectedId(m.id);
          }}
          onDeleted={remove}
          onError={setError}
        />
      ) : null}
    </div>
  );
}

/* ———————————————————————————————————————————————————————————————— */

function MeetingDrawer({
  meeting,
  seed,
  staff,
  teams,
  tenants,
  canManage,
  canDelete,
  onClose,
  onSaved,
  onDeleted,
  onError,
}: {
  meeting: SerializedMeeting | null;
  seed: Partial<Draft>;
  staff: StaffUser[];
  teams: TeamOpt[];
  tenants: TenantOpt[];
  canManage: boolean;
  canDelete: boolean;
  onClose: () => void;
  onSaved: (m: SerializedMeeting) => void;
  onDeleted: (id: string) => void;
  onError: (msg: string | null) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(meeting, seed));
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [newItem, setNewItem] = useState("");
  const [busyItem, setBusyItem] = useState<string | null>(null);

  const readOnly = !canManage;
  const isNew = !meeting;

  const dirty = useMemo(() => {
    if (isNew) return true;
    const base = draftFrom(meeting, {});
    return JSON.stringify(base) !== JSON.stringify(draft);
  }, [draft, meeting, isNew]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  function toggleAttendee(id: string) {
    setDraft((d) => ({
      ...d,
      attendeeIds: d.attendeeIds.includes(id)
        ? d.attendeeIds.filter((x) => x !== id)
        : [...d.attendeeIds, id],
    }));
  }

  function addTeamMembers() {
    const team = teams.find((t) => t.id === draft.teamId);
    if (!team) return;
    setDraft((d) => ({
      ...d,
      attendeeIds: [
        ...new Set([...d.attendeeIds, ...team.members.map((m) => m.userId)]),
      ],
    }));
  }

  function addBrandOwner() {
    const t = tenants.find((x) => x.id === draft.tenantId);
    if (!t?.ownerId) return;
    const ownerId = t.ownerId;
    setDraft((d) => ({
      ...d,
      attendeeIds: d.attendeeIds.includes(ownerId)
        ? d.attendeeIds
        : [...d.attendeeIds, ownerId],
    }));
  }

  function payload() {
    return {
      title: draft.title,
      tenantId: draft.scope === "brand" ? draft.tenantId || null : null,
      teamId: draft.scope === "team" ? draft.teamId || null : null,
      startsAt: draft.startsAt,
      endsAt: draft.endsAt,
      location: draft.location || null,
      status: draft.status,
      agenda: draft.agenda,
      notes: draft.notes,
      decisions: draft.decisions,
      attendeeIds: draft.attendeeIds,
    };
  }

  async function save() {
    setLocalError(null);
    if (!draft.title.trim()) {
      setLocalError("Başlık gerekli.");
      return;
    }
    if (draft.scope === "brand" && !draft.tenantId) {
      setLocalError("Marka toplantısı için marka seçin.");
      return;
    }
    if (draft.scope === "team" && !draft.teamId) {
      setLocalError("Ekip toplantısı için ekip seçin.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        isNew ? "/api/panel/meetings" : `/api/panel/meetings/${meeting.id}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload()),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        meeting?: SerializedMeeting;
        error?: string;
      };
      if (!res.ok || !data.meeting) {
        setLocalError(data.error ?? "Kaydedilemedi.");
        return;
      }
      onSaved(data.meeting);
    } finally {
      setSaving(false);
    }
  }

  async function destroy() {
    if (!meeting) return;
    if (!window.confirm(`"${meeting.title}" silinsin mi? Aksiyon maddeleri de silinir.`))
      return;
    setSaving(true);
    try {
      const res = await fetch(`/api/panel/meetings/${meeting.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setLocalError(data.error ?? "Silinemedi.");
        return;
      }
      onDeleted(meeting.id);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function itemRequest(
    path: string,
    method: "POST" | "PATCH" | "DELETE",
    body?: unknown,
  ) {
    if (!meeting) return;
    setLocalError(null);
    const res = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as {
      meeting?: SerializedMeeting | null;
      error?: string;
    };
    if (!res.ok || !data.meeting) {
      setLocalError(data.error ?? "İşlem başarısız.");
      onError(data.error ?? null);
      return;
    }
    onSaved(data.meeting);
  }

  async function addItem() {
    if (!meeting) return;
    const text = newItem.trim();
    if (!text) return;
    setBusyItem("new");
    try {
      await itemRequest(
        `/api/panel/meetings/${meeting.id}/action-items`,
        "POST",
        { text },
      );
      setNewItem("");
    } finally {
      setBusyItem(null);
    }
  }

  async function patchItem(it: SerializedActionItem, body: unknown) {
    if (!meeting) return;
    setBusyItem(it.id);
    try {
      await itemRequest(
        `/api/panel/meetings/${meeting.id}/action-items/${it.id}`,
        "PATCH",
        body,
      );
    } finally {
      setBusyItem(null);
    }
  }

  async function deleteItem(it: SerializedActionItem) {
    if (!meeting) return;
    setBusyItem(it.id);
    try {
      await itemRequest(
        `/api/panel/meetings/${meeting.id}/action-items/${it.id}`,
        "DELETE",
      );
    } finally {
      setBusyItem(null);
    }
  }

  const inputCls =
    "w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#e91825] disabled:bg-zinc-50 disabled:text-zinc-500";
  const labelCls = "block text-[11px] font-medium text-zinc-500";
  const textareaCls = `${inputCls} min-h-24 resize-y`;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      role="presentation"
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-modal
        aria-labelledby="meeting-drawer-title"
        className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
          <div className="min-w-0">
            <h3
              id="meeting-drawer-title"
              className="truncate text-base font-semibold text-zinc-900"
            >
              {isNew ? "Yeni toplantı" : meeting.title}
            </h3>
            {!isNew ? (
              <p className="mt-0.5 text-xs text-zinc-500">
                {fmtDateTime(meeting.startsAt)}
                {meeting.createdBy
                  ? ` · ${userLabel(meeting.createdBy)} oluşturdu`
                  : ""}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
            aria-label="Kapat"
          >
            <X className="size-4" aria-hidden />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {localError ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {localError}
            </p>
          ) : null}

          <div className="space-y-3">
            <label className={labelCls}>
              Başlık
              <input
                value={draft.title}
                onChange={(e) => set("title", e.target.value)}
                disabled={readOnly}
                placeholder="Örn. Haftalık Meta performans toplantısı"
                className={`${inputCls} mt-1`}
                autoFocus={isNew}
              />
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className={labelCls}>
                Kapsam
                <select
                  value={draft.scope}
                  onChange={(e) => {
                    const scope = e.target.value as MeetingScope;
                    setDraft((d) => ({
                      ...d,
                      scope,
                      tenantId: scope === "brand" ? d.tenantId : "",
                      teamId: scope === "team" ? d.teamId : "",
                    }));
                  }}
                  disabled={readOnly}
                  className={`${inputCls} mt-1`}
                >
                  {(Object.keys(SCOPE_LABEL) as MeetingScope[]).map((k) => (
                    <option key={k} value={k}>
                      {SCOPE_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>

              {draft.scope === "brand" ? (
                <label className={labelCls}>
                  Marka
                  <select
                    value={draft.tenantId}
                    onChange={(e) => set("tenantId", e.target.value)}
                    disabled={readOnly}
                    className={`${inputCls} mt-1`}
                  >
                    <option value="">Marka seçin</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : draft.scope === "team" ? (
                <label className={labelCls}>
                  Ekip
                  <select
                    value={draft.teamId}
                    onChange={(e) => set("teamId", e.target.value)}
                    disabled={readOnly}
                    className={`${inputCls} mt-1`}
                  >
                    <option value="">Ekip seçin</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className={labelCls}>
                  Durum
                  <select
                    value={draft.status}
                    onChange={(e) => set("status", e.target.value as MeetingStatus)}
                    disabled={readOnly}
                    className={`${inputCls} mt-1`}
                  >
                    {(Object.keys(STATUS_LABEL) as MeetingStatus[]).map((k) => (
                      <option key={k} value={k}>
                        {STATUS_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className={labelCls}>
                Başlangıç
                <input
                  type="datetime-local"
                  value={toLocalInput(draft.startsAt)}
                  onChange={(e) => {
                    const iso = fromLocalInput(e.target.value);
                    if (iso) set("startsAt", iso);
                  }}
                  disabled={readOnly}
                  className={`${inputCls} mt-1`}
                />
              </label>
              <label className={labelCls}>
                Bitiş
                <input
                  type="datetime-local"
                  value={toLocalInput(draft.endsAt)}
                  onChange={(e) => set("endsAt", fromLocalInput(e.target.value))}
                  disabled={readOnly}
                  className={`${inputCls} mt-1`}
                />
              </label>
              {draft.scope !== "agency" ? (
                <label className={labelCls}>
                  Durum
                  <select
                    value={draft.status}
                    onChange={(e) => set("status", e.target.value as MeetingStatus)}
                    disabled={readOnly}
                    className={`${inputCls} mt-1`}
                  >
                    {(Object.keys(STATUS_LABEL) as MeetingStatus[]).map((k) => (
                      <option key={k} value={k}>
                        {STATUS_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className={labelCls}>
                  Yer / Link
                  <input
                    value={draft.location}
                    onChange={(e) => set("location", e.target.value)}
                    disabled={readOnly}
                    placeholder="Google Meet, ofis…"
                    className={`${inputCls} mt-1`}
                  />
                </label>
              )}
            </div>
            {draft.scope !== "agency" ? (
              <label className={labelCls}>
                Yer / Link
                <input
                  value={draft.location}
                  onChange={(e) => set("location", e.target.value)}
                  disabled={readOnly}
                  placeholder="Google Meet, ofis…"
                  className={`${inputCls} mt-1`}
                />
              </label>
            ) : null}
          </div>

          {/* Katılımcılar */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-medium text-zinc-500">
                Katılımcılar ({draft.attendeeIds.length})
              </p>
              {!readOnly ? (
                <div className="flex gap-2">
                  {draft.scope === "team" && draft.teamId ? (
                    <button
                      type="button"
                      onClick={addTeamMembers}
                      className="text-xs font-medium text-[#e91825] hover:underline"
                    >
                      Ekip üyelerini ekle
                    </button>
                  ) : null}
                  {draft.scope === "brand" &&
                  tenants.find((t) => t.id === draft.tenantId)?.ownerId ? (
                    <button
                      type="button"
                      onClick={addBrandOwner}
                      className="text-xs font-medium text-[#e91825] hover:underline"
                    >
                      Marka sorumlusunu ekle
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {staff.map((u) => {
                const on = draft.attendeeIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    disabled={readOnly}
                    onClick={() => toggleAttendee(u.id)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ${
                      on
                        ? "border-[#141111] bg-[#141111] text-white"
                        : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"
                    } disabled:cursor-default`}
                  >
                    {on ? <Check className="size-3" aria-hidden /> : null}
                    {userLabel(u)}
                  </button>
                );
              })}
            </div>
          </div>

          <label className={labelCls}>
            Gündem
            <textarea
              value={draft.agenda}
              onChange={(e) => set("agenda", e.target.value)}
              disabled={readOnly}
              placeholder={"- Geçen haftanın sonuçları\n- Bütçe revizyonu\n- Yeni kreatifler"}
              className={`${textareaCls} mt-1`}
            />
          </label>
          <label className={labelCls}>
            Notlar
            <textarea
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
              disabled={readOnly}
              placeholder="Toplantı sırasında / sonrasında alınan notlar"
              className={`${textareaCls} mt-1 min-h-32`}
            />
          </label>
          <label className={labelCls}>
            Kararlar
            <textarea
              value={draft.decisions}
              onChange={(e) => set("decisions", e.target.value)}
              disabled={readOnly}
              placeholder="Alınan kararlar"
              className={`${textareaCls} mt-1`}
            />
          </label>

          {/* Aksiyonlar */}
          <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">
            <div className="flex items-center justify-between">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
                <ClipboardList className="size-3.5" aria-hidden />
                Aksiyon maddeleri
                {meeting
                  ? ` (${meeting.actionItems.filter((a) => a.done).length}/${meeting.actionItems.length})`
                  : ""}
              </p>
            </div>

            {isNew ? (
              <p className="text-xs text-zinc-500">
                Aksiyon maddeleri toplantı kaydedildikten sonra eklenir.
              </p>
            ) : (
              <>
                <ul className="space-y-1.5">
                  {meeting.actionItems.map((it) => (
                    <li
                      key={it.id}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-2"
                    >
                      <button
                        type="button"
                        disabled={readOnly || busyItem === it.id}
                        onClick={() => patchItem(it, { done: !it.done })}
                        aria-label={it.done ? "Tamamlanmadı olarak işaretle" : "Tamamlandı"}
                        className={`flex size-5 shrink-0 items-center justify-center rounded border ${
                          it.done
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-zinc-300 bg-white text-transparent hover:border-zinc-500"
                        }`}
                      >
                        <Check className="size-3.5" aria-hidden />
                      </button>
                      <span
                        className={`min-w-0 flex-1 text-sm ${
                          it.done ? "text-zinc-400 line-through" : "text-zinc-900"
                        }`}
                      >
                        {it.text}
                      </span>
                      <select
                        value={it.assigneeId ?? ""}
                        disabled={readOnly || busyItem === it.id}
                        onChange={(e) =>
                          patchItem(it, { assigneeId: e.target.value || null })
                        }
                        className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-700"
                        aria-label="Sorumlu"
                      >
                        <option value="">Sorumlu yok</option>
                        {staff.map((u) => (
                          <option key={u.id} value={u.id}>
                            {userLabel(u)}
                          </option>
                        ))}
                      </select>
                      <input
                        type="date"
                        value={toLocalDateInput(it.dueAt)}
                        disabled={readOnly || busyItem === it.id}
                        onChange={(e) =>
                          patchItem(it, {
                            dueAt: e.target.value
                              ? new Date(`${e.target.value}T18:00:00`).toISOString()
                              : null,
                          })
                        }
                        className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-700"
                        aria-label="Termin"
                      />
                      {it.boardCard ? (
                        <Link
                          href="/board"
                          className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-200"
                          title={it.boardCard.title}
                        >
                          Pano · {it.boardCard.columnName}
                          <ArrowUpRight className="size-3" aria-hidden />
                        </Link>
                      ) : !readOnly ? (
                        <button
                          type="button"
                          disabled={busyItem === it.id}
                          onClick={() => patchItem(it, { convertToCard: true })}
                          className="rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:border-[#141111]"
                        >
                          Göreve çevir
                        </button>
                      ) : null}
                      {!readOnly ? (
                        <button
                          type="button"
                          disabled={busyItem === it.id}
                          onClick={() => deleteItem(it)}
                          className="rounded-md p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
                          aria-label="Maddeyi sil"
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {!readOnly ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void addItem();
                    }}
                    className="flex gap-2"
                  >
                    <input
                      value={newItem}
                      onChange={(e) => setNewItem(e.target.value)}
                      placeholder="Yeni aksiyon maddesi…"
                      className={inputCls}
                      disabled={busyItem === "new"}
                    />
                    <button
                      type="submit"
                      disabled={!newItem.trim() || busyItem === "new"}
                      className={btnSecondary}
                    >
                      <Plus className="size-4" aria-hidden />
                      Ekle
                    </button>
                  </form>
                ) : null}
              </>
            )}
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 px-5 py-3">
          <div>
            {!isNew && canDelete ? (
              <button
                type="button"
                onClick={destroy}
                disabled={saving}
                className={`${btnGhost} text-rose-600 hover:bg-rose-50 hover:text-rose-700`}
              >
                <Trash2 className="size-4" aria-hidden />
                Sil
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className={btnSecondary}>
              {readOnly ? "Kapat" : "Vazgeç"}
            </button>
            {!readOnly ? (
              <button
                type="button"
                onClick={save}
                disabled={saving || !dirty}
                className={btnPrimary}
              >
                {saving ? "Kaydediliyor…" : isNew ? "Oluştur" : "Kaydet"}
              </button>
            ) : null}
          </div>
        </footer>
      </aside>
    </div>
  );
}
