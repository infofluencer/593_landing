import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type Body = {
  email?: string;
  password?: string;
  name?: string | null;
};

/** Admin/team — create/update client user + membership for a tenant. */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "admin" && session.user.role !== "team") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await ctx.params;
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant bulunamadı" }, { status: 404 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  }

  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(body.password ?? "");
  const name = body.name?.trim() || null;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Geçerli e-posta gerekli" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Şifre en az 8 karakter olmalı" },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.role !== "client") {
      return NextResponse.json(
        { error: "Bu e-posta staff hesabı — müşteri yapılamaz" },
        { status: 409 },
      );
    }

    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            passwordHash,
            ...(name ? { name } : {}),
            role: "client",
          },
        })
      : await prisma.user.create({
          data: {
            email,
            passwordHash,
            name: name || email.split("@")[0],
            role: "client",
          },
        });

    await prisma.membership.upsert({
      where: {
        userId_tenantId: { userId: user.id, tenantId: tenant.id },
      },
      update: {},
      create: { userId: user.id, tenantId: tenant.id },
    });

    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      tenantSlug: tenant.slug,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
