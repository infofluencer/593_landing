import { NextResponse } from "next/server";
import type { BoardCardPriority, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  boardCardInclude,
  serializeBoardCard,
} from "@/lib/panel/board";
import { requireStaffApi, resolveStaffUserId } from "@/lib/panel/staff-auth";

export const runtime = "nodejs";

const PRIORITIES = new Set<BoardCardPriority>([
  "low",
  "normal",
  "high",
  "urgent",
]);

type PatchBody = {
  title?: string;
  description?: string | null;
  /** @deprecated */
  assigneeId?: string | null;
  assigneeIds?: string[];
  teamId?: string | null;
  tenantId?: string | null;
  dueAt?: string | null;
  priority?: BoardCardPriority;
  labels?: string[];
  columnId?: string;
  position?: number;
};

function resolveAssigneeIds(body: PatchBody): string[] | undefined {
  if (body.assigneeIds !== undefined) {
    if (!Array.isArray(body.assigneeIds)) return [];
    return [
      ...new Set(
        body.assigneeIds.filter(
          (id): id is string => typeof id === "string" && id.trim() !== "",
        ),
      ),
    ];
  }
  if (body.assigneeId !== undefined) {
    const single = body.assigneeId?.trim() || null;
    return single ? [single] : [];
  }
  return undefined;
}

/** PATCH — kart güncelle / taşı. */
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireStaffApi();
  if (error || !session) return error;

  const { id } = await ctx.params;
  const existing = await prisma.boardCard.findUnique({
    where: { id },
    include: {
      assignees: { select: { userId: true } },
      column: { select: { name: true } },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Kart bulunamadı" }, { status: 404 });
  }

  const actorId = await resolveStaffUserId(session);

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  }

  const data: {
    title?: string;
    description?: string | null;
    teamId?: string | null;
    tenantId?: string | null;
    dueAt?: Date | null;
    priority?: BoardCardPriority;
    labels?: string[];
    columnId?: string;
    position?: number;
  } = {};

  const activities: Array<{
    type: string;
    message: string;
    meta?: Prisma.InputJsonValue;
  }> = [];

  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) {
      return NextResponse.json({ error: "title boş olamaz" }, { status: 400 });
    }
    if (title !== existing.title) {
      data.title = title;
      activities.push({ type: "updated", message: "Başlık güncellendi" });
    }
  }

  if (body.description !== undefined) {
    const description =
      body.description == null ? null : String(body.description).trim() || null;
    data.description = description;
    activities.push({ type: "updated", message: "Açıklama güncellendi" });
  }

  if (body.teamId !== undefined) {
    const teamId = body.teamId?.trim() || null;
    if (teamId) {
      const team = await prisma.team.findUnique({ where: { id: teamId } });
      if (!team) {
        return NextResponse.json({ error: "Ekip bulunamadı" }, { status: 400 });
      }
    }
    if (teamId !== existing.teamId) {
      data.teamId = teamId;
      activities.push({
        type: "team",
        message: "Takım güncellendi",
        meta: { from: existing.teamId, to: teamId },
      });
    }
  }

  if (body.tenantId !== undefined) {
    const tenantId = body.tenantId?.trim() || null;
    if (tenantId) {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) {
        return NextResponse.json({ error: "Marka bulunamadı" }, { status: 400 });
      }
    }
    if (tenantId !== existing.tenantId) {
      data.tenantId = tenantId;
      activities.push({
        type: "tenant",
        message: "Marka güncellendi",
        meta: { from: existing.tenantId, to: tenantId },
      });
    }
  }

  if (body.dueAt !== undefined) {
    let dueAt: Date | null = null;
    if (body.dueAt != null && body.dueAt !== "") {
      const d = new Date(body.dueAt);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Geçersiz dueAt" }, { status: 400 });
      }
      dueAt = d;
    }
    data.dueAt = dueAt;
    activities.push({
      type: "due",
      message: "Son tarih güncellendi",
      meta: { dueAt },
    });
  }

  if (body.priority !== undefined) {
    if (!PRIORITIES.has(body.priority)) {
      return NextResponse.json({ error: "Geçersiz priority" }, { status: 400 });
    }
    if (body.priority !== existing.priority) {
      data.priority = body.priority;
      activities.push({
        type: "priority",
        message: `Öncelik: ${existing.priority} → ${body.priority}`,
        meta: { from: existing.priority, to: body.priority },
      });
    }
  }

  if (body.labels !== undefined) {
    if (!Array.isArray(body.labels)) {
      return NextResponse.json({ error: "labels dizi olmalı" }, { status: 400 });
    }
    data.labels = [
      ...new Set(
        body.labels
          .map((l) => String(l).trim())
          .filter(Boolean)
          .slice(0, 20),
      ),
    ];
    activities.push({ type: "labels", message: "Etiketler güncellendi" });
  }

  const nextAssigneeIds = resolveAssigneeIds(body);
  if (nextAssigneeIds !== undefined) {
    if (nextAssigneeIds.length > 0) {
      const count = await prisma.user.count({
        where: {
          id: { in: nextAssigneeIds },
          role: { in: ["admin", "team"] },
        },
      });
      if (count !== nextAssigneeIds.length) {
        return NextResponse.json(
          { error: "Atanan kişi staff olmalı" },
          { status: 400 },
        );
      }
    }
  }

  const moving =
    (body.columnId != null && body.columnId !== existing.columnId) ||
    typeof body.position === "number";

  if (moving) {
    const targetColumnId = body.columnId?.trim() || existing.columnId;
    const targetColumn = await prisma.boardColumn.findUnique({
      where: { id: targetColumnId },
    });
    if (!targetColumn) {
      return NextResponse.json({ error: "Kolon bulunamadı" }, { status: 404 });
    }

    const siblings = await prisma.boardCard.findMany({
      where: { columnId: targetColumnId, id: { not: id } },
      orderBy: { position: "asc" },
      select: { id: true },
    });

    let insertAt =
      typeof body.position === "number"
        ? Math.floor(body.position)
        : siblings.length;
    if (insertAt < 0) insertAt = 0;
    if (insertAt > siblings.length) insertAt = siblings.length;

    const ordered = [
      ...siblings.slice(0, insertAt).map((s) => s.id),
      id,
      ...siblings.slice(insertAt).map((s) => s.id),
    ];

    await prisma.$transaction(async (tx) => {
      if (targetColumnId !== existing.columnId) {
        const oldSiblings = await tx.boardCard.findMany({
          where: { columnId: existing.columnId, id: { not: id } },
          orderBy: { position: "asc" },
          select: { id: true },
        });
        for (let i = 0; i < oldSiblings.length; i++) {
          await tx.boardCard.update({
            where: { id: oldSiblings[i].id },
            data: { position: i },
          });
        }
        activities.push({
          type: "moved",
          message: `${existing.column.name} → ${targetColumn.name}`,
          meta: {
            fromColumnId: existing.columnId,
            toColumnId: targetColumnId,
          },
        });
      }

      for (let i = 0; i < ordered.length; i++) {
        await tx.boardCard.update({
          where: { id: ordered[i] },
          data: {
            columnId: targetColumnId,
            position: i,
            ...(ordered[i] === id ? data : {}),
          },
        });
      }

      if (nextAssigneeIds !== undefined) {
        await syncAssignees(tx, id, nextAssigneeIds, activities);
      }

      for (const a of activities) {
        await tx.boardCardActivity.create({
          data: {
            cardId: id,
            actorId,
            type: a.type,
            message: a.message,
            meta: a.meta ?? {},
          },
        });
      }
    });
  } else {
    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.boardCard.update({ where: { id }, data });
      }
      if (nextAssigneeIds !== undefined) {
        await syncAssignees(tx, id, nextAssigneeIds, activities);
      }
      for (const a of activities) {
        await tx.boardCardActivity.create({
          data: {
            cardId: id,
            actorId,
            type: a.type,
            message: a.message,
            meta: a.meta ?? {},
          },
        });
      }
    });
  }

  const card = await prisma.boardCard.findUnique({
    where: { id },
    include: boardCardInclude,
  });

  return NextResponse.json({
    card: card ? serializeBoardCard(card) : null,
  });
}

