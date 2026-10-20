import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  allStaffIds,
  loadMeeting,
  parseDateInput,
  serializeMeeting,
} from "@/lib/panel/meetings";
import { requirePermissionApi } from "@/lib/panel/staff-auth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

type CreateBody = {
  text?: string;
  assigneeId?: string | null;
  dueAt?: string | null;
};

/** POST — toplantıya aksiyon maddesi ekle. */
export async function POST(request: Request, ctx: Ctx) {
  const { session, error } = await requirePermissionApi("meetings.manage");
  if (error || !session) return error;

  const { id } = await ctx.params;
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    select: { id: true },
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

  const assigneeId = body.assigneeId?.trim() || null;
  if (assigneeId && !(await allStaffIds([assigneeId]))) {
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
      assigneeId,
      dueAt,
      position: (maxPos._max.position ?? -1) + 1,
    },
  });

  const full = await loadMeeting(id);
  return NextResponse.json(
    { meeting: full ? serializeMeeting(full) : null },
    { status: 201 },
  );
}
