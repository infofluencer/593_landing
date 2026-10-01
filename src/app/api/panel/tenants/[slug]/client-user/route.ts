import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  assertClientEmailForPanel,
  normalizePanelSlug,
  validatePanelSlug,
} from "@/lib/panel/client-email";
import { rootDomain } from "@/lib/panel/host";
import { can } from "@/lib/panel/permissions";

export const runtime = "nodejs";

type Body = {
  email?: string;
  password?: string;
  name?: string | null;
  /** Existing client user id on this tenant (preferred when editing). */
  userId?: string;
  /**
   * Panel subdomain (slug). Güncellenebilir — e-posta local-part ile
   * birebir eşleşmeli. Dokploy’da da aynı host tanımlanmalı.
   */
  panelSlug?: string;
};

/** Admin — create/update client user + membership for a tenant. */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user.role, "users.manage")) {
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
  const userId = body.userId?.trim() || "";
  const domain = rootDomain();

  const nextPanelSlug =
    body.panelSlug !== undefined
      ? normalizePanelSlug(body.panelSlug)
      : tenant.slug;

  const slugErr = validatePanelSlug(nextPanelSlug);
  if (slugErr) {
    return NextResponse.json({ error: slugErr }, { status: 400 });
  }

  const emailErr = assertClientEmailForPanel(email, nextPanelSlug, domain);
  if (emailErr) {
    return NextResponse.json({ error: emailErr }, { status: 400 });
  }

  if (nextPanelSlug !== tenant.slug) {
    const taken = await prisma.tenant.findUnique({
      where: { slug: nextPanelSlug },
    });
    if (taken) {
      return NextResponse.json(
        { error: "Bu panel adresi zaten var" },
        { status: 409 },
      );
    }
  }

  try {
    let membershipUser =
      userId
        ? await prisma.user.findFirst({
            where: {
              id: userId,
              role: "client",
              memberships: { some: { tenantId: tenant.id } },
            },
          })
        : null;

    if (!membershipUser) {
      const m = await prisma.membership.findFirst({
        where: { tenantId: tenant.id, user: { role: "client" } },
        include: { user: true },
      });
      membershipUser = m?.user ?? null;
    }

    const emailOwner = await prisma.user.findUnique({ where: { email } });
    if (emailOwner && emailOwner.role !== "client") {
      return NextResponse.json(
        { error: "Bu e-posta staff hesabı — müşteri yapılamaz" },
        { status: 409 },
      );
    }
    if (
      emailOwner &&
      membershipUser &&
      emailOwner.id !== membershipUser.id
    ) {
      return NextResponse.json(
        { error: "Bu e-posta başka bir müşteri hesabında kayıtlı" },
        { status: 409 },
      );
    }

    if (!membershipUser && !emailOwner && password.length < 8) {
      return NextResponse.json(
        { error: "Yeni hesap için şifre en az 8 karakter olmalı" },
        { status: 400 },
      );
    }
    if (password && password.length < 8) {
      return NextResponse.json(
        { error: "Şifre en az 8 karakter olmalı" },
        { status: 400 },
      );
    }

    const passwordHash = password
      ? await bcrypt.hash(password, 10)
      : null;

    const slugChanged = nextPanelSlug !== tenant.slug;
    if (slugChanged) {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { slug: nextPanelSlug },
      });
    }

    let user;
    if (membershipUser) {
      user = await prisma.user.update({
        where: { id: membershipUser.id },
        data: {
          email,
          ...(name !== null ? { name: name || membershipUser.name } : {}),
          ...(passwordHash
            ? { passwordHash, passwordPlain: password }
            : {}),
          role: "client",
        },
      });
    } else if (emailOwner) {
      user = await prisma.user.update({
        where: { id: emailOwner.id },
        data: {
          ...(name ? { name } : {}),
          ...(passwordHash
            ? { passwordHash, passwordPlain: password }
            : {}),
          role: "client",
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          email,
          passwordHash: passwordHash!,
          passwordPlain: password,
          name: name || nextPanelSlug,
          role: "client",
        },
      });
    }

    await prisma.membership.upsert({
      where: {
        userId_tenantId: { userId: user.id, tenantId: tenant.id },
      },
      update: {},
      create: { userId: user.id, tenantId: tenant.id },
    });

    return NextResponse.json({
      ok: true,
      passwordUpdated: Boolean(passwordHash),
      slugChanged,
      slug: nextPanelSlug,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        hasPassword: true,
        passwordPlain: user.passwordPlain ?? null,
      },
      tenantSlug: nextPanelSlug,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
