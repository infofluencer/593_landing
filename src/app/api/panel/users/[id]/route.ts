import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermissionApi, resolveStaffUserId } from "@/lib/panel/staff-auth";

export const runtime = "nodejs";

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
    select: { id: true, role: true },
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
  return NextResponse.json({ ok: true });
}
