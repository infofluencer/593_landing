import { NextResponse } from "next/server";
import { headers } from "next/headers";
import type { Prisma, TenantType } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { resolveAlert } from "@/lib/panel/alerts-engine";
import { audit, diffFields } from "@/lib/panel/audit";
import { deleteBrandCoverFile } from "@/lib/panel/brand-cover";
import { validatePanelSlug } from "@/lib/panel/client-email";
import { sanitizeMappingForDb } from "@/lib/panel/mapping-placeholders";
import {
  ALERT_TYPES_BY_INTEGRATION,
  integrationForJob,
  isIntegrationKey,
  type IntegrationKey,
} from "@/lib/panel/integrations";
import { can } from "@/lib/panel/permissions";

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
  timezone?: string;
  currency?: string;
  visible?: boolean;
  /** Ajans içi sorumlu (staff User.id); null = kaldır. */
  ownerId?: string | null;
  /** Markanın kullanmadığı platformlar (bkz. lib/panel/integrations). */
  disabledIntegrations?: string[];
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

/**
 * Kapatılan platformun eski hata izlerini temizler: SyncJob satırları,
 * hesap/ödeme durumu ve açık alarmlar. Geçmiş SyncRun logu korunur.
 */
async function cleanupDisabledIntegrations(
  tenantId: string,
  keys: IntegrationKey[],
  by: string,
) {
  const jobs = await prisma.syncJob.findMany({
    where: { tenantId },
    select: { id: true, provider: true, service: true },
  });
  const jobIds = jobs
    .filter((j) => {
      const key = integrationForJob(j.provider, j.service);
      return key && keys.includes(key);
    })
    .map((j) => j.id);
  if (jobIds.length) {
    await prisma.syncJob.deleteMany({ where: { id: { in: jobIds } } });
  }
  const providers = [
    ...(keys.includes("meta") ? (["meta"] as const) : []),
    ...(keys.includes("google_ads") ? (["google"] as const) : []),
  ];
  if (providers.length) {
    await prisma.accountHealth.deleteMany({
      where: { tenantId, provider: { in: [...providers] } },
    });
  }
  const alertTypes = keys.flatMap((k) => ALERT_TYPES_BY_INTEGRATION[k]);
  if (alertTypes.length) {
    const open = await prisma.alert.findMany({
      where: { tenantId, resolved: false, type: { in: alertTypes } },
      select: { id: true },
    });
    for (const a of open) {
      await resolveAlert({ alertId: a.id, by, note: "Platform bu markada kullanılmıyor" });
    }
  }
}

type TenantWithSettings = Prisma.TenantGetPayload<{
  include: { mapping: true; thresholds: true };
}>;

/** Audit için düz alanlar — id/zaman damgaları hariç. */
function auditSnapshot(t: TenantWithSettings | null): Record<string, unknown> {
  if (!t) return {};
  return {
    name: t.name,
    slug: t.slug,
    type: t.type,
    website: t.website,
    metaAccountId: t.metaAccountId,
    timezone: t.timezone,
    currency: t.currency,
    visible: t.visible,
    ownerId: t.ownerId,
    disabledIntegrations: t.disabledIntegrations.join(", ") || null,
    adsCustomerId: t.mapping?.adsCustomerId ?? null,
    ga4PropertyId: t.mapping?.ga4PropertyId ?? null,
    gtmContainerId: t.mapping?.gtmContainerId ?? null,
    gscSiteUrl: t.mapping?.gscSiteUrl ?? null,
    merchantId: t.mapping?.merchantId ?? null,
    budgetPaceWarnPct: t.thresholds?.budgetPaceWarnPct ?? null,
    convDropoutDays: t.thresholds?.convDropoutDays ?? null,
    minSpendForAlert: t.thresholds?.minSpendForAlert?.toString() ?? null,
  };
}