async function syncAssignees(
  tx: Prisma.TransactionClient,
  cardId: string,
  nextIds: string[],
  activities: Array<{
    type: string;
    message: string;
    meta?: Prisma.InputJsonValue;
  }>,
) {
  const current = await tx.boardCardAssignee.findMany({
    where: { cardId },
    select: { userId: true },
  });
  const curSet = new Set(current.map((c) => c.userId));
  const nextSet = new Set(nextIds);

  const toAdd = nextIds.filter((id) => !curSet.has(id));
  const toRemove = [...curSet].filter((id) => !nextSet.has(id));

  if (toRemove.length > 0) {
    await tx.boardCardAssignee.deleteMany({
      where: { cardId, userId: { in: toRemove } },
    });
    activities.push({
      type: "unassigned",
      message: "Atama kaldırıldı",
      meta: { userIds: toRemove },
    });
  }
  if (toAdd.length > 0) {
    await tx.boardCardAssignee.createMany({
      data: toAdd.map((userId) => ({ cardId, userId })),
    });
    activities.push({
      type: "assigned",
      message: "Atama eklendi",
      meta: { userIds: toAdd },
    });
  }
}

/** DELETE — kart sil. */
export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error } = await requireStaffApi();
  if (error) return error;

  const { id } = await ctx.params;
  const existing = await prisma.boardCard.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Kart bulunamadı" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.boardCard.delete({ where: { id } });
    const siblings = await tx.boardCard.findMany({
      where: { columnId: existing.columnId },
      orderBy: { position: "asc" },
      select: { id: true },
    });
    for (let i = 0; i < siblings.length; i++) {
      await tx.boardCard.update({
        where: { id: siblings[i].id },
        data: { position: i },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
