import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit, diffFields } from "@/lib/panel/audit";
import {
  createDesignCardForPost,
  isContentStatus,
  isPlatform,
  postInclude,
  serializePost,
} from "@/lib/panel/content-posts";
import { requirePermissionApi, resolveStaffUserId } from "@/lib/panel/staff-auth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

type PatchBody = {
  title?: string;
  platform?: string;
  scheduledAt?: string;
  status?: string;
  brief?: string;
  caption?: string;
  mediaUrls?: string[];
  assigneeId?: string | null;
  designerId?: string | null;
  /** true → Durum panosunda tasarım kartı aç. */
  convertToCard?: boolean;
};

function cleanUrls(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map((x) => String(x).trim()).filter((x) => /^https?:\/\//i.test(x)))].slice(0, 20);
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { session, error } = await requirePermissionApi("brands.edit");
  if (error || !session) return error;
  const { id } = await ctx.params;
  const existing = await prisma.contentPost.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "İçerik bulunamadı" }, { status: 404 });

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  }

  const data: Parameters<typeof prisma.contentPost.update>[0]["data"] = {};
  if (body.title !== undefined) data.title = body.title.trim();
  if (body.platform !== undefined && isPlatform(body.platform)) data.platform = body.platform;
  if (body.scheduledAt !== undefined) {
    const d = new Date(body.scheduledAt);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Geçersiz tarih" }, { status: 400 });
    }
    data.scheduledAt = d;
  }
  if (body.status !== undefined) {
    if (!isContentStatus(body.status)) {
      return NextResponse.json({ error: "Geçersiz durum" }, { status: 400 });
    }
    data.status = body.status;
  }
  if (body.brief !== undefined) data.brief = body.brief.trim();
  if (body.caption !== undefined) data.caption = body.caption.trim();
  if (body.mediaUrls !== undefined) data.mediaUrls = cleanUrls(body.mediaUrls);
  if (body.assigneeId !== undefined) data.assigneeId = body.assigneeId?.trim() || null;
  if (body.designerId !== undefined) data.designerId = body.designerId?.trim() || null;

  if (Object.keys(data).length > 0) {
    const updated = await prisma.contentPost.update({ where: { id }, data });
    const diff = diffFields(
      { title: existing.title, platform: existing.platform, scheduledAt: existing.scheduledAt, status: existing.status, assigneeId: existing.assigneeId, designerId: existing.designerId },
      { title: updated.title, platform: updated.platform, scheduledAt: updated.scheduledAt, status: updated.status, assigneeId: updated.assigneeId, designerId: updated.designerId },
    );
    if (diff) {
      await audit(session, {
        action: "content_post.update",
        entity: "content_post",
        entityId: id,
        tenantId: existing.tenantId,
        summary: `İçerik güncellendi: ${updated.title || id}`,
        before: diff.before,
        after: diff.after,
      });
    }
  }

  if (body.convertToCard) {
    const actorId = await resolveStaffUserId(session);
    await createDesignCardForPost({ postId: id, actorId });
  }

  const full = await prisma.contentPost.findUnique({ where: { id }, include: postInclude });
  return NextResponse.json({ post: full ? serializePost(full) : null });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const { session, error } = await requirePermissionApi("brands.edit");
  if (error || !session) return error;
  const { id } = await ctx.params;
  const existing = await prisma.contentPost.findUnique({
    where: { id },
    select: { id: true, tenantId: true, title: true },
  });
  if (!existing) return NextResponse.json({ error: "İçerik bulunamadı" }, { status: 404 });
  await prisma.contentPost.delete({ where: { id } });
  await audit(session, {
    action: "content_post.delete",
    entity: "content_post",
    entityId: id,
    tenantId: existing.tenantId,
    summary: `İçerik silindi: ${existing.title || id}`,
  });
  return NextResponse.json({ ok: true });
}
