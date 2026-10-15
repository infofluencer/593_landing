import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/panel/audit";
import { requirePermissionApi } from "@/lib/panel/staff-auth";
import { fixedTeamWhere, teamInclude } from "@/lib/panel/teams";

export const runtime = "nodejs";

type PatchBody = {
  addUserId?: string;
  removeUserId?: string;
};

/** PATCH — sabit ekibe üye ekle/çıkar (yalnızca admin). Ad/renk sabittir. */
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requirePermissionApi("teams.manageMembers");
  if (error) return error;

  const { id } = await ctx.params;
  const team = await prisma.team.findFirst({ where: { id, ...fixedTeamWhere } });
  if (!team) {
    return NextResponse.json({ error: "Ekip bulunamadı" }, { status: 404 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  }

  if (body.addUserId) {
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
    await audit(session, {
      action: "team.member_add",
      entity: "team",
      entityId: id,
      summary: `${user.email} → ${team.name}`,
      after: { userId: user.id, email: user.email },
    });
  }

  if (body.removeUserId) {
    const removed = await prisma.teamMember.deleteMany({
      where: { teamId: id, userId: body.removeUserId },
    });
    if (removed.count > 0) {
      const user = await prisma.user.findUnique({
        where: { id: body.removeUserId },
        select: { email: true },
      });
      await audit(session, {
        action: "team.member_remove",
        entity: "team",
        entityId: id,
        summary: `${user?.email ?? body.removeUserId} ← ${team.name}`,
        before: { userId: body.removeUserId, email: user?.email ?? null },
      });
    }
  }

  const updated = await prisma.team.findUnique({
    where: { id },
    include: teamInclude,
  });

  return NextResponse.json({ team: updated });
}