/** Admin/team — update tenant identity / mapping / thresholds (wizard parity). */
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user.role, "brands.edit")) {
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

  if (!can(session.user.role, "brands.editIdentity")) {
    const identityChanged =
      (body.slug !== undefined &&
        body.slug.trim().toLowerCase() !== tenant.slug) ||
      (body.name !== undefined &&
        (body.name.trim() || tenant.name) !== tenant.name) ||
      (body.type !== undefined && body.type !== tenant.type);
    if (identityChanged) {
      return NextResponse.json(
        { error: "Marka adı, panel adresi ve türünü yalnızca admin değiştirebilir" },
        { status: 403 },
      );
    }
  }

  if (body.type && body.type !== "ecommerce" && body.type !== "lead") {
    return NextResponse.json({ error: "type ecommerce|lead olmalı" }, { status: 400 });
  }

  const nextSlug =
    body.slug !== undefined
      ? body.slug.trim().toLowerCase()
      : tenant.slug;
  if (body.slug !== undefined) {
    const slugErr = validatePanelSlug(nextSlug);
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

  let nextDisabled = tenant.disabledIntegrations;
  if (body.disabledIntegrations !== undefined) {
    if (
      !Array.isArray(body.disabledIntegrations) ||
      !body.disabledIntegrations.every(isIntegrationKey)
    ) {
      return NextResponse.json({ error: "Geçersiz platform" }, { status: 400 });
    }
    nextDisabled = Array.from(new Set(body.disabledIntegrations)).sort();
  }
  const newlyDisabled = nextDisabled.filter(
    (k) => !tenant.disabledIntegrations.includes(k),
  ) as IntegrationKey[];

  let nextOwnerId = tenant.ownerId;
  if (body.ownerId !== undefined) {
    nextOwnerId = emptyToNull(body.ownerId);
    if (nextOwnerId) {
      const owner = await prisma.user.findFirst({
        where: { id: nextOwnerId, role: { in: ["admin", "team"] } },
        select: { id: true },
      });
      if (!owner) {
        return NextResponse.json(
          { error: "Sorumlu yalnızca ajans kullanıcısı olabilir" },
          { status: 400 },
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
          ...(body.timezone ? { timezone: body.timezone } : {}),
          ...(body.currency ? { currency: body.currency } : {}),
          ...(typeof body.visible === "boolean" ? { visible: body.visible } : {}),
          ...(body.ownerId !== undefined ? { ownerId: nextOwnerId } : {}),
          ...(body.disabledIntegrations !== undefined
            ? { disabledIntegrations: nextDisabled }
            : {}),
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

    if (newlyDisabled.length) {
      await cleanupDisabledIntegrations(tenant.id, newlyDisabled, session.user.email ?? "panel");
    }

    const updated = await prisma.tenant.findUnique({
      where: { id: tenant.id },
      include: { mapping: true, thresholds: true },
    });

    const changes = diffFields(auditSnapshot(tenant), auditSnapshot(updated));
    if (changes) {
      await audit(session, {
        action: "tenant.update",
        entity: "tenant",
        entityId: tenant.id,
        tenantId: tenant.id,
        summary: `${tenant.name} ayarları: ${Object.keys(changes.after).join(", ")}`,
        ...changes,
      });
    }

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

/** Admin — markayı ve ilişkili veriyi kalıcı siler. */
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user.role, "brands.delete")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { tenantSlug?: string; confirmSlug?: string };
  try {
    body = (await request.json()) as {
      tenantSlug?: string;
      confirmSlug?: string;
    };
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  }

  const tenantSlug = body.tenantSlug?.trim().toLowerCase() || "";
  const confirmSlug = body.confirmSlug?.trim().toLowerCase() || "";
  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug gerekli" }, { status: 400 });
  }
  if (!confirmSlug || confirmSlug !== tenantSlug) {
    return NextResponse.json(
      { error: "Onay için slug’ı aynen yazın" },
      { status: 400 },
    );
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, slug: true, name: true },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Marka bulunamadı" }, { status: 404 });
  }

  try {
    const memberUserIds = (
      await prisma.membership.findMany({
        where: { tenantId: tenant.id },
        select: { userId: true },
      })
    ).map((m) => m.userId);

    await prisma.tenant.delete({ where: { id: tenant.id } });
    await deleteBrandCoverFile(tenant.id);
    await audit(session, {
      action: "tenant.delete",
      entity: "tenant",
      entityId: tenant.id,
      summary: `${tenant.name} (${tenant.slug}) silindi`,
      before: tenant,
    });

    // Yalnızca bu markaya bağlı kalan client kullanıcıları temizle
    if (memberUserIds.length) {
      for (const userId of memberUserIds) {
        const left = await prisma.membership.count({ where: { userId } });
        if (left > 0) continue;
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true },
        });
        if (user?.role === "client") {
          await prisma.user.delete({ where: { id: userId } });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      deleted: { slug: tenant.slug, name: tenant.name },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
