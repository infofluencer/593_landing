import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/panel/audit";
import {
  allStaffIds,
  cleanIdList,
  loadMeeting,
  parseDateInput,
  serializeMeeting,
} from "@/lib/panel/meetings";
import { requirePermissionApi } from "@/lib/panel/staff-auth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

type CreateBody = {
  text?: string;
  assigneeIds?: string[];
  dueAt?: string | null;
};

/** POST — toplantıya aksiyon maddesi ekle. */
export async function POST(request: Request, ctx: Ctx) {
  const { session, error } = await requirePermissionApi("meetings.manage");
  if (error || !session) return error;

  const { id } = await ctx.params;
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    select: { id: true, title: true, tenantId: true },
  });
  if (!meeting) {
    return NextResponse.json({ error: "Toplantı bulunamadı" }, { status: 404 });
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "Madde metni gerekli" }, { status: 400 });
  }

  const assigneeIds = cleanIdList(body.assigneeIds);
  if (!(await allStaffIds(assigneeIds))) {
    return NextResponse.json({ error: "Atanan kişi staff olmalı" }, { status: 400 });
  }

  const dueAt = parseDateInput(body.dueAt);
  if (dueAt === "invalid") {
    return NextResponse.json({ error: "Geçersiz tarih" }, { status: 400 });
  }

  const maxPos = await prisma.meetingActionItem.aggregate({
    where: { meetingId: id },
    _max: { position: true },
  });

  await prisma.meetingActionItem.create({
    data: {
      meetingId: id,
      text,
      dueAt,
      assignees:
        assigneeIds.length > 0
          ? { create: assigneeIds.map((userId) => ({ userId })) }
          : undefined,
      position: (maxPos._max.position ?? -1) + 1,
    },
  });
  await audit(session, {
    action: "meeting.action_add",
    entity: "meeting",
    entityId: id,
    tenantId: meeting.tenantId,
    summary: `${meeting.title}: aksiyon eklendi — ${text}`,
  });

  const full = await loadMeeting(id);
  return NextResponse.json(
    { meeting: full ? serializeMeeting(full) : null },
    { status: 201 },
  );
}
