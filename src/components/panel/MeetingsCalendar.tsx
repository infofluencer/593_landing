"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo } from "react";
import type { SerializedMeeting } from "@/lib/panel/meetings";

export type CalendarView = "month" | "week";

const WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const HOUR_START = 8;
const HOUR_END = 20;
const HOUR_PX = 56;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Pazartesi başlangıçlı hafta. */
function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7;
  return addDays(x, -dow);
}

function fmtTime(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Kapsam rengi: ekip rengi, marka = ajans kırmızısı, genel = mürekkep. */
export function meetingColor(m: SerializedMeeting): string {
  if (m.scope === "team" && m.team?.color && /^#[0-9a-fA-F]{6}$/.test(m.team.color))
    return m.team.color;
  if (m.scope === "brand") return "#e91825";
  return "#141111";
}

function meetingSubtitle(m: SerializedMeeting) {
  if (m.scope === "brand") return m.tenant?.name ?? "Marka";
  if (m.scope === "team") return m.team?.name ?? "Ekip";
  return "Ajans geneli";
}

function endOf(m: SerializedMeeting) {
  const s = new Date(m.startsAt);
  const e = m.endsAt ? new Date(m.endsAt) : new Date(s.getTime() + 60 * 60 * 1000);
  return e > s ? e : new Date(s.getTime() + 30 * 60 * 1000);
}

export function calendarTitle(view: CalendarView, cursor: Date) {
  if (view === "month") {
    return new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(cursor);
  }
  const s = startOfWeek(cursor);
  const e = addDays(s, 6);
  const sameMonth = s.getMonth() === e.getMonth();
  const left = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    ...(sameMonth ? {} : { month: "short" }),
  }).format(s);
  const right = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(e);
  return `${left} – ${right}`;
}

export function shiftCursor(view: CalendarView, cursor: Date, dir: -1 | 1) {
  if (view === "month") return new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1);
  return addDays(cursor, 7 * dir);
}

export function CalendarToolbar({
  view,
  cursor,
  onCursor,
}: {
  view: CalendarView;
  cursor: Date;
  onCursor: (d: Date) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center rounded-full border border-zinc-300 bg-white">
        <button
          type="button"
          onClick={() => onCursor(shiftCursor(view, cursor, -1))}
          className="flex size-10 items-center justify-center rounded-l-full text-zinc-600 hover:bg-zinc-100 hover:text-[#141111]"
          aria-label="Önceki"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onCursor(new Date())}
          className="h-10 border-x border-zinc-300 px-3 text-sm font-semibold text-[#141111] hover:bg-zinc-100"
        >
          Bugün
        </button>
        <button
          type="button"
          onClick={() => onCursor(shiftCursor(view, cursor, 1))}
          className="flex size-10 items-center justify-center rounded-r-full text-zinc-600 hover:bg-zinc-100 hover:text-[#141111]"
          aria-label="Sonraki"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
      <h3 className="text-base font-semibold capitalize tracking-tight text-zinc-900">
        {calendarTitle(view, cursor)}
      </h3>
    </div>
  );
}

function groupByDay(meetings: SerializedMeeting[]) {
  const map = new Map<string, SerializedMeeting[]>();
  for (const m of meetings) {
    const k = dayKey(new Date(m.startsAt));
    const arr = map.get(k);
    if (arr) arr.push(m);
    else map.set(k, [m]);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }
  return map;
}

/* —————————————————————— Ay görünümü —————————————————————— */

