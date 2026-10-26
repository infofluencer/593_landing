import type { MeetingStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Toplantılar — tek model, üç kapsam:
 *  - tenantId dolu → marka toplantısı
 *  - teamId dolu   → ekip toplantısı
 *  - ikisi de boş → ajans geneli
 * Katılımcılar ve not yazarları yalnızca staff; müşteri kullanıcıları yok.
 */

const staffSelect = { id: true, name: true, email: true } as const;

export const meetingInclude = {
  tenant: { select: { id: true, name: true, slug: true, coverUrl: true } },
  team: { select: { id: true, name: true, slug: true, color: true } },
  createdBy: { select: staffSelect },
  attendees: {
    include: { user: { select: staffSelect } },
    orderBy: { createdAt: "asc" as const },
  },
  actionItems: {
    orderBy: { position: "asc" as const },
    include: {
      assignees: {
        include: { user: { select: staffSelect } },
        orderBy: { createdAt: "asc" as const },
      },
      boardCard: {
        select: { id: true, title: true, column: { select: { name: true } } },
      },
    },
  },
} as const;

export type MeetingRow = Prisma.MeetingGetPayload<{
  include: typeof meetingInclude;
}>;

export type MeetingScope = "brand" | "team" | "agency";

export const MEETING_STATUSES: readonly MeetingStatus[] = [
  "planned",
  "done",
  "cancelled",
];

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  planned: "Planlandı",
  done: "Yapıldı",
  cancelled: "İptal",
};

export function isMeetingStatus(v: unknown): v is MeetingStatus {
  return typeof v === "string" && (MEETING_STATUSES as string[]).includes(v);
}

export function meetingScope(m: {
  tenantId: string | null;
  teamId: string | null;
}): MeetingScope {
  if (m.tenantId) return "brand";
  if (m.teamId) return "team";
  return "agency";
}

export function serializeMeeting(m: MeetingRow) {
  return {
    id: m.id,
    title: m.title,
    scope: meetingScope(m),
    tenantId: m.tenantId,
    teamId: m.teamId,
    tenant: m.tenant,
    team: m.team,
    startsAt: m.startsAt.toISOString(),
    endsAt: m.endsAt ? m.endsAt.toISOString() : null,
    location: m.location,
    status: m.status,
    agenda: m.agenda,
    notes: m.notes,
    decisions: m.decisions,
    createdBy: m.createdBy,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    attendees: m.attendees.map((a) => ({
      userId: a.userId,
      user: a.user,
    })),
    actionItems: m.actionItems.map((it) => ({
      id: it.id,
      text: it.text,
      assigneeIds: it.assignees.map((a) => a.userId),
      assignees: it.assignees.map((a) => a.user),
      dueAt: it.dueAt ? it.dueAt.toISOString() : null,
      done: it.done,
      position: it.position,
      boardCard: it.boardCard
        ? {
            id: it.boardCard.id,
            title: it.boardCard.title,
            columnName: it.boardCard.column.name,
          }
        : null,
    })),
  };
}

export type SerializedMeeting = ReturnType<typeof serializeMeeting>;
export type SerializedActionItem = SerializedMeeting["actionItems"][number];

/** ISO/tarih dizesini Date'e çevirir; boş → null, bozuk → "invalid". */
export function parseDateInput(
  value: unknown,
): Date | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return "invalid";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "invalid" : d;
}

/** Benzersiz, boş olmayan string id listesi. */
export function cleanIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (id): id is string => typeof id === "string" && id.trim() !== "",
      ),
    ),
  ];
}

/** Verilen id'lerin tamamı staff (admin/team) kullanıcı mı? */
export async function allStaffIds(ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const count = await prisma.user.count({
    where: { id: { in: ids }, role: { in: ["admin", "team"] } },
  });
  return count === ids.length;
}

export async function loadMeeting(id: string) {
  return prisma.meeting.findUnique({ where: { id }, include: meetingInclude });
}
