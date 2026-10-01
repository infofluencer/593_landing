import { NextResponse } from "next/server";
import type { TenantType } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { slugifyTr } from "@/lib/integrations/slugify";
import { validatePanelSlug } from "@/lib/panel/client-email";
import { sanitizeMappingForDb } from "@/lib/panel/mapping-placeholders";
import { can } from "@/lib/panel/permissions";

export const runtime = "nodejs";

type CreateBody = {
  slug?: string;
  name?: string;
  type?: TenantType;
  website?: string | null;
  timezone?: string;
  currency?: string;
  metaAccountId?: string | null;
  mapping?: {
    adsCustomerId?: string | null;
    ga4PropertyId?: string | null;
    gtmContainerId?: string | null;
    gscSiteUrl?: string | null;
    merchantId?: string | null;
  };
};

function emptyToNull(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

/** Admin — create tenant + mapping + thresholds (manual onboarding). */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user.role, "brands.create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name gerekli" }, { status: 400 });
  }

  const slug = (body.slug?.trim() || slugifyTr(name)).toLowerCase();
  const slugErr = validatePanelSlug(slug);
  if (slugErr) {
    return NextResponse.json({ error: slugErr }, { status: 400 });
  }

  const type = body.type === "ecommerce" ? "ecommerce" : "lead";
  const metaRaw = emptyToNull(body.metaAccountId);
  const metaAccountId = metaRaw
    ? metaRaw.startsWith("act_")
      ? metaRaw
      : `act_${metaRaw.replace(/^act_/, "")}`
    : `act_manual_${slug}`;

  const existingSlug = await prisma.tenant.findUnique({ where: { slug } });
  if (existingSlug) {
    return NextResponse.json({ error: "Bu slug zaten var" }, { status: 409 });
  }
  const existingMeta = await prisma.tenant.findUnique({
    where: { metaAccountId },
  });
  if (existingMeta) {
    return NextResponse.json(
      { error: "Bu Meta account ID zaten kayıtlı" },
      { status: 409 },
    );
  }

  const m = sanitizeMappingForDb(body.mapping ?? {});
  const maxOrder = await prisma.tenant.aggregate({
    _max: { sortOrder: true },
  });

  try {
    const tenant = await prisma.tenant.create({
      data: {
        slug,
        name,
        type,
        website: emptyToNull(body.website),
        metaAccountId,
        timezone: body.timezone?.trim() || "Europe/Istanbul",
        currency: body.currency?.trim() || "TRY",
        visible: true,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        mapping: {
          create: {
            adsCustomerId: m.adsCustomerId ?? null,
            ga4PropertyId: m.ga4PropertyId ?? null,
            gtmContainerId: m.gtmContainerId ?? null,
            gscSiteUrl: emptyToNull(m.gscSiteUrl ?? null),
            merchantId: emptyToNull(m.merchantId ?? null),
          },
        },
        thresholds: { create: {} },
      },
      include: { mapping: true, thresholds: true },
    });

    return NextResponse.json({ ok: true, tenant }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