export function MonthView({
  meetings,
  cursor,
  today,
  onSelect,
  onCreateAt,
  onOpenDay,
}: {
  meetings: SerializedMeeting[];
  cursor: Date;
  today: Date;
  onSelect: (id: string) => void;
  onCreateAt?: (d: Date) => void;
  onOpenDay: (d: Date) => void;
}) {
  const byDay = useMemo(() => groupByDay(meetings), [meetings]);
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const todayKey = dayKey(today);

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.12em] ${
              i >= 5 ? "text-zinc-400" : "text-zinc-500"
            }`}
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const k = dayKey(d);
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = k === todayKey;
          const weekend = i % 7 >= 5;
          const items = byDay.get(k) ?? [];
          const shown = items.slice(0, 3);
          const extra = items.length - shown.length;
          return (
            <div
              key={k}
              className={`group relative min-h-24 border-b border-r border-zinc-100 p-1.5 sm:min-h-28 ${
                i % 7 === 6 ? "border-r-0" : ""
              } ${i >= 35 ? "border-b-0" : ""} ${
                weekend ? "bg-zinc-50/60" : "bg-white"
              } ${inMonth ? "" : "opacity-45"}`}
            >
              <div className="mb-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onOpenDay(d)}
                  className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition ${
                    isToday
                      ? "bg-[#e91825] text-white"
                      : "text-zinc-700 hover:bg-zinc-100"
                  }`}
                  aria-label={`${k} haftasını aç`}
                >
                  {d.getDate()}
                </button>
                {onCreateAt ? (
                  <button
                    type="button"
                    onClick={() => {
                      const at = new Date(d);
                      at.setHours(10, 0, 0, 0);
                      onCreateAt(at);
                    }}
                    className="flex size-6 items-center justify-center rounded-full text-zinc-400 opacity-0 transition hover:bg-zinc-100 hover:text-[#141111] focus:opacity-100 group-hover:opacity-100"
                    aria-label="Bu güne toplantı ekle"
                  >
                    <Plus className="size-3.5" aria-hidden />
                  </button>
                ) : null}
              </div>

              {/* Masaüstü: başlıklı çipler */}
              <ul className="hidden space-y-1 sm:block">
                {shown.map((m) => {
                  const c = meetingColor(m);
                  const cancelled = m.status === "cancelled";
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(m.id)}
                        title={`${m.title} · ${meetingSubtitle(m)}`}
                        className={`flex w-full items-center gap-1.5 truncate rounded-md px-1.5 py-1 text-left text-[11px] leading-tight transition hover:brightness-95 ${
                          cancelled ? "line-through opacity-60" : ""
                        }`}
                        style={{ backgroundColor: `${c}14`, color: "#141111" }}
                      >
                        <span
                          className="h-3 w-0.5 shrink-0 rounded-full"
                          style={{ backgroundColor: c }}
                        />
                        <span className="shrink-0 font-semibold tabular-nums" style={{ color: c }}>
                          {fmtTime(new Date(m.startsAt))}
                        </span>
                        <span className="truncate">{m.title}</span>
                      </button>
                    </li>
                  );
                })}
                {extra > 0 ? (
                  <li>
                    <button
                      type="button"
                      onClick={() => onOpenDay(d)}
                      className="px-1.5 text-[11px] font-medium text-zinc-500 hover:text-[#141111]"
                    >
                      +{extra} daha
                    </button>
                  </li>
                ) : null}
              </ul>

              {/* Mobil: renkli noktalar */}
              {items.length > 0 ? (
                <button
                  type="button"
                  onClick={() => onOpenDay(d)}
                  className="flex flex-wrap gap-1 sm:hidden"
                  aria-label={`${items.length} toplantı`}
                >
                  {items.slice(0, 4).map((m) => (
                    <span
                      key={m.id}
                      className="size-2 rounded-full"
                      style={{ backgroundColor: meetingColor(m) }}
                    />
                  ))}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* —————————————————————— Hafta görünümü —————————————————————— */

type Placed = { m: SerializedMeeting; top: number; height: number; lane: number; lanes: number };

function layoutDay(items: SerializedMeeting[], day: Date): Placed[] {
  const dayStart = new Date(day);
  dayStart.setHours(HOUR_START, 0, 0, 0);
  const totalMin = (HOUR_END - HOUR_START) * 60;
  const evs = items
    .map((m) => {
      const s = new Date(m.startsAt);
      const e = endOf(m);
      const startMin = Math.max(0, (s.getTime() - dayStart.getTime()) / 60000);
      const endMin = Math.min(totalMin, (e.getTime() - dayStart.getTime()) / 60000);
      return { m, startMin, endMin: Math.max(endMin, startMin + 25) };
    })
    .filter((e) => e.startMin < totalMin)
    .sort((a, b) => a.startMin - b.startMin);

  // Çakışan grupları sütunlara böl.
  const placed: Placed[] = [];
  let cluster: Array<(typeof evs)[number] & { lane: number }> = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1));
    for (const c of cluster) {
      placed.push({
        m: c.m,
        top: (c.startMin / 60) * HOUR_PX,
        height: ((c.endMin - c.startMin) / 60) * HOUR_PX,
        lane: c.lane,
        lanes,
      });
    }
    cluster = [];
  };
  for (const ev of evs) {
    if (cluster.length && ev.startMin >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    const used = new Set(
      cluster.filter((c) => c.endMin > ev.startMin).map((c) => c.lane),
    );
    let lane = 0;
    while (used.has(lane)) lane++;
    cluster.push({ ...ev, lane });
    clusterEnd = Math.max(clusterEnd, ev.endMin);
  }
  if (cluster.length) flush();
  return placed;
}

