import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/panel/audit";
import {
  allStaffIds,
  cleanIdList,
  isMeetingStatus,
  meetingInclude,
  parseDateInput,
  serializeMeeting,
} from "@/lib/panel/meetings";
import {
  requirePermissionApi,
  requireStaffApi,
  resolveStaffUserId,
} from "@/lib/panel/staff-auth";

export const runtime = "nodejs";

/**
 * GET — toplantı listesi.
 * ?scope=brand|team|agency  ?tenantId=  ?teamId=  ?status=  ?from=ISO  ?to=ISO
 */
export async function GET(request: Request) {
  const { session, error } = await requireStaffApi();
  if (error || !session) return error;

  const url = new URL(request.url);
  const scope = url.searchParams.get("scope");
  const tenantId = url.searchParams.get("tenantId")?.trim() || null;
  const teamId = url.searchParams.get("teamId")?.trim() || null;
  const status = url.searchParams.get("status");
  const from = parseDateInput(url.searchParams.get("from"));
  const to = parseDateInput(url.searchParams.get("to"));
  if (from === "invalid" || to === "invalid") {
    return NextResponse.json({ error: "Geçersiz tarih" }, { status: 400 });
  }

  const where: Prisma.MeetingWhereInput = {};
  if (tenantId) where.tenantId = tenantId;
  else if (teamId) where.teamId = teamId;
  else if (scope === "brand") where.tenantId = { not: null };
  else if (scope === "team") where.AND = [{ tenantId: null }, { teamId: { not: null } }];
  else if (scope === "agency") where.AND = [{ tenantId: null }, { teamId: null }];
  if (isMeetingStatus(status)) where.status = status;
  if (from || to) {
    where.startsAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const meetings = await prisma.meeting.findMany({
    where,
    include: meetingInclude,
    orderBy: { startsAt: "desc" },
    take: 500,
  });

  return NextResponse.json({ meetings: meetings.map(serializeMeeting) });
}

type CreateBody = {
  title?: string;
  tenantId?: string | null;
  teamId?: string | null;
  startsAt?: string;
  endsAt?: string | null;
  location?: string | null;
  status?: string;
  agenda?: string;
  notes?: string;
  decisions?: string;
  attendeeIds?: string[];
};

/** POST — yeni toplantı. */
export async function POST(request: Request) {
  const { session, error } = await requirePermissionApi("meetings.manage");
  if (error || !session) return error;

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  }

  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "Başlık gerekli" }, { status: 400 });
  }

  const startsAt = parseDateInput(body.startsAt);
  if (!startsAt || startsAt === "invalid") {
    return NextResponse.json(
      { error: "Geçerli bir başlangıç zamanı gerekli" },
      { status: 400 },
    );
  }
  const endsAt = parseDateInput(body.endsAt);
  if (endsAt === "invalid") {
    return NextResponse.json({ error: "Geçersiz bitiş zamanı" }, { status: 400 });
  }
  if (endsAt && endsAt < startsAt) {
    return NextResponse.json(
      { error: "Bitiş, başlangıçtan önce olamaz" },
      { status: 400 },
    );
  }

  const tenantId = body.tenantId?.trim() || null;
  const teamId = tenantId ? null : body.teamId?.trim() || null;
  if (tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      return NextResponse.json({ error: "Marka bulunamadı" }, { status: 400 });
    }
  }
  if (teamId) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true },
    });
    if (!team) {
      return NextResponse.json({ error: "Ekip bulunamadı" }, { status: 400 });
    }
  }

  const attendeeIds = cleanIdList(body.attendeeIds);
  if (!(await allStaffIds(attendeeIds))) {
    return NextResponse.json(
      { error: "Katılımcılar staff olmalı" },
      { status: 400 },
    );
  }

  const status = isMeetingStatus(body.status) ? body.status : "planned";
  const actorId = await resolveStaffUserId(session);

  const meeting = await prisma.meeting.create({
    data: {
      title,
      tenantId,
      teamId,
      startsAt,
      endsAt,
      location: body.location?.trim() || null,
      status,
      agenda: body.agenda?.trim() ?? "",
      notes: body.notes?.trim() ?? "",
      decisions: body.decisions?.trim() ?? "",
      createdById: actorId,
      attendees:
        attendeeIds.length > 0
          ? { create: attendeeIds.map((userId) => ({ userId })) }
          : undefined,
    },
    include: meetingInclude,
  });

  await audit(session, {
    action: "meeting.create",
    entity: "meeting",
    entityId: meeting.id,
    tenantId,
    summary: `Toplantı oluşturuldu: ${title}`,
    after: { title, tenantId, teamId, startsAt, attendeeIds },
  });

  return NextResponse.json(
    { meeting: serializeMeeting(meeting) },
    { status: 201 },
  );
}
