/**
 * Ajans ofis günleri — her personelin kendi haftalık ofis günleri ayrıdır.
 * 1 = Pazartesi … 7 = Pazar (ISO).
 */
import { prisma } from "@/lib/db";
import { addDaysYmd, startOfWeekMondayYmd, ymdToUtcDate } from "@/lib/date/tr";
import { SHIFT_UI } from "@/components/panel/shift-ui";
import { fixedTeamOrderBy, fixedTeamWhere } from "@/lib/panel/teams";

export const OFFICE_WEEKDAYS = [
  { iso: 1, short: "Pzt", long: "Pazartesi" },
  { iso: 2, short: "Sal", long: "Salı" },
  { iso: 3, short: "Çar", long: "Çarşamba" },
  { iso: 4, short: "Per", long: "Perşembe" },
  { iso: 5, short: "Cum", long: "Cuma" },
] as const;

export type OfficeWeekdayIso = (typeof OFFICE_WEEKDAYS)[number]["iso"];

const WEEKDAY_SET = new Set<number>(OFFICE_WEEKDAYS.map((d) => d.iso));

export function isOfficeWeekday(value: unknown): value is OfficeWeekdayIso {
  return typeof value === "number" && WEEKDAY_SET.has(value);
}

/** YYYY-MM-DD → ISO weekday (1 Pzt … 7 Paz). */
export function isoWeekdayFromYmd(ymd: string): number {
  const dow = ymdToUtcDate(ymd).getUTCDay();
  return dow === 0 ? 7 : dow;
}

export function normalizeWeekdays(raw: readonly number[] | null | undefined): number[] {
  const unique = new Set<number>();
  for (const n of raw ?? []) {
    if (WEEKDAY_SET.has(n)) unique.add(n);
  }
  return [...unique].sort((a, b) => a - b);
}

export function weekdayLabels(days: readonly number[]): string {
  const names = OFFICE_WEEKDAYS.filter((d) => days.includes(d.iso)).map((d) => d.short);
  return names.length ? names.join(" · ") : "Ofis günü yok";
}

export function toggleWeekday(days: readonly number[], iso: number): number[] {
  const set = new Set(normalizeWeekdays(days));
  if (set.has(iso)) set.delete(iso);
  else set.add(iso);
  return [...set].sort((a, b) => a - b);
}

export type OfficeShiftTeamRef = {
  slug: string;
  name: string;
  color: string;
};

export type OfficeShiftPerson = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  officeWeekdays: number[];
  teams: OfficeShiftTeamRef[];
};

export type OfficeCalendarDay = {
  iso: OfficeWeekdayIso;
  short: string;
  long: string;
  ymd: string;
  dateLabel: string;
  isToday: boolean;
};

export type OfficeShiftBoardData = {
  today: string;
  todayIso: number;
  weekLabel: string;
  calendarDays: OfficeCalendarDay[];
  people: OfficeShiftPerson[];
  currentUserId: string | null;
};

export function thisWeekCalendarDays(todayYmd: string): OfficeCalendarDay[] {
  const monday = startOfWeekMondayYmd(todayYmd);
  return OFFICE_WEEKDAYS.map((day, i) => {
    const ymd = addDaysYmd(monday, i);
    return {
      ...day,
      ymd,
      dateLabel: String(ymdToUtcDate(ymd).getUTCDate()),
      isToday: ymd === todayYmd,
    };
  });
}

export function formatOfficeWeekLabel(todayYmd: string): string {
  const days = thisWeekCalendarDays(todayYmd);
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return "";
  const from = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(ymdToUtcDate(first.ymd));
  const to = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(ymdToUtcDate(last.ymd));
  return `${from} – ${to}`;
}

export async function loadOfficeShiftBoard(opts: {
  todayYmd: string;
  currentUserId: string | null;
}): Promise<OfficeShiftBoardData> {
  const staff = await prisma.user.findMany({
    where: {
      role: { in: ["admin", "team"] },
      viewOnly: false,
      NOT: {
        email: {
          in: ["admin@593emarketing.com", ...SHIFT_UI.omitEmails],
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      officeWeekdays: true,
      teamMemberships: {
        where: { team: fixedTeamWhere },
        select: {
          team: { select: { slug: true, name: true, color: true } },
        },
        orderBy: { team: fixedTeamOrderBy },
      },
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });

  const people: OfficeShiftPerson[] = staff.map((u) => ({
    id: u.id,
    name: (u.name ?? "").trim() || u.email,
    email: u.email,
    avatarUrl: u.avatarUrl,
    officeWeekdays: normalizeWeekdays(u.officeWeekdays),
    teams: u.teamMemberships.map((m) => ({
      slug: m.team.slug,
      name: m.team.name,
      color: m.team.color,
    })),
  }));

  return {
    today: opts.todayYmd,
    todayIso: isoWeekdayFromYmd(opts.todayYmd),
    weekLabel: formatOfficeWeekLabel(opts.todayYmd),
    calendarDays: thisWeekCalendarDays(opts.todayYmd),
    people,
    currentUserId: opts.currentUserId,
  };
}

export function sortShiftPeople<T extends { name: string }>(
  people: T[],
  order: readonly string[],
): T[] {
  const rank = new Map(order.map((n, i) => [n.toLocaleLowerCase("tr"), i]));
  return [...people].sort((a, b) => {
    const ia = rank.get(a.name.toLocaleLowerCase("tr"));
    const ib = rank.get(b.name.toLocaleLowerCase("tr"));
    if (ia != null && ib != null) return ia - ib;
    if (ia != null) return -1;
    if (ib != null) return 1;
    return a.name.localeCompare(b.name, "tr");
  });
}

export function countInOffice(
  people: Array<{ officeWeekdays: number[] }>,
  iso: number,
): number {
  return people.filter((p) => p.officeWeekdays.includes(iso)).length;
}
