import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/panel/audit";
import { ensureAgencyBoard } from "@/lib/panel/board";
import { formatDateTime } from "@/lib/panel/format";
import {
  allStaffIds,
  cleanIdList,
  loadMeeting,
  parseDateInput,
  serializeMeeting,
} from "@/lib/panel/meetings";
import {
  requirePermissionApi,
  resolveStaffUserId,
} from "@/lib/panel/staff-auth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; itemId: string }> };

type PatchBody = {
  text?: string;
  assigneeIds?: string[];
  dueAt?: string | null;
  done?: boolean;
  /** true → Durum panosunda kart aç ve maddeye bağla. */
  convertToCard?: boolean;
};

/** PATCH — aksiyon maddesini güncelle / göreve çevir. */
export async function PATCH(request: Request, ctx: Ctx) {
  const { session, error } = await requirePermissionApi("meetings.manage");
  if (error || !session) return error;

  const { id, itemId } = await ctx.params;
  const item = await prisma.meetingActionItem.findFirst({
    where: { id: itemId, meetingId: id },
    include: {
      assignees: { select: { userId: true } },
      meeting: {
        select: {
          id: true,
          title: true,
          startsAt: true,
          tenantId: true,
          teamId: true,
        },
      },
    },
  });
  if (!item) {
    return NextResponse.json({ error: "Madde bulunamadı" }, { status: 404 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  }

  const data: Parameters<typeof prisma.meetingActionItem.update>[0]["data"] = {};

  if (body.text !== undefined) {
    const text = body.text.trim();
    if (!text) {
      return NextResponse.json({ error: "Madde boş olamaz" }, { status: 400 });
    }
    data.text = text;
  }
  if (body.assigneeIds !== undefined) {
    const assigneeIds = cleanIdList(body.assigneeIds);
    if (!(await allStaffIds(assigneeIds))) {
      return NextResponse.json(
        { error: "Atanan kişi staff olmalı" },
        { status: 400 },
      );
    }
    data.assignees = {
      deleteMany: {},
      create: assigneeIds.map((userId) => ({ userId })),
    };
  }
  if (body.dueAt !== undefined) {
    const d = parseDateInput(body.dueAt);
    if (d === "invalid") {
      return NextResponse.json({ error: "Geçersiz tarih" }, { status: 400 });
    }
    data.dueAt = d;
  }
  if (body.done !== undefined) data.done = Boolean(body.done);

  if (Object.keys(data).length > 0) {
    await prisma.meetingActionItem.update({ where: { id: itemId }, data });
    await audit(session, {
      action: "meeting.action_update",
      entity: "meeting",
      entityId: id,
      tenantId: item.meeting.tenantId,
      summary: `${item.meeting.title}: ${
        body.done === true ? "aksiyon tamamlandı" : body.done === false ? "aksiyon yeniden açıldı" : "aksiyon güncellendi"
      } — ${typeof data.text === "string" ? data.text : item.text}`,
    });
  }

  if (body.convertToCard && !item.boardCardId) {
    const board = await ensureAgencyBoard();
    const column = board.columns[0];
    if (!column) {
      return NextResponse.json(
        { error: "Durum panosunda kolon yok" },
        { status: 409 },
      );
    }
    const fresh = await prisma.meetingActionItem.findUnique({
      where: { id: itemId },
      include: { assignees: { select: { userId: true } } },
    });
    const text = fresh?.text ?? item.text;
    const assigneeIds = (fresh?.assignees ?? item.assignees).map((a) => a.userId);
    const dueAt = fresh?.dueAt ?? item.dueAt;
    const actorId = await resolveStaffUserId(session);
    const maxPos = await prisma.boardCard.aggregate({
      where: { columnId: column.id },
      _max: { position: true },
    });

    const card = await prisma.boardCard.create({
      data: {
        columnId: column.id,
        title: text,
        description: `Toplantı: ${item.meeting.title} (${formatDateTime(
          item.meeting.startsAt.toISOString(),
        )})`,
        position: (maxPos._max.position ?? -1) + 1,
        teamId: item.meeting.teamId,
        tenantId: item.meeting.tenantId,
        dueAt,
        labels: ["toplantı"],
        createdById: actorId,
        assignees:
          assigneeIds.length > 0
            ? { create: assigneeIds.map((userId) => ({ userId })) }
            : undefined,
        activities: {
          create: {
            actorId,
            type: "created",
            message: "Toplantı aksiyonundan oluşturuldu",
            meta: { meetingId: item.meeting.id, actionItemId: itemId },
          },
        },
      },
      select: { id: true },
    });

    await prisma.meetingActionItem.update({
      where: { id: itemId },
      data: { boardCardId: card.id },
    });
    await audit(session, {
      action: "meeting.action_to_card",
      entity: "meeting",
      entityId: id,
      tenantId: item.meeting.tenantId,
      summary: `${item.meeting.title}: aksiyon göreve çevrildi — ${text}`,
    });
  }

  const full = await loadMeeting(id);
  return NextResponse.json({ meeting: full ? serializeMeeting(full) : null });
}

/** DELETE — aksiyon maddesini sil (bağlı pano kartı kalır). */
export async function DELETE(_request: Request, ctx: Ctx) {
  const { session, error } = await requirePermissionApi("meetings.manage");
  if (error || !session) return error;

  const { id, itemId } = await ctx.params;
  const item = await prisma.meetingActionItem.findFirst({
    where: { id: itemId, meetingId: id },
    select: { id: true, text: true, meeting: { select: { title: true, tenantId: true } } },
  });
  if (!item) {
    return NextResponse.json({ error: "Madde bulunamadı" }, { status: 404 });
  }
  await prisma.meetingActionItem.delete({ where: { id: itemId } });
  await audit(session, {
    action: "meeting.action_delete",
    entity: "meeting",
    entityId: id,
    tenantId: item.meeting.tenantId,
    summary: `${item.meeting.title}: aksiyon silindi — ${item.text}`,
  });

  const full = await loadMeeting(id);
  return NextResponse.json({ meeting: full ? serializeMeeting(full) : null });
}
