import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/panel/audit";
import {
  isNoteKind,
  listBrandNotes,
  noteInclude,
  serializeNote,
} from "@/lib/panel/brand-notes";
import {
  requirePermissionApi,
  requireStaffApi,
  resolveStaffUserId,
} from "@/lib/panel/staff-auth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ slug: string }> };

async function tenantBySlug(slug: string) {
  return prisma.tenant.findUnique({
    where: { slug: decodeURIComponent(slug).trim().toLowerCase() },
    select: { id: true, name: true },
  });
}

/** GET — marka notları (sabitlenenler önce, sonra yeniden eskiye). */
export async function GET(_request: Request, ctx: Ctx) {
  const { session, error } = await requireStaffApi();
  if (error || !session) return error;
  const { slug } = await ctx.params;
  const tenant = await tenantBySlug(slug);
  if (!tenant) return NextResponse.json({ error: "Marka bulunamadı" }, { status: 404 });
  return NextResponse.json({ notes: await listBrandNotes(tenant.id) });
}

type CreateBody = {
  kind?: string;
  title?: string;
  body?: string;
  url?: string | null;
  teamId?: string | null;
  meetingAt?: string | null;
  pinned?: boolean;
};

/** POST — yeni not / istek / doküman. */
export async function POST(request: Request, ctx: Ctx) {
  const { session, error } = await requirePermissionApi("brands.edit");
  if (error || !session) return error;
  const { slug } = await ctx.params;
  const tenant = await tenantBySlug(slug);
  if (!tenant) return NextResponse.json({ error: "Marka bulunamadı" }, { status: 404 });

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  }
  const kind = isNoteKind(body.kind) ? body.kind : "general";
  const title = body.title?.trim() ?? "";
  const text = body.body?.trim() ?? "";
  const url = body.url?.trim() || null;
  if (!title && !text && !url) {
    return NextResponse.json({ error: "Başlık, metin veya bağlantı gerekli" }, { status: 400 });
  }
  if (url && !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "Bağlantı http(s) ile başlamalı" }, { status: 400 });
  }
  const teamId = body.teamId?.trim() || null;
  if (teamId) {
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
    if (!team) return NextResponse.json({ error: "Ekip bulunamadı" }, { status: 400 });
  }
  let meetingAt: Date | null = null;
  if (body.meetingAt) {
    const d = new Date(body.meetingAt);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Geçersiz toplantı tarihi" }, { status: 400 });
    }
    meetingAt = d;
  }

  const actorId = await resolveStaffUserId(session);
  const note = await prisma.brandNote.create({
    data: {
      tenantId: tenant.id,
      authorId: actorId,
      authorEmail: session.user.email?.toLowerCase() ?? null,
      kind,
      title,
      body: text,
      url,
      teamId,
      meetingAt,
      pinned: Boolean(body.pinned),
    },
    include: noteInclude,
  });
  await audit(session, {
    action: "brand_note.create",
    entity: "brand_note",
    entityId: note.id,
    tenantId: tenant.id,
    summary: `${tenant.name}: not eklendi (${kind})`,
    after: { kind, title, url, teamId },
  });
  return NextResponse.json({ note: serializeNote(note) }, { status: 201 });
}
