import { NextResponse } from "next/server";
import { headers } from "next/headers";
import type { TenantType } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { RESERVED_SLUGS } from "@/lib/panel/host";
import { sanitizeMappingForDb } from "@/lib/panel/mapping-placeholders";

export const runtime = "nodejs";

type PatchBody = {
  /** Current slug (staff host). */
  tenantSlug?: string;
  /** New slug — optional rename. */
  slug?: string;
  name?: string;
  metaAccountId?: string | null;
  type?: TenantType;
  website?: string | null;
  monthlyBudget?: number | null;
  timezone?: string;
  currency?: string;
  mapping?: {
    adsCustomerId?: string | null;
    ga4PropertyId?: string | null;
    gtmContainerId?: string | null;
    gscSiteUrl?: string | null;
    merchantId?: string | null;
  };
  thresholds?: {
    budgetPaceWarnPct?: number;
    convDropoutDays?: number;
    minSpendForAlert?: number;
  };
};

function emptyToNull(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

function normalizeMetaAccountId(
  raw: string | null,
  slugFallback: string,
): string {
  if (!raw) return `act_manual_${slugFallback}`;
  return raw.startsWith("act_") ? raw : `act_${raw.replace(/^act_/, "")}`;
}

function validateSlug(slug: string): string | null {
  if (!slug || slug.includes(".") || RESERVED_SLUGS.has(slug)) {
    return "Geçersiz veya reserved slug";
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return "slug yalnızca a-z, 0-9 ve tire olmalı";
  }
  return null;
}

/** Admin/team — update tenant identity / mapping / thresholds (wizard parity). */
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "admin" && session.user.role !== "team") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  }

  const h = await headers();
  const currentSlug =
    (body.tenantSlug?.trim().toLowerCase() || h.get("x-tenant-slug") || "").trim();
  if (!currentSlug) {
    return NextResponse.json(
      { error: "tenantSlug veya marka host gerekli" },
      { status: 400 },
    );
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: currentSlug },
    include: { mapping: true, thresholds: true },
  });
  if (!tenant) {
    return NextResponse.json(
      { error: "Tenant DB’de yok — önce seed / Meta provision." },
      { status: 404 },
    );
  }

  if (body.type && body.type !== "ecommerce" && body.type !== "lead") {
    return NextResponse.json({ error: "type ecommerce|lead olmalı" }, { status: 400 });
  }

  const nextSlug =
    body.slug !== undefined
      ? body.slug.trim().toLowerCase()
      : tenant.slug;
  if (body.slug !== undefined) {
    const slugErr = validateSlug(nextSlug);
    if (slugErr) {
      return NextResponse.json({ error: slugErr }, { status: 400 });
    }
    if (nextSlug !== tenant.slug) {
      const taken = await prisma.tenant.findUnique({ where: { slug: nextSlug } });
      if (taken) {
        return NextResponse.json({ error: "Bu slug zaten var" }, { status: 409 });
      }
    }
  }

  let nextMeta = tenant.metaAccountId;
  if (body.metaAccountId !== undefined) {
    nextMeta = normalizeMetaAccountId(
      emptyToNull(body.metaAccountId),
      nextSlug,
    );
    if (nextMeta !== tenant.metaAccountId) {
      const takenMeta = await prisma.tenant.findUnique({
        where: { metaAccountId: nextMeta },
      });
      if (takenMeta && takenMeta.id !== tenant.id) {
        return NextResponse.json(
          { error: "Bu Meta account ID zaten kayıtlı" },
          { status: 409 },
        );
      }
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenant.id },
        data: {
          ...(body.name !== undefined
            ? { name: body.name.trim() || tenant.name }
            : {}),
          ...(body.slug !== undefined && nextSlug !== tenant.slug
            ? { slug: nextSlug }
            : {}),
          ...(body.metaAccountId !== undefined
            ? { metaAccountId: nextMeta }
            : {}),
          ...(body.type ? { type: body.type } : {}),
          ...(body.website !== undefined
            ? { website: emptyToNull(body.website) }
            : {}),
          ...(body.monthlyBudget !== undefined
            ? {
                monthlyBudget:
                  body.monthlyBudget == null ? null : body.monthlyBudget,
              }
            : {}),
          ...(body.timezone ? { timezone: body.timezone } : {}),
          ...(body.currency ? { currency: body.currency } : {}),
        },
      });

      if (body.mapping) {
        const m = sanitizeMappingForDb({
          adsCustomerId:
            body.mapping.adsCustomerId === undefined
              ? undefined
              : emptyToNull(body.mapping.adsCustomerId),
          ga4PropertyId:
            body.mapping.ga4PropertyId === undefined
              ? undefined
              : emptyToNull(body.mapping.ga4PropertyId),
          gtmContainerId:
            body.mapping.gtmContainerId === undefined
              ? undefined
              : emptyToNull(body.mapping.gtmContainerId),
          gscSiteUrl:
            body.mapping.gscSiteUrl === undefined
              ? undefined
              : emptyToNull(body.mapping.gscSiteUrl),
          merchantId:
            body.mapping.merchantId === undefined
              ? undefined
              : emptyToNull(body.mapping.merchantId),
        });
        await tx.tenantMapping.upsert({
          where: { tenantId: tenant.id },
          update: {
            ...(m.adsCustomerId !== undefined
              ? { adsCustomerId: m.adsCustomerId }
              : {}),
            ...(m.ga4PropertyId !== undefined
              ? { ga4PropertyId: m.ga4PropertyId }
              : {}),
            ...(m.gtmContainerId !== undefined
              ? { gtmContainerId: m.gtmContainerId }
              : {}),
            ...(m.gscSiteUrl !== undefined
              ? { gscSiteUrl: m.gscSiteUrl }
              : {}),
            ...(m.merchantId !== undefined
              ? { merchantId: m.merchantId }
              : {}),
          },
          create: {
            tenantId: tenant.id,
            adsCustomerId: m.adsCustomerId ?? null,
            ga4PropertyId: m.ga4PropertyId ?? null,
            gtmContainerId: m.gtmContainerId ?? null,
            gscSiteUrl: m.gscSiteUrl ?? null,
            merchantId: m.merchantId ?? null,
          },
        });
      }

      if (body.thresholds) {
        const t = body.thresholds;
        await tx.tenantThreshold.upsert({
          where: { tenantId: tenant.id },
          update: {
            ...(t.budgetPaceWarnPct != null
              ? { budgetPaceWarnPct: t.budgetPaceWarnPct }
              : {}),
            ...(t.convDropoutDays != null
              ? { convDropoutDays: t.convDropoutDays }
              : {}),
            ...(t.minSpendForAlert != null
              ? { minSpendForAlert: t.minSpendForAlert }
              : {}),
          },
          create: {
            tenantId: tenant.id,
            budgetPaceWarnPct: t.budgetPaceWarnPct ?? 85,
            convDropoutDays: t.convDropoutDays ?? 3,
            minSpendForAlert: t.minSpendForAlert ?? 100,
          },
        });
      }
    });

    const updated = await prisma.tenant.findUnique({
      where: { id: tenant.id },
      include: { mapping: true, thresholds: true },
    });

    return NextResponse.json({
      ok: true,
      tenant: updated,
      slugChanged: nextSlug !== currentSlug,
      slug: updated?.slug ?? nextSlug,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
