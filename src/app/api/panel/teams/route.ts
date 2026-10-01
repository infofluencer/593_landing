import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { can } from "@/lib/panel/permissions";
import { requirePermissionApi, requireStaffApi } from "@/lib/panel/staff-auth";
import {
  fixedTeamOrderBy,
  fixedTeamWhere,
  staffSelect,
  teamInclude,
} from "@/lib/panel/teams";

export const runtime = "nodejs";

/** GET — sabit ekipler + tüm staff kullanıcılar. */
export async function GET() {
  const { session, error } = await requireStaffApi();
  if (error || !session) return error;

  const [teams, staff] = await Promise.all([
    prisma.team.findMany({
      where: fixedTeamWhere,
      orderBy: fixedTeamOrderBy,
      include: teamInclude,
    }),
    prisma.user.findMany({
      where: { role: { in: ["admin", "team"] } },
      select: staffSelect(can(session.user.role, "users.viewPasswords")),
      orderBy: [{ role: "asc" }, { name: "asc" }, { email: "asc" }],
    }),
  ]);

  return NextResponse.json({ teams, staff });
}

type CreateMemberBody = {
  email?: string;
  password?: string;
  name?: string | null;
  role?: "admin" | "team";
  teamIds?: string[];
};

/** POST — yeni staff kullanıcı (yalnızca admin). Ekipler sabittir. */
export async function POST(request: Request) {
  const { error } = await requirePermissionApi("users.manage");
  if (error) return error;

  let body: CreateMemberBody;
  try {
    body = (await request.json()) as CreateMemberBody;
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
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
    ? Array.from(
        new Set(body.teamIds.filter((id): id is string => typeof id === "string")),
      )
    : [];

  if (teamIds.length > 0) {
    const count = await prisma.team.count({
      where: { id: { in: teamIds }, ...fixedTeamWhere },
    });
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
    select: staffSelect(true),
  });

  return NextResponse.json({ user }, { status: 201 });
}
