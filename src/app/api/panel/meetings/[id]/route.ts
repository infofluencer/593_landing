import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit, diffFields } from "@/lib/panel/audit";
import {
  allStaffIds,
  cleanIdList,
  isMeetingStatus,
  loadMeeting,
  parseDateInput,
  serializeMeeting,
} from "@/lib/panel/meetings";
import {
  requirePermissionApi,
  requireStaffApi,
} from "@/lib/panel/staff-auth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** GET — tek toplantı. */
export async function GET(_request: Request, ctx: Ctx) {
  const { session, error } = await requireStaffApi();
  if (error || !session) return error;

  const { id } = await ctx.params;
  const meeting = await loadMeeting(id);
  if (!meeting) {
    return NextResponse.json({ error: "Toplantı bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ meeting: serializeMeeting(meeting) });
}

type PatchBody = {
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
  /** Tam liste — verilirse katılımcılar bununla değiştirilir. */
  attendeeIds?: string[];
};

/** PATCH — toplantı güncelle (alanlar kısmi). */
export async function PATCH(request: Request, ctx: Ctx) {
  const { session, error } = await requirePermissionApi("meetings.manage");
  if (error || !session) return error;

  const { id } = await ctx.params;
  const existing = await prisma.meeting.findUnique({
    where: { id },
    include: { attendees: { select: { userId: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Toplantı bulunamadı" }, { status: 404 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  }

  const data: Parameters<typeof prisma.meeting.update>[0]["data"] = {};

  if (body.title !== undefined) {
    const title = body.title.trim();
    if (!title) {
      return NextResponse.json({ error: "Başlık boş olamaz" }, { status: 400 });
    }
    data.title = title;
  }

  // Kapsam: tenantId dolu ise marka toplantısı (teamId sıfırlanır).
  let nextTenantId = existing.tenantId;
  let nextTeamId = existing.teamId;
  if (body.tenantId !== undefined) {
    nextTenantId = body.tenantId?.trim() || null;
    if (nextTenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: nextTenantId },
        select: { id: true },
      });
      if (!tenant) {
        return NextResponse.json({ error: "Marka bulunamadı" }, { status: 400 });
      }
    }
  }
  if (body.teamId !== undefined) {
    nextTeamId = body.teamId?.trim() || null;
    if (nextTeamId) {
      const team = await prisma.team.findUnique({
        where: { id: nextTeamId },
        select: { id: true },
      });
      if (!team) {
        return NextResponse.json({ error: "Ekip bulunamadı" }, { status: 400 });
      }
    }
  }
  if (nextTenantId) nextTeamId = null;
  if (body.tenantId !== undefined || body.teamId !== undefined) {
    data.tenantId = nextTenantId;
    data.teamId = nextTeamId;
  }

  let startsAt = existing.startsAt;
  if (body.startsAt !== undefined) {
    const d = parseDateInput(body.startsAt);
    if (!d || d === "invalid") {
      return NextResponse.json(
        { error: "Geçersiz başlangıç zamanı" },
        { status: 400 },
      );
    }
    startsAt = d;
    data.startsAt = d;
  }
  let endsAt = existing.endsAt;
  if (body.endsAt !== undefined) {
    const d = parseDateInput(body.endsAt);
    if (d === "invalid") {
      return NextResponse.json({ error: "Geçersiz bitiş zamanı" }, { status: 400 });
    }
    endsAt = d;
    data.endsAt = d;
  }
  if (endsAt && endsAt < startsAt) {
    return NextResponse.json(
      { error: "Bitiş, başlangıçtan önce olamaz" },
      { status: 400 },
    );
  }

  if (body.location !== undefined) data.location = body.location?.trim() || null;
  if (body.status !== undefined) {
    if (!isMeetingStatus(body.status)) {
      return NextResponse.json({ error: "Geçersiz durum" }, { status: 400 });
    }
    data.status = body.status;
  }
  if (body.agenda !== undefined) data.agenda = body.agenda.trim();
  if (body.notes !== undefined) data.notes = body.notes.trim();
  if (body.decisions !== undefined) data.decisions = body.decisions.trim();

  if (body.attendeeIds !== undefined) {
    const ids = cleanIdList(body.attendeeIds);
    if (!(await allStaffIds(ids))) {
      return NextResponse.json(
        { error: "Katılımcılar staff olmalı" },
        { status: 400 },
      );
    }
    data.attendees = {
      deleteMany: {},
      create: ids.map((userId) => ({ userId })),
    };
  }

  const updated = await prisma.meeting.update({ where: { id }, data });
  const full = await loadMeeting(id);
  if (!full) {
    return NextResponse.json({ error: "Toplantı bulunamadı" }, { status: 404 });
  }

  const beforeSnap = {
    title: existing.title,
    tenantId: existing.tenantId,
    teamId: existing.teamId,
    startsAt: existing.startsAt,
    endsAt: existing.endsAt,
    location: existing.location,
    status: existing.status,
    attendeeIds: existing.attendees.map((a) => a.userId).sort(),
  };
  const afterSnap = {
    title: updated.title,
    tenantId: updated.tenantId,
    teamId: updated.teamId,
    startsAt: updated.startsAt,
    endsAt: updated.endsAt,
    location: updated.location,
    status: updated.status,
    attendeeIds: full.attendees.map((a) => a.userId).sort(),
  };
  const diff = diffFields(beforeSnap, afterSnap);
  const textChanged =
    body.agenda !== undefined || body.notes !== undefined || body.decisions !== undefined;
  if (diff || textChanged) {
    await audit(session, {
      action: "meeting.update",
      entity: "meeting",
      entityId: id,
      tenantId: updated.tenantId,
      summary: `Toplantı güncellendi: ${updated.title}`,
      before: diff?.before,
      after: diff?.after,
    });
  }

  return NextResponse.json({ meeting: serializeMeeting(full) });
}

/** DELETE — toplantıyı sil (aksiyonlar cascade; pano kartları kalır). */
export async function DELETE(_request: Request, ctx: Ctx) {
  const { session, error } = await requirePermissionApi("meetings.delete");
  if (error || !session) return error;

  const { id } = await ctx.params;
  const existing = await prisma.meeting.findUnique({
    where: { id },
    select: { id: true, title: true, tenantId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Toplantı bulunamadı" }, { status: 404 });
  }

  await prisma.meeting.delete({ where: { id } });
  await audit(session, {
    action: "meeting.delete",
    entity: "meeting",
    entityId: id,
    tenantId: existing.tenantId,
    summary: `Toplantı silindi: ${existing.title}`,
    before: { title: existing.title },
  });

  return NextResponse.json({ ok: true });
}
