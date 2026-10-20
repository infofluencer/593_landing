/**
 * Marka notları — genel not, anlık istek, doküman / URL. Tüm ekip görür;
 * her not tarihli ve yazarı belli. İstek "Göreve çevir" ile Durum panosuna düşer.
 */
import type { BrandNoteKind, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ensureAgencyBoard } from "@/lib/panel/board";

export const NOTE_KINDS: BrandNoteKind[] = ["general", "request", "meeting", "document", "link"];

export const NOTE_KIND_LABEL: Record<BrandNoteKind, string> = {
  general: "Not",
  request: "İstek",
  meeting: "Toplantı notu",
  document: "Doküman",
  link: "Bağlantı",
};

export function isNoteKind(v: unknown): v is BrandNoteKind {
  return typeof v === "string" && (NOTE_KINDS as string[]).includes(v);
}

export const noteInclude = {
  author: { select: { id: true, name: true, email: true } },
  team: { select: { id: true, name: true, slug: true, color: true } },
  boardCard: {
    select: { id: true, title: true, column: { select: { name: true } } },
  },
} satisfies Prisma.BrandNoteInclude;

export type NoteWithRelations = Prisma.BrandNoteGetPayload<{ include: typeof noteInclude }>;

export type SerializedNote = {
  id: string;
  kind: BrandNoteKind;
  title: string;
  body: string;
  url: string | null;
  meetingAt: string | null;
  pinned: boolean;
  teamId: string | null;
  teamName: string | null;
  teamColor: string | null;
  boardCard: { id: string; title: string; column: string } | null;
  authorLabel: string;
  createdAt: string;
  updatedAt: string;
};

export function serializeNote(n: NoteWithRelations): SerializedNote {
  return {
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    url: n.url,
    meetingAt: n.meetingAt?.toISOString() ?? null,
    pinned: n.pinned,
    teamId: n.teamId,
    teamName: n.team?.name ?? null,
    teamColor: n.team?.color ?? null,
    boardCard: n.boardCard
      ? { id: n.boardCard.id, title: n.boardCard.title, column: n.boardCard.column.name }
      : null,
    authorLabel: n.author?.name || n.author?.email || n.authorEmail || "—",
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  };
}

export async function listBrandNotes(tenantId: string, take = 100) {
  const rows = await prisma.brandNote.findMany({
    where: { tenantId },
    include: noteInclude,
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take,
  });
  return rows.map(serializeNote);
}

/**
 * "Göreve çevir": notu başlık + açıklama olarak Durum panosunun ilk
 * kolonuna kart açar; ekip ve marka nottan gelir. Zaten çevrildiyse mevcut kartı döner.
 */
export async function convertNoteToCard(opts: {
  noteId: string;
  actorId: string | null;
}): Promise<{ cardId: string; created: boolean }> {
  const note = await prisma.brandNote.findUnique({
    where: { id: opts.noteId },
    include: { tenant: { select: { id: true, name: true } } },
  });
  if (!note) throw new Error("Not bulunamadı");
  if (note.boardCardId) return { cardId: note.boardCardId, created: false };

  const board = await ensureAgencyBoard();
  const column = board.columns[0];
  if (!column) throw new Error("Durum panosunda kolon yok");
  const maxPos = await prisma.boardCard.aggregate({
    where: { columnId: column.id },
    _max: { position: true },
  });
  const title = note.title.trim() || note.body.trim().split("\n")[0]?.slice(0, 120) || "İstek";
  const card = await prisma.boardCard.create({
    data: {
      columnId: column.id,
      title,
      description: [note.body.trim(), note.url ? `Bağlantı: ${note.url}` : null]
        .filter(Boolean)
        .join("\n\n") || null,
      position: (maxPos._max.position ?? -1) + 1,
      teamId: note.teamId,
      tenantId: note.tenantId,
      labels: [note.kind === "meeting" ? "toplantı" : "istek"],
      createdById: opts.actorId,
      activities: {
        create: {
          actorId: opts.actorId,
          type: "created",
          message: `${note.tenant.name} notundan oluşturuldu`,
          meta: { noteId: note.id },
        },
      },
    },
    select: { id: true },
  });
  await prisma.brandNote.update({
    where: { id: note.id },
    data: { boardCardId: card.id },
  });
  return { cardId: card.id, created: true };
}
