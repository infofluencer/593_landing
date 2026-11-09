"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type CSSProperties } from "react";
import { Check } from "lucide-react";
import { EmptyState } from "@/components/panel/ds/EmptyState";
import { SHIFT_UI } from "@/components/panel/shift-ui";
import { avatarTone } from "@/components/panel/TeamPlatformIcon";
import {
  countInOffice,
  OFFICE_WEEKDAYS,
  sortShiftPeople,
  toggleWeekday,
  type OfficeShiftBoardData,
  type OfficeShiftPerson,
} from "@/lib/panel/office-shifts";

const ui = SHIFT_UI;

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]!.slice(0, 1)}${parts[parts.length - 1]!.slice(0, 1)}`.toLocaleUpperCase(
      "tr",
    );
  }
  return name.slice(0, 2).toLocaleUpperCase("tr");
}

function Face({
  person,
  size = "md",
}: {
  person: { id: string; name: string; avatarUrl: string | null };
  size?: "sm" | "md";
}) {
  const [broken, setBroken] = useState(false);
  const box = size === "sm" ? "size-8 text-[11px]" : "size-10 text-xs";
  if (person.avatarUrl && !broken) {
    return (
      <img
        src={person.avatarUrl}
        alt=""
        onError={() => setBroken(true)}
        className={`${box} shrink-0 rounded-full object-cover ring-1 ring-black/5`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`flex ${box} shrink-0 items-center justify-center rounded-full font-semibold text-white ring-1 ring-black/5 ${avatarTone(person.id)}`}
    >
      {initialsOf(person.name)}
    </span>
  );
}

function cardStyle(): CSSProperties {
  return {
    background: ui.colors.surface,
    border: `1px solid ${ui.colors.border}`,
    borderRadius: ui.size.radius,
  };
}

export default function OfficeShiftBoard({ data }: { data: OfficeShiftBoardData }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [local, setLocal] = useState<Record<string, number[]>>({});
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const people = useMemo(
    () =>
      sortShiftPeople(
        data.people.map((p) => ({
          ...p,
          officeWeekdays: local[p.id] ?? p.officeWeekdays,
        })),
        ui.peopleOrder,
      ),
    [data.people, local],
  );

  const dayCounts = OFFICE_WEEKDAYS.map((d) => ({
    ...d,
    count: countInOffice(people, d.iso),
  }));
  const barMax = Math.max(people.length, ...dayCounts.map((d) => d.count), 1);

  async function toggle(person: OfficeShiftPerson, iso: number) {
    const prev = local[person.id] ?? person.officeWeekdays;
    const next = toggleWeekday(prev, iso);
    setLocal((cur) => ({ ...cur, [person.id]: next }));
    setPendingKey(`${person.id}:${iso}`);
    setMessage(null);
    try {
      const res = await fetch("/api/panel/shifts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: person.id, weekday: iso }),
      });
      const json = (await res.json()) as {
        error?: string;
        officeWeekdays?: number[];
      };
      if (!res.ok) {
        setLocal((cur) => ({ ...cur, [person.id]: prev }));
        setMessage(json.error || "Kaydedilemedi");
        return;
      }
      if (json.officeWeekdays) {
        setLocal((cur) => ({ ...cur, [person.id]: json.officeWeekdays! }));
      }
      startTransition(() => router.refresh());
    } catch {
      setLocal((cur) => ({ ...cur, [person.id]: prev }));
      setMessage("Ağ hatası");
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{ui.copy.title}</h2>
        <p className="mt-1 text-sm" style={{ color: ui.colors.muted }}>
          {ui.copy.subtitle}
        </p>
      </div>

      {message ? (
        <p className="text-sm" style={{ color: ui.colors.accent }} role="status">
          {message}
        </p>
      ) : null}

      {people.length === 0 ? (
        <EmptyState
          title={ui.copy.emptyPeopleTitle}
          description={ui.copy.emptyPeopleBody}
        />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.9fr)] lg:items-start">
            {ui.show.table ? (
              <div className="overflow-x-auto" style={cardStyle()}>
                <div
                  className="border-b px-5 py-4 text-sm font-semibold"
                  style={{ borderColor: ui.colors.border, color: ui.colors.ink }}
                >
                  {ui.copy.planTitle}
                </div>
                <table
                  className="w-full border-collapse text-sm"
                  style={{ minWidth: ui.size.tableMinWidth }}
                >
                  <thead>
                    <tr style={{ background: ui.colors.tableHead }}>
                      <th
                        className="px-5 py-3 text-left text-[12px] font-semibold"
                        style={{ color: ui.colors.muted }}
                      >
                        {ui.copy.employeeHeader}
                      </th>
                      {dayCounts.map((day) => (
                        <th
                          key={day.iso}
                          className="px-2 py-3 text-center text-[12px] font-semibold"
                          style={{ color: ui.colors.ink }}
                        >
                          {day.short}
                          <span
                            className="mt-0.5 block text-[11px] font-medium"
                            style={{ color: ui.colors.faint }}
                          >
                            ({day.count}/{people.length})
                          </span>
                        </th>
                      ))}
                      <th
                        className="px-4 py-3 text-right text-[12px] font-semibold"
                        style={{ color: ui.colors.muted }}
                      >
                        {ui.copy.weeklyHeader}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {people.map((person, i) => (
                      <tr
                        key={person.id}
                        style={{
                          background:
                            i % 2 === 0 ? ui.colors.rowA : ui.colors.rowB,
                        }}
                      >
                        <th scope="row" className="px-5 py-2.5 text-left">
                          <span className="flex items-center gap-2.5">
                            <Face person={person} size="sm" />
                            <span className="min-w-0">
                              <span
                                className="block text-[14px] font-medium"
                                style={{ color: ui.colors.ink }}
                              >
                                {person.name}
                              </span>
                              {person.teams.length ? (
                                <span
                                  className="mt-0.5 block truncate text-[11px] font-medium"
                                  style={{ color: ui.colors.faint }}
                                >
                                  {person.teams.map((t) => t.name).join(" · ")}
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </th>
                        {OFFICE_WEEKDAYS.map((day) => {
                          const on = person.officeWeekdays.includes(day.iso);
                          const pending =
                            pendingKey === `${person.id}:${day.iso}`;
                          return (
                            <td key={day.iso} className="px-1 py-1.5 text-center">
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => void toggle(person, day.iso)}
                                className="mx-auto flex items-center justify-center rounded-lg transition hover:bg-black/5 disabled:opacity-50"
                                style={{
                                  width: ui.size.cell,
                                  height: ui.size.cell,
                                }}
                                aria-pressed={on}
                                aria-label={`${person.name}, ${day.long}: ${on ? "ofis" : "ofis değil"}`}
                              >
                                {on ? (
                                  <span
                                    className="flex size-7 items-center justify-center rounded-lg"
                                    style={{
                                      background: ui.colors.okBg,
                                      color: ui.colors.ok,
                                    }}
                                  >
                                    <Check
                                      className="size-4"
                                      strokeWidth={2.5}
                                      aria-hidden
                                    />
                                  </span>
                                ) : (
                                  <span
                                    className="text-base"
                                    style={{ color: ui.colors.faint }}
                                  >
                                    {ui.copy.offMark}
                                  </span>
                                )}
                              </button>
                            </td>
                          );
                        })}
                        <td
                          className="px-4 py-2.5 text-right text-[13px] font-medium tabular-nums"
                          style={{ color: ui.colors.muted }}
                        >
                          {person.officeWeekdays.length} gün
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {ui.show.chart ? (
              <div className="px-5 py-4" style={cardStyle()}>
                <p
                  className="text-sm font-semibold"
                  style={{ color: ui.colors.ink }}
                >
                  {ui.copy.chartTitle}
                </p>
                <div
                  className="relative mt-4 flex items-end justify-between gap-2"
                  style={{ height: ui.size.barMax + 28 }}
                >
                  {dayCounts.map((day) => {
                    const h = (day.count / barMax) * ui.size.barMax;
                    const hot = day.count === Math.max(...dayCounts.map((x) => x.count));
                    return (
                      <div
                        key={day.iso}
                        className="flex flex-1 flex-col items-center gap-1.5"
                      >
                        <span
                          className="text-[11px] font-semibold tabular-nums"
                          style={{ color: ui.colors.ink }}
                        >
                          {day.count}
                        </span>
                        <div
                          className="w-full max-w-[44px] rounded-t-md"
                          style={{
                            height: Math.max(h, 4),
                            background: hot ? ui.colors.bar : ui.colors.barMuted,
                          }}
                        />
                        <span
                          className="text-[11px] font-medium"
                          style={{ color: ui.colors.muted }}
                        >
                          {day.short}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
