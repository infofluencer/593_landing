import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { uniqueTeamSlug } from "@/lib/panel/board";
import { requireStaffApi } from "@/lib/panel/staff-auth";

export const runtime = "nodejs";

type PatchBody = {
  name?: string;
  description?: string | null;
  color?: string | null;
  /** Üye ekle/çıkar */
  addUserId?: string;
  removeUserId?: string;
  /** Toplu üyelik seti (staff satırından hızlı düzenleme). */
  setMemberUserIds?: string[];
};

/** PATCH — ekip güncelle / üye ekle-çıkar. */
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireStaffApi();
  if (error || !session) return error;

  const { id } = await ctx.params;
  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) {
    return NextResponse.json({ error: "Ekip bulunamadı" }, { status: 404 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  }

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: "name boş olamaz" }, { status: 400 });
    }
    const slug = await uniqueTeamSlug(name, id);
    await prisma.team.update({ where: { id }, data: { name, slug } });
  }

  if (body.description !== undefined) {
    await prisma.team.update({
      where: { id },
      data: {
        description:
          body.description == null
            ? null
            : String(body.description).trim() || null,
      },
    });
  }

  if (body.color !== undefined) {
    const color =
      typeof body.color === "string" && /^#[0-9a-fA-F]{6}$/.test(body.color.trim())
        ? body.color.trim()
        : null;
    if (!color) {
      return NextResponse.json(
        { error: "color #RRGGBB olmalı" },
        { status: 400 },
      );
    }
    await prisma.team.update({ where: { id }, data: { color } });
  }

  if (body.addUserId) {
    if (session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Yalnızca admin üye ekleyebilir" },
        { status: 403 },
      );
    }
    const user = await prisma.user.findFirst({
      where: { id: body.addUserId, role: { in: ["admin", "team"] } },
    });
    if (!user) {
      return NextResponse.json(
        { error: "Staff kullanıcı bulunamadı" },
        { status: 400 },
      );
    }
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: id, userId: user.id } },
      update: {},
      create: { teamId: id, userId: user.id },
    });
  }

  if (body.removeUserId) {
    if (session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Yalnızca admin üye çıkarabilir" },
        { status: 403 },
      );
    }
    await prisma.teamMember.deleteMany({
      where: { teamId: id, userId: body.removeUserId },
    });
  }

  const updated = await prisma.team.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return NextResponse.json({ team: updated });
}

/** DELETE — ekip sil. */
export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireStaffApi();
  if (error || !session) return error;

  if (session.user.role !== "admin") {
    return NextResponse.json(
      { error: "Yalnızca admin ekip silebilir" },
      { status: 403 },
    );
  }

  const { id } = await ctx.params;
  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) {
    return NextResponse.json({ error: "Ekip bulunamadı" }, { status: 404 });
  }

  await prisma.team.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
