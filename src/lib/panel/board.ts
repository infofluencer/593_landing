import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const DEFAULT_COLUMNS: Array<{ name: string; color: string }> = [
  { name: "Yapılacak", color: "#71717a" },
  { name: "Devam ediyor", color: "#2563eb" },
  { name: "İncelemede", color: "#d97706" },
  { name: "Tamamlandı", color: "#16a34a" },
];

const staffSelect = { id: true, name: true, email: true } as const;

export const boardCardInclude = {
  assignees: {
    include: { user: { select: staffSelect } },
    orderBy: { createdAt: "asc" as const },
  },
  team: { select: { id: true, name: true, slug: true, color: true } },
  tenant: { select: { id: true, name: true, slug: true } },
  createdBy: { select: staffSelect },
  sourceAlert: {
    select: { id: true, type: true, severity: true, message: true },
  },
  activities: {
    orderBy: { createdAt: "desc" as const },
    take: 30,
    include: { actor: { select: staffSelect } },
  },
} as const;

const boardInclude = {
  columns: {
    orderBy: { position: "asc" as const },
    include: {
      cards: {
        orderBy: { position: "asc" as const },
        include: boardCardInclude,
      },
    },
  },
} as const;

/** İlk board yoksa varsayılan kolonlarla oluşturur. */
export async function ensureAgencyBoard() {
  const existing = await prisma.board.findFirst({
    orderBy: { createdAt: "asc" },
    include: boardInclude,
  });
  if (existing) return existing;

  return prisma.board.create({
    data: {
      name: "Ajans durumu",
      columns: {
        create: DEFAULT_COLUMNS.map((col, i) => ({
          name: col.name,
          color: col.color,
          position: i,
        })),
      },
    },
    include: boardInclude,
  });
}

export type AgencyBoard = Awaited<ReturnType<typeof ensureAgencyBoard>>;

/** Takım adı → URL-safe slug. */
export function slugifyTeamName(name: string): string {
  const base = name
    .trim()
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "ekip";
}

export async function uniqueTeamSlug(name: string, excludeId?: string) {
  const base = slugifyTeamName(name);
  let slug = base;
  let n = 2;
  for (;;) {
    const clash = await prisma.team.findFirst({
      where: {
        slug,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!clash) return slug;
    slug = `${base}-${n}`;
    n += 1;
  }
}

/** dueAt geçmiş ve kolon “Tamamlandı” değilse gecikmiş. */
export function isCardOverdue(opts: {
  dueAt: Date | string | null | undefined;
  columnName?: string | null;
}): boolean {
  if (!opts.dueAt) return false;
  const due = typeof opts.dueAt === "string" ? new Date(opts.dueAt) : opts.dueAt;
  if (Number.isNaN(due.getTime())) return false;
  const done = (opts.columnName ?? "").toLocaleLowerCase("tr").includes("tamam");
  if (done) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  return dueDay.getTime() < today.getTime();
}

export function overdueDays(dueAt: Date | string): number {
  const due = typeof dueAt === "string" ? new Date(dueAt) : dueAt;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  return Math.max(
    1,
    Math.round((today.getTime() - dueDay.getTime()) / 86_400_000),
  );
}

export async function logCardActivity(opts: {
  cardId: string;
  actorId?: string | null;
  type: string;
  message?: string | null;
  meta?: Prisma.InputJsonValue;
}) {
  return prisma.boardCardActivity.create({
    data: {
      cardId: opts.cardId,
      actorId: opts.actorId ?? null,
      type: opts.type,
      message: opts.message ?? null,
      meta: opts.meta ?? {},
    },
  });
}

/** API yanıtında eski `assignee` alanını da doldur (UI geçişi). */
export function withLegacyAssignee<
  T extends {
    assignees?: Array<{ user: { id: string; name: string | null; email: string } }>;
  },
>(card: T) {
  const first = card.assignees?.[0]?.user ?? null;
  return { ...card, assignee: first };
}

type CardForSerialize = {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  position: number;
  priority: "low" | "normal" | "high" | "urgent";
  teamId: string | null;
  tenantId: string | null;
  dueAt: Date | string | null;
  labels: string[];
  sourceAlertId: string | null;
  createdBy: { id: string; name: string | null; email: string } | null;
  team: { id: string; name: string; slug: string; color: string } | null;
  tenant: { id: string; name: string; slug: string } | null;
  sourceAlert: {
    id: string;
    type: string;
    severity: string;
    message: string | null;
  } | null;
  assignees: Array<{
    user: { id: string; name: string | null; email: string };
  }>;
  activities?: Array<{
    id: string;
    type: string;
    message: string | null;
    createdAt: Date | string;
    actor: { id: string; name: string | null; email: string } | null;
  }>;
};

/** Client StatusBoard için düz JSON kart. */
export function serializeBoardCard(card: CardForSerialize) {
  const assignees = (card.assignees ?? []).map((a) => a.user);
  return {
    id: card.id,
    columnId: card.columnId,
    title: card.title,
    description: card.description,
    position: card.position,
    priority: card.priority,
    teamId: card.teamId,
    tenantId: card.tenantId,
    dueAt:
      card.dueAt == null
        ? null
        : typeof card.dueAt === "string"
          ? card.dueAt
          : card.dueAt.toISOString(),
    labels: card.labels ?? [],
    sourceAlertId: card.sourceAlertId,
    assignees,
    assignee: assignees[0] ?? null,
    createdBy: card.createdBy,
    team: card.team,
    tenant: card.tenant,
    sourceAlert: card.sourceAlert,
    activities: (card.activities ?? []).map((a) => ({
      id: a.id,
      type: a.type,
      message: a.message,
      createdAt:
        typeof a.createdAt === "string"
          ? a.createdAt
          : a.createdAt.toISOString(),
      actor: a.actor,
    })),
  };
}