export function WeekView({
  meetings,
  cursor,
  now,
  onSelect,
  onCreateAt,
}: {
  meetings: SerializedMeeting[];
  cursor: Date;
  now: Date;
  onSelect: (id: string) => void;
  onCreateAt?: (d: Date) => void;
}) {
  const byDay = useMemo(() => groupByDay(meetings), [meetings]);
  const weekStart = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  const todayKey = dayKey(now);
  const nowMin = (now.getHours() - HOUR_START) * 60 + now.getMinutes();
  const showNow = nowMin >= 0 && nowMin <= (HOUR_END - HOUR_START) * 60;

  // Mesai dışı (08–20 aralığı dışında) toplantılar başlık satırında gösterilir.
  const outside = (d: Date) =>
    (byDay.get(dayKey(d)) ?? []).filter((m) => {
      const h = new Date(m.startsAt).getHours();
      return h < HOUR_START || h >= HOUR_END;
    });

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-zinc-200 bg-zinc-50">
          <div />
          {days.map((d, i) => {
            const isToday = dayKey(d) === todayKey;
            const out = outside(d);
            return (
              <div key={i} className="border-l border-zinc-200 px-2 py-2 text-center">
                <p
                  className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${
                    i >= 5 ? "text-zinc-400" : "text-zinc-500"
                  }`}
                >
                  {WEEKDAYS[i]}
                </p>
                <p
                  className={`mx-auto mt-0.5 flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
                    isToday ? "bg-[#e91825] text-white" : "text-zinc-900"
                  }`}
                >
                  {d.getDate()}
                </p>
                {out.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onSelect(m.id)}
                    className="mt-1 block w-full truncate rounded px-1 py-0.5 text-left text-[10px]"
                    style={{ backgroundColor: `${meetingColor(m)}1a` }}
                  >
                    {fmtTime(new Date(m.startsAt))} {m.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        <div className="relative grid grid-cols-[56px_repeat(7,minmax(0,1fr))]">
          <div className="relative">
            {hours.map((h) => (
              <div
                key={h}
                className="relative pr-2 text-right text-[10px] tabular-nums text-zinc-400"
                style={{ height: HOUR_PX }}
              >
                <span className="relative -top-1.5">{pad(h)}:00</span>
              </div>
            ))}
          </div>

          {days.map((d, di) => {
            const k = dayKey(d);
            const placed = layoutDay(byDay.get(k) ?? [], d);
            const isToday = k === todayKey;
            return (
              <div
                key={k}
                className={`relative border-l border-zinc-200 ${
                  di >= 5 ? "bg-zinc-50/60" : ""
                } ${isToday ? "bg-[#e91825]/[0.025]" : ""}`}
                style={{ height: hours.length * HOUR_PX }}
              >
                {hours.map((h, hi) => (
                  <button
                    key={h}
                    type="button"
                    disabled={!onCreateAt}
                    onClick={() => {
                      if (!onCreateAt) return;
                      const at = new Date(d);
                      at.setHours(h, 0, 0, 0);
                      onCreateAt(at);
                    }}
                    className={`absolute inset-x-0 block border-t border-zinc-100 transition enabled:hover:bg-zinc-100/70 disabled:cursor-default ${
                      hi === 0 ? "border-t-0" : ""
                    }`}
                    style={{ top: hi * HOUR_PX, height: HOUR_PX }}
                    aria-label={onCreateAt ? `${k} ${pad(h)}:00 toplantı ekle` : undefined}
                    tabIndex={onCreateAt ? 0 : -1}
                  />
                ))}

                {placed.map(({ m, top, height, lane, lanes }) => {
                  const c = meetingColor(m);
                  const cancelled = m.status === "cancelled";
                  const s = new Date(m.startsAt);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onSelect(m.id)}
                      title={`${m.title} · ${meetingSubtitle(m)}`}
                      className={`absolute overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 text-left shadow-sm transition hover:z-10 hover:shadow-md ${
                        cancelled ? "opacity-55" : ""
                      }`}
                      style={{
                        top: top + 1,
                        height: Math.max(height - 2, 22),
                        left: `calc(${(lane / lanes) * 100}% + 2px)`,
                        width: `calc(${100 / lanes}% - 4px)`,
                        borderLeftColor: c,
                        backgroundColor: `color-mix(in srgb, ${c} 12%, white)`,
                      }}
                    >
                      <p
                        className={`truncate text-[11px] font-semibold leading-tight text-[#141111] ${
                          cancelled ? "line-through" : ""
                        }`}
                      >
                        {m.title}
                      </p>
                      {height > 34 ? (
                        <p className="truncate text-[10px] leading-tight text-zinc-600">
                          {fmtTime(s)}–{fmtTime(endOf(m))} · {meetingSubtitle(m)}
                        </p>
                      ) : null}
                    </button>
                  );
                })}

                {isToday && showNow ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                    style={{ top: (nowMin / 60) * HOUR_PX }}
                  >
                    <span className="-ml-1 size-2 rounded-full bg-[#e91825]" />
                    <span className="h-px flex-1 bg-[#e91825]" />
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

/** Takvim lejantı — kapsam renkleri. */
export function CalendarLegend({
  teams,
}: {
  teams: Array<{ id: string; name: string; color: string }>;
}) {
  const items = [
    { label: "Marka", color: "#e91825" },
    ...teams.map((t) => ({ label: t.name, color: t.color })),
    { label: "Ajans geneli", color: "#141111" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-500">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}
