import { NextResponse } from "next/server";
import { headers } from "next/headers";
import type { TenantType } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { sanitizeMappingForDb } from "@/lib/panel/mapping-placeholders";

export const runtime = "nodejs";

type PatchBody = {
  /** Staff host (admin.*) — no x-tenant-slug header. */
  tenantSlug?: string;
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

/** Admin/team — update tenant type / mapping / thresholds / website. */
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
  const slug =
    (body.tenantSlug?.trim().toLowerCase() || h.get("x-tenant-slug") || "").trim();
  if (!slug) {
    return NextResponse.json(
      { error: "tenantSlug veya marka host gerekli" },
      { status: 400 },
    );
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
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

  try {
    await prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenant.id },
        data: {
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

    return NextResponse.json({ ok: true, tenant: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
