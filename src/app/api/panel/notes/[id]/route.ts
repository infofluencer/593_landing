import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/panel/audit";
import {
  convertNoteToCard,
  isNoteKind,
  noteInclude,
  serializeNote,
} from "@/lib/panel/brand-notes";
import { requirePermissionApi, resolveStaffUserId } from "@/lib/panel/staff-auth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

type PatchBody = {
  kind?: string;
  title?: string;
  body?: string;
  url?: string | null;
  teamId?: string | null;
  pinned?: boolean;
  /** true → Durum panosunda kart aç ve nota bağla. */
  convertToCard?: boolean;
};

/** PATCH — notu güncelle / sabitle / göreve çevir. */
export async function PATCH(request: Request, ctx: Ctx) {
  const { session, error } = await requirePermissionApi("brands.edit");
  if (error || !session) return error;
  const { id } = await ctx.params;
  const existing = await prisma.brandNote.findUnique({
    where: { id },
    select: { id: true, tenantId: true, title: true },
  });
  if (!existing) return NextResponse.json({ error: "Not bulunamadı" }, { status: 404 });

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  }

  const data: Parameters<typeof prisma.brandNote.update>[0]["data"] = {};
  if (body.kind !== undefined && isNoteKind(body.kind)) data.kind = body.kind;
  if (body.title !== undefined) data.title = body.title.trim();
  if (body.body !== undefined) data.body = body.body.trim();
  if (body.url !== undefined) {
    const url = body.url?.trim() || null;
    if (url && !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: "Bağlantı http(s) ile başlamalı" }, { status: 400 });
    }
    data.url = url;
  }
  if (body.teamId !== undefined) data.teamId = body.teamId?.trim() || null;
  if (body.pinned !== undefined) data.pinned = Boolean(body.pinned);

  if (Object.keys(data).length > 0) {
    await prisma.brandNote.update({ where: { id }, data });
  }

  let created = false;
  if (body.convertToCard) {
    const actorId = await resolveStaffUserId(session);
    const r = await convertNoteToCard({ noteId: id, actorId });
    created = r.created;
    if (created) {
      await audit(session, {
        action: "brand_note.to_card",
        entity: "brand_note",
        entityId: id,
        tenantId: existing.tenantId,
        summary: `Not göreve çevrildi: ${existing.title || id}`,
        after: { cardId: r.cardId },
      });
    }
  }

  const full = await prisma.brandNote.findUnique({ where: { id }, include: noteInclude });
  return NextResponse.json({ note: full ? serializeNote(full) : null, cardCreated: created });
}

/** DELETE — notu sil (bağlı pano kartı kalır). */
export async function DELETE(_request: Request, ctx: Ctx) {
  const { session, error } = await requirePermissionApi("brands.edit");
  if (error || !session) return error;
  const { id } = await ctx.params;
  const existing = await prisma.brandNote.findUnique({
    where: { id },
    select: { id: true, tenantId: true, title: true, kind: true },
  });
  if (!existing) return NextResponse.json({ error: "Not bulunamadı" }, { status: 404 });
  await prisma.brandNote.delete({ where: { id } });
  await audit(session, {
    action: "brand_note.delete",
    entity: "brand_note",
    entityId: id,
    tenantId: existing.tenantId,
    summary: `Not silindi: ${existing.title || existing.kind}`,
  });
  return NextResponse.json({ ok: true });
}
