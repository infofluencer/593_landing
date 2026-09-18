import { NextResponse } from "next/server";
import type { BoardCardPriority } from "@prisma/client";
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

type CreateBody = {
  columnId?: string;
  title?: string;
  description?: string | null;
  /** @deprecated tek atama — assigneeIds tercih et */
  assigneeId?: string | null;
  assigneeIds?: string[];
  teamId?: string | null;
  tenantId?: string | null;
  dueAt?: string | null;
  priority?: BoardCardPriority;
  labels?: string[];
  sourceAlertId?: string | null;
};

function resolveAssigneeIds(body: CreateBody): string[] {
  if (Array.isArray(body.assigneeIds)) {
    return [
      ...new Set(
        body.assigneeIds.filter((id): id is string => typeof id === "string" && id.trim() !== ""),
      ),
    ];
  }
  const single = body.assigneeId?.trim();
  return single ? [single] : [];
}

/** POST — yeni kart. */
export async function POST(request: Request) {
  const { session, error } = await requireStaffApi();
  if (error || !session) return error;

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  }

  const columnId = body.columnId?.trim();
  const title = body.title?.trim();
  if (!columnId || !title) {
    return NextResponse.json(
      { error: "columnId ve title gerekli" },
      { status: 400 },
    );
  }

  const column = await prisma.boardColumn.findUnique({
    where: { id: columnId },
  });
  if (!column) {
    return NextResponse.json({ error: "Kolon bulunamadı" }, { status: 404 });
  }

  const assigneeIds = resolveAssigneeIds(body);
  if (assigneeIds.length > 0) {
    const count = await prisma.user.count({
      where: { id: { in: assigneeIds }, role: { in: ["admin", "team"] } },
    });
    if (count !== assigneeIds.length) {
      return NextResponse.json(
        { error: "Atanan kişi staff olmalı" },
        { status: 400 },
      );
    }
  }

  const teamId = body.teamId?.trim() || null;
  if (teamId) {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      return NextResponse.json({ error: "Ekip bulunamadı" }, { status: 400 });
    }
  }

  const tenantId = body.tenantId?.trim() || null;
  if (tenantId) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return NextResponse.json({ error: "Marka bulunamadı" }, { status: 400 });
    }
  }

  const sourceAlertId = body.sourceAlertId?.trim() || null;
  if (sourceAlertId) {
    const alert = await prisma.alert.findUnique({ where: { id: sourceAlertId } });
    if (!alert) {
      return NextResponse.json({ error: "Uyarı bulunamadı" }, { status: 400 });
    }
  }

  const priority =
    body.priority && PRIORITIES.has(body.priority) ? body.priority : "normal";

  let dueAt: Date | null = null;
  if (body.dueAt) {
    const d = new Date(body.dueAt);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Geçersiz dueAt" }, { status: 400 });
    }
    dueAt = d;
  }

  const labels = Array.isArray(body.labels)
    ? [
        ...new Set(
          body.labels
            .map((l) => String(l).trim())
            .filter(Boolean)
            .slice(0, 20),
        ),
      ]
    : [];

  const maxPos = await prisma.boardCard.aggregate({
    where: { columnId },
    _max: { position: true },
  });
  const position = (maxPos._max.position ?? -1) + 1;
  const actorId = await resolveStaffUserId(session);

  const card = await prisma.boardCard.create({
    data: {
      columnId,
      title,
      description: body.description?.trim() || null,
      position,
      priority,
      teamId,
      tenantId,
      dueAt,
      labels,
      sourceAlertId,
      createdById: actorId,
      assignees:
        assigneeIds.length > 0
          ? { create: assigneeIds.map((userId) => ({ userId })) }
          : undefined,
      activities: {
        create: {
          actorId,
          type: "created",
          message: "Kart oluşturuldu",
          meta: {
            teamId,
            tenantId,
            assigneeIds,
            sourceAlertId,
          },
        },
      },
    },
    include: boardCardInclude,
  });

  return NextResponse.json(
    { card: serializeBoardCard(card) },
    { status: 201 },
  );
}
