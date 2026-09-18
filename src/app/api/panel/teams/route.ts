import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { uniqueTeamSlug } from "@/lib/panel/board";
import { requireStaffApi } from "@/lib/panel/staff-auth";

export const runtime = "nodejs";

/** GET — ekipler + tüm staff kullanıcılar. */
export async function GET() {
  const { error } = await requireStaffApi();
  if (error) return error;

  const [teams, staff] = await Promise.all([
    prisma.team.findMany({
      orderBy: { name: "asc" },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.user.findMany({
      where: { role: { in: ["admin", "team"] } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        passwordPlain: true,
        createdAt: true,
        teamMemberships: {
          select: {
            teamId: true,
            team: { select: { id: true, name: true, slug: true, color: true } },
          },
        },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }, { email: "asc" }],
    }),
  ]);

  return NextResponse.json({ teams, staff });
}

type CreateTeamBody = {
  name?: string;
  description?: string | null;
  color?: string | null;
};

type CreateMemberBody = {
  email?: string;
  password?: string;
  name?: string | null;
  role?: "admin" | "team";
  teamIds?: string[];
};

/** POST — yeni ekip veya yeni staff üye. */
export async function POST(request: Request) {
  const { session, error } = await requireStaffApi();
  if (error || !session) return error;

  let body: (CreateTeamBody & CreateMemberBody & { kind?: string }) | null;
  try {
    body = (await request.json()) as CreateTeamBody &
      CreateMemberBody & { kind?: string };
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  }

  const kind = body.kind === "member" ? "member" : "team";

  if (kind === "team") {
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "name gerekli" }, { status: 400 });
    }
    const color =
      typeof body.color === "string" && /^#[0-9a-fA-F]{6}$/.test(body.color.trim())
        ? body.color.trim()
        : "#71717a";
    const slug = await uniqueTeamSlug(name);
    const team = await prisma.team.create({
      data: {
        name,
        slug,
        color,
        description: body.description?.trim() || null,
      },
      include: { members: { include: { user: true } } },
    });
    return NextResponse.json({ team }, { status: 201 });
  }

  // Yalnızca admin yeni staff oluşturabilir
  if (session.user.role !== "admin") {
    return NextResponse.json(
      { error: "Yalnızca admin ekip üyesi ekleyebilir" },
      { status: 403 },
    );
  }

  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(body.password ?? "");
  const name = body.name?.trim() || null;
  const role = body.role === "admin" ? "admin" : "team";

  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "Geçerli e-posta gerekli" },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Şifre en az 8 karakter olmalı" },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Bu e-posta zaten kayıtlı" },
      { status: 409 },
    );
  }

  const teamIds = Array.isArray(body.teamIds)
    ? body.teamIds.filter((id): id is string => typeof id === "string")
    : [];

  if (teamIds.length > 0) {
    const count = await prisma.team.count({ where: { id: { in: teamIds } } });
    if (count !== teamIds.length) {
      return NextResponse.json(
        { error: "Geçersiz ekip seçimi" },
        { status: 400 },
      );
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      passwordPlain: password,
      name,
      role,
      teamMemberships:
        teamIds.length > 0
          ? { create: teamIds.map((teamId) => ({ teamId })) }
          : undefined,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      passwordPlain: true,
      teamMemberships: {
        select: {
          teamId: true,
          team: { select: { id: true, name: true, slug: true, color: true } },
        },
      },
    },
  });

  return NextResponse.json({ user }, { status: 201 });
}
