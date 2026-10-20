import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit, diffFields } from "@/lib/panel/audit";
import { normalizePhone } from "@/lib/panel/notify";
import { requirePermissionApi, resolveStaffUserId } from "@/lib/panel/staff-auth";

export const runtime = "nodejs";

type PatchBody = {
  name?: string | null;
  /** WhatsApp bildirimi için telefon; boş → kaldır. */
  phone?: string | null;
};

/** PATCH — staff kullanıcının adı / telefonu (admin: herkes, team: yalnızca kendisi). */
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requirePermissionApi("staff.access");
  if (error || !session) return error;

  const { id } = await ctx.params;
  const selfId = await resolveStaffUserId(session);
  if (session.user.role !== "admin" && selfId !== id) {
    return NextResponse.json({ error: "Yalnızca kendi bilgilerinizi düzenleyebilirsiniz" }, { status: 403 });
  }

  const user = await prisma.user.findFirst({
    where: { id, role: { in: ["admin", "team"] } },
    select: { id: true, email: true, name: true, phone: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  }

  const data: { name?: string | null; phone?: string | null } = {};
  if (body.name !== undefined) data.name = body.name?.trim() || null;
  if (body.phone !== undefined) {
    const raw = body.phone?.trim() || null;
    const phone = raw ? normalizePhone(raw) : null;
    if (raw && !phone) {
      return NextResponse.json(
        { error: "Telefon +90 5xx xxx xx xx biçiminde olmalı" },
        { status: 400 },
      );
    }
    data.phone = phone;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
    select: { id: true, email: true, name: true, phone: true, role: true },
  });
  const diff = diffFields(
    { name: user.name, phone: user.phone },
    { name: updated.name, phone: updated.phone },
  );
  if (diff) {
    await audit(session, {
      action: "user.update",
      entity: "user",
      entityId: user.id,
      summary: `${user.email} bilgileri güncellendi`,
      before: diff.before,
      after: diff.after,
    });
  }
  return NextResponse.json({ user: updated });
}

/** DELETE — staff kullanıcı sil (yalnızca admin). Kendini / son admini silemez. */
export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requirePermissionApi("users.manage");
  if (error || !session) return error;

  const { id } = await ctx.params;
  const user = await prisma.user.findFirst({
    where: { id, role: { in: ["admin", "team"] } },
    select: { id: true, role: true, email: true, name: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
  }

  const selfId = await resolveStaffUserId(session);
  if (selfId === user.id) {
    return NextResponse.json(
      { error: "Kendi hesabınızı silemezsiniz" },
      { status: 400 },
    );
  }

  if (user.role === "admin") {
    const admins = await prisma.user.count({ where: { role: "admin" } });
    if (admins <= 1) {
      return NextResponse.json(
        { error: "Son admin hesabı silinemez" },
        { status: 400 },
      );
    }
  }

  await prisma.user.delete({ where: { id: user.id } });
  await audit(session, {
    action: "user.delete",
    entity: "user",
    entityId: user.id,
    summary: `${user.email} (${user.role}) silindi`,
    before: { email: user.email, name: user.name, role: user.role },
  });
  return NextResponse.json({ ok: true });
}
